# แนวทาง Refactor `np-dms-ocr` และ `np-dms-ai`

## หลักการแยกหน้าที่

```text
np-dms-ocr = แปลงภาพ/เอกสาร → ข้อความดิบ (OCR text)
np-dms-ai  = วิเคราะห์ข้อความ → ข้อมูลเชิงธุรกิจ (metadata + confidence)
```

## ขั้นตอนที่ 1 — `np-dms-ocr` (OCR)

| รายการ | รายละเอียด |
|---|---|
| หน้าที่ | สกัดข้อความจาก PDF/image |
| Input | PDF path + `maxPages=3` |
| Output | OCR text (string) |
| Prompt | `ocr_system` (Active Prompt จาก `ai_prompts`) |
| Timeout | 600 วินาที |
| `keep_alive` | `0` (unload หลังเสร็จ) |
| ห้ามทำ | สรุปเนื้อหา, จัด category, สร้าง tags, ประเมิน confidence |

## ขั้นตอนที่ 2 — `np-dms-ai` (Metadata Extraction + Confidence)

| รายการ | รายละเอียด |
|---|---|
| หน้าที่ | วิเคราะห์ OCR text เพื่อสร้าง metadata สำหรับ human review |
| Input | OCR text + `allowed_categories` + `existing_tags` |
| Output | JSON object |
| Prompt | Active Prompt จาก `ai_prompts` (ไม่ใช่ inline hardcode) |
| รูปแบบ prompt | Markdown (System Prompt) |
| รูปแบบ output | JSON (deterministic parse + validate) |
| `keep_alive` | `-1` (ค้างใน GPU สำหรับ realtime ต่อไป) |

## ผลลัพธ์ JSON จาก `np-dms-ai`

```json
{
  "ocrQuality": {
    "confidence": 0.72,
    "issues": [
      {
        "type": "GARBLED_TEXT",
        "message": "ข้อความหน้า 2 มีอักขระเสีย",
        "evidence": "..."
      }
    ]
  },
  "metadata": {
    "summary": "...",
    "category": "Correspondence",
    "tags": [
      {
        "name": "คอนกรีต",
        "isNew": false,
        "evidence": "..."
      }
    ],
    "confidence": {
      "summary": 0.85,
      "category": 0.60,
      "tags": 0.55
    }
  },
  "requiresHumanReview": true
}
```

## การแยก Confidence เป็น 2 ส่วน

| คะแนน | ความหมาย | ใช้ตัดสินใจเรื่อง |
|---|---|---|
| `ocrQuality.confidence` | คุณภาพข้อความ OCR (ไม่ใช่ accuracy เพราะไม่มี ground truth) | ต้อง re-OCR หรือไม่ |
| `metadata.confidence.*` | ความมั่นใจในแต่ละ field ที่ AI สร้าง | ต้อง human review หรือไม่ |

## Model Switching Flow (แก้ปัญหา VRAM contention)

```text
Start Extract
  │
  ├─ 1. unload np-dms-ai (keep_alive: 0)
  │
  ├─ 2. np-dms-ocr: OCR 3 หน้า (keep_alive: 0)
  │     └─ output: OCR text
  │
  ├─ 3. np-dms-ocr auto-unload (keep_alive: 0)
  │
  ├─ 4. np-dms-ai: metadata extraction (keep_alive: -1)
  │     ├─ input: OCR text + allowed_categories + existing_tags
  │     └─ output: JSON (ocrQuality + metadata + requiresHumanReview)
  │
  └─ 5. บันทึกผลลัพธ์กลับ migration_review_queue
```

## เปรียบเทียบ: ปัจจุบัน vs ที่เสนอ

| รายการ | ปัจจุบัน | ที่เสนอ |
|---|---|---|
| Model switching | ไม่มี (main ค้าง Forever ระหว่าง OCR) | unload main → OCR → reload main |
| OCR prompt | `ocr_system` | `ocr_system` (คงเดิม) |
| AI prompt | inline hardcode | Active Prompt จาก `ai_prompts` |
| AI prompt รูปแบบ | plain text | Markdown |
| Output รูปแบบ | JSON (single `confidence`) | JSON (แยก `ocrQuality` + `metadata.confidence`) |
| Category | `"Letter หรือ RFA..."` (ขัด glossary) | จาก Master Data (`allowed_categories`) |
| Tags | string[] | `{name, isNew, evidence}[]` |
| Confidence | ค่าเดียว ความหมายคลุมเครือ | แยก per-field + OCR quality |
| `requiresHumanReview` | ไม่มี | มี (บังคับเมื่อ confidence < 0.75) |
| Governance | ไม่ผ่าน ADR-036/037 | ผ่าน Active Prompt + Profile |

## ข้อควรระวัง

1. **OCR quality confidence ไม่ใช่ OCR accuracy** — LLM เห็นเฉพาะ text ไม่เห็นภาพต้นฉบับ จึงประเมินได้เพียงความอ่านได้/ต่อเนื่อง ไม่ใช่ความถูกต้องเทียบต้นฉบับ

2. **ห้ามให้ OCR model ทำ metadata** — `np-dms-ocr` ใช้ prompt `ocr_system` เท่านั้น ห้ามส่ง prompt ที่สั่งจัด category หรือสร้าง tags

3. **`allowed_categories` ต้องมาจาก Master Data** — ไม่ใช่ hardcode ใน prompt เพราะอาจไม่ตรงกับ category ที่ฐานข้อมูลรองรับ

4. **Backend ต้อง validate JSON** — ใช้ Zod/DTO ตรวจ schema และบังคับ `0 <= confidence <= 1` ก่อนบันทึก

