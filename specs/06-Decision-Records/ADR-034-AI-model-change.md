# ADR-034: AI Model Change — Thai-Optimized Model Stack

**Status:** Accepted
**Date:** 2026-06-03
**Decision Makers:** Development Team, AI Integration Lead
**Supersedes:** ADR-023A Section 2.1 (Model Stack & Configuration)
**Related Documents:**
- [ADR-023A: Unified AI Architecture — Model Revision](./ADR-023A-unified-ai-architecture.md)
- [ADR-033: Active Model & OCR Management](./ADR-033-active-model-and-ocr-management.md)
- [CONTEXT.md](../../../CONTEXT.md)

---

## Context and Problem Statement

การใช้งาน `gemma4:e2b` (~2GB) เป็นโมเดลหลักในสภาพแวดล้อมภาษาไทย พบว่าประสิทธิภาพด้าน OCR และการสกัดข้อมูลจากเอกสารภาษาไทยยังไม่เพียงพอ จึงต้องเปลี่ยนเป็นโมเดลที่ถูก fine-tune มาสำหรับภาษาไทยโดยเฉพาะ

**ข้อจำกัด:**
- VRAM Budget: RTX 2060 Super 8GB
- Main Model + OCR Model ไม่สามารถโหลดพร้อมกันได้ (รวม ~5.7GB ขณะประมวลผล แต่ peak อาจเกิน 8GB)
- ต้องรักษา mechanism `keep_alive` และ VRAM monitoring ตาม ADR-033

---

## Decision Drivers

- **Thai Language Optimization:** โมเดลต้องรองรับ OCR และการสกัดข้อมูลภาษาไทยได้ดีกว่า gemma4
- **VRAM Safety:** ไม่เกิน 8GB ในทุกสถานการณ์
- **Model Switching:** ใช้ BullMQ processor ควบคุมการสลับโมเดลเท่านั้น
- **No Direct n8n Access:** n8n ห้ามเรียก Ollama โดยตรง ต้องผ่าน DMS API → BullMQ

---

## Decision Outcome

### Selected Models

| Model | Role | Base Model | Size | Keep-Alive |
|-------|------|------------|------|------------|
| `typhoon2.5-np-dms:latest` | Main AI (General + OCR Post-processing + Extraction + RAG Q&A) | `scb10x/typhoon2.5-qwen3-4b:latest` | ~2.5GB | Stand by ตลอด (ไม่ใช่ 0) |
| `typhoon-np-dms-ocr:latest` | OCR ภาษาไทย | `scb10x/typhoon-ocr1.5-3b:latest` | ~3.2GB | `0` (unload ทันที) |

### Key Parameters (Main Model)

```
PARAMETER num_ctx 8192
PARAMETER num_predict 2048
PARAMETER temperature 0.1
PARAMETER top_p 0.85
PARAMETER repeat_penalty 1.15
```

---

## Implementation Details

### 1. Model Files (Desk-5439)

---

file: E:\np-dms\lcbp3\specs\04-Infrastructure-OPS\04-00-docker-compose\Desk-5439\typhoon2.5-np-dms.model.md
```t
# ollama create typhoon2.5-np-dms -f ./typhoon2.5-np-dms.model.md

FROM scb10x/typhoon2.5-qwen3-4b:latest

# 1. ปรับขนาดพื้นที่ประมวลผลข้อความ (Context Window)
# ตั้งไว้ที่ 16K ถึง 32K ถือว่าเหลือเฟือมากสำหรับเอกสารข้อความ OCR หลายสิบหน้า
PARAMETER num_ctx 8192
PARAMETER num_predict 2048
# 2. ปรับความนิ่งของคำตอบ (Determinism)
# บีบให้เป็น 0 เพื่อป้องกันโมเดล "คิดแทน" หรือเดาตัวเลข/วันที่ขึ้นมาเอง (สำคัญมากสำหรับเลขที่เอกสาร)
PARAMETER temperature 0.1
PARAMETER top_p 0.85
PARAMETER repeat_penalty 1.15
PARAMETER stop "\n\n"

# 3. ล็อกบทบาทและโครงสร้างผลลัพธ์ที่ต้องการ (System Prompt)
SYSTEM """คุณคือระบบ AI ผู้เชี่ยวชาญด้านการวิเคราะห์และจัดการเอกสารโครงการ (Document Management System)
หน้าที่ของคุณคืออ่านข้อความภาษาไทยที่ได้มาจากระบบ OCR อย่างละเอียด แล้วทำตามคำสั่งต่อไปนี้อย่างเคร่งครัด:
Guidelines:
1. ข้อมูลเข้าคือข้อความดิบจาก OCR ซึ่งอาจมีคำผิด บรรทัดขาดหาย หรือสัญลักษณ์รบกวน
2. ค้นหาและสกัด 'เลขที่เอกสาร' (Document Number) และ 'วันที่ของเอกสาร' ออกมาให้ถูกต้อง หากไม่พบให้ระบุว่า 'ไม่ระบุ'
3. สรุปเนื้อหาสำคัญของเอกสารนี้อย่างกระชับ เข้าใจง่าย โดยใช้บริบทโดยรวมในการตีความ หากไม่แน่ใจให้ระบุสถานะ "ไม่ชัดเจน"
4. ห้ามสร้างข้อมูล (hallucinate) ที่ไม่มีอยู่ในข้อความต้นฉบับ
5. ห้ามเดาตัวเลข วันที่ หรือเนื้อหาใดๆ ที่ไม่ได้ปรากฏอยู่ในข้อความดิบเด็ดขาด
6. หากข้อมูลไม่ครบ ให้เติม null พร้อมระบุ reason ในฟิลด์ _missing_fields
ตอบกลับเฉพาะ JSON ที่กำหนดเท่านั้น ห้ามเพิ่มข้อความนอกโครงสร้าง
""”
```

---
file: E:\np-dms\lcbp3\specs\04-Infrastructure-OPS\04-00-docker-compose\Desk-5439\typhoon-np-dms-ocr.model.md
```t
# ollama create typhoon-np-dms-ocr -f ./typhoon-np-dms-ocr.model.md

# ใส่ชื่อ tag โมเดล 3B ที่คุณต้องการจูนตรงนี้ได้เลย
FROM scb10x/typhoon-ocr1.5-3b:latest

# ลดจาก 125k → 8k เพื่อประหยัด และ ล็อกให้ตัวโมเดล + KV Cache กิน VRAM ไม่เกิน 5GB (เหลือโควตาให้ Windows อีก 3GB)
PARAMETER num_ctx 8192
PARAMETER num_predict 4096

# งานดึงข้อความจากภาพสแกน สามารถปรับค่า temperature เป็น 0 เพื่อลดการเดา/มโนคำภาษาไทย
PARAMETER temperature 0.1
PARAMETER top_p 0.1

# ป้องกันไม่ให้โมเดลพิมพ์อักษรซ้ำซากเวลาเจอจุดที่ภาพเบลอหรือรอยเปื้อนบนกระดาษ
PARAMETER repeat_penalty 1.1

# ใส่คำสั่งหลักเพื่อให้โมเดลเข้าใจบทบาทและรูปแบบผลลัพธ์ที่ต้องการ (ตัวอย่าง)
SYSTEM """You are an expert in structuring Thai documents.
Extract the information from the image in the most correct and organized format.

Instructions:
- Return ONLY clean Markdown output.
- Include ALL information visible on the page.
- Preserve document structure and hierarchy.
- Do NOT add explanations or interpretations.

Formatting Rules:
- Tables: Render tables using <table>...</table> in clean HTML format.
- Equations: Render equations using LaTeX syntax with inline ($...$) and block ($$...$$).
- Images/Charts/Diagrams: Wrap any clearly defined visual areas in:
<figure>
Describe the image's main elements, note contextual clues, mention visible text and meaning. Describe in Thai.
</figure>
- Page Numbers: Wrap page numbers in <page_number>...</page_number>.
- Checkboxes: Use ☐ for unchecked and ☑ for checked boxes.
- Signatures/Stamps: Describe location and context
- Unclear text: [unclear: context description]
"""
```

---

### 2. Model Switching Logic (BullMQ Processor)

```typescript
// Pseudo-code for BullMQ processor (ai-batch queue)
async function processJob(job: Job) {
  const { jobType, documentId } = job.data;

  if (jobType === 'ocr-extract') {
    // OCR job: unload main, load OCR, process, unload OCR
    await ollama.unloadModel('typhoon2.5-np-dms');
    await ollama.loadModel('typhoon-np-dms-ocr', { keep_alive: 0 });
    const result = await ollama.generate('typhoon-np-dms-ocr', prompt);
    // keep_alive: 0 จะ unload อัตโนมัติหลังเสร็จ

    // โหลด main model กลับเข้า VRAM สำหรับงานถัดไป
    await ollama.loadModel('typhoon2.5-np-dms');
    return result;
  }

  // Main model jobs: extraction, rag-query, ai-suggest
  const result = await ollama.generate('typhoon2.5-np-dms', prompt);
  return result;
}
```

**กฎ:**
- **n8n ห้ามเรียก Ollama โดยตรง** — ต้องผ่าน `POST /api/ai/jobs` → BullMQ เท่านั้น
- **BullMQ concurrency = 1** — ป้องกัน VRAM overflow
- **Cold start OCR:** 30-60 วินาทีต่อ job ยอมรับได้
- **OCR job ซ้อนกัน 3-5 งาน:** รวม 2-5 นาที ยอมรับได้

---

### 3. Code Changes

**ไฟล์ที่ต้องแก้ไข:**

| File | Change |
|------|--------|
| `backend/src/modules/ai/services/ai-settings.service.ts` | Hardcode `DEFAULT_MODEL = 'typhoon2.5-np-dms:latest'` |
| `backend/src/modules/ai/services/ollama.service.ts` | เพิ่ม method `unloadModel()` และ `loadModel()` สำหรับ switching |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | Implement switching logic ตาม pseudo-code ด้านบน |

**Note:** ไม่ต้อง update `ai_settings` table — ใช้ hardcode value เพื่อความเร็วในการ deploy

---

### 4. Migration Plan

**ขั้นตอนการ deploy:**

1. **Desk-5439:** สร้าง custom models บน Ollama
   ```bash
   cd /path/to/model/files
   ollama create typhoon2.5-np-dms -f ./typhoon2.5-np-dms.model.md
   ollama create typhoon-np-dms-ocr -f ./typhoon-np-dms-ocr.model.md
   ```

2. **QNAP Backend:** Deploy ด้วย code changes (ADR-033 mechanism ยังคงใช้ได้)

3. **Verification:**
   - Test OCR job → ตรวจสอบว่า unload/load ทำงานถูกต้อง
   - Test main model job → ตรวจสอบว่า main model พร้อมใช้หลัง OCR

---

### 5. Rollback Strategy

**ไม่มี automatic rollback mechanism**

หากพบปัญหา:
1. สร้าง custom model ใหม่จาก base model ตัวอื่น (เช่น กลับไป `gemma4:e2b`)
2. หรือแก้ไข `typhoon2.5-np-dms.model.md` แล้วสร้าง version ใหม่ (`:v2`)
3. Update code ให้ชี้ไป model ใหม่ แล้ว redeploy

---

## Impact on Related ADRs

| ADR | Section | Impact |
|-----|---------|--------|
| **ADR-023A** | Section 2.1 Model Stack | Superseded by ADR-034 — model config ใช้ค่าจากนี้ |
| **ADR-033** | VRAM Monitor + Model Switching | ยังใช้ได้ — mechanism เดิม เปลี่ยนแค่ชื่อ model |
| **ADR-032** | Typhoon OCR Integration | OCR model ถูกแทนที่โดย `typhoon-np-dms-ocr` |

---

## Glossary Updates (CONTEXT.md)

เพิ่มคำศัพท์ใหม่:

| Term | Definition |
|------|------------|
| **Thai-Optimized Model** | โมเดล AI ที่ถูก fine-tune มาสำหรับภาษาไทย (เช่น Typhoon series) |
| **Model Unload/Load** | กระบวนการยกเลิกโหลดโมเดลจาก VRAM และโหลดโมเดลใหม่เข้าไป |
| **Cold Start Penalty** | ความล่าช้า 5-15 วินาทีจากการโหลดโมเดล weights เข้า VRAM |

---

**สำหรับ Implementation:** ดูไฟล์ใน `specs/100-Infrastructures/134-AI-model-change` (สร้างเมื่อเริ่ม implement)
