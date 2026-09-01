# Session 2026-09-01 (OCR Leakage Root Cause + Tag.public_id Consolidation)

## Summary

แก้ root cause จริงของ OCR prompt leakage ใน legacy migration (QC-0001/QC-0002) และ consolidate duplicate Tag entities ที่ทำให้ AI enrichment ล้มเหลวด้วย `Unknown column 'Tag.public_id'`

## ปัญหาที่พบ (Root Cause)

### 1. OCR Prompt Leakage (QC-0001/QC-0002)

**อาการ:** OCR output มีแต่ prompt ที่ model พูดซ้ำ (echo training prompt format) แทนเนื้อหาเอกสารจริง

**Root cause จริง:** Ollama OpenAI-compatible endpoint (`/v1/chat/completions`) มี bug — การส่ง param ใดๆ ใน payload (เช่น `temperature`, `top_p`) จะทำให้ Ollama reset Modelfile params อื่นๆ (เช่น `top_p=0.6`, `num_ctx=16384`) เป็น Ollama defaults แทนที่จะใช้ค่าจาก Modelfile ทำให้ model อ่าน image ไม่ออกและ echo training prompt format

**สิ่งที่ไม่ใช่ root cause:**
- ไม่ใช่ prompt construction (system/user separation ถูกต้อง)
- ไม่ใช่ Redis prompt cache (ทำงานปกติหลัง fix env-file)
- ไม่ใช่ KV cache ค้าง (Ollama restart + clear Redis hash แล้วยังเกิด)

### 2. Redis Connection Failure

Sidecar compose ไม่ได้ใช้ `--env-file ../../.env` ทำให้ `REDIS_PASSWORD` ไม่ถูก interpolate → `REDIS_URL=redis://:@cache:6379/0` → `Authentication required`

### 3. Tag.public_id Schema Mismatch

มี **2 Tag entities** สำหรับตาราง `tags` เดียวกัน:
- `master/entities/tag.entity.ts` — ไม่มี `public_id` (ใช้ใน correspondence, master modules)
- `tags/entities/tag.entity.ts` — มี `public_id` (ใช้ใน tags, migration modules)

Live DB ไม่มี `public_id` column → TypeORM query ผ่าน entity ที่มี `public_id` ล้มเหลวด้วย `Unknown column 'Tag.public_id' in 'SELECT'`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `/opt/np-dms/04-ai/ocr-sidecar/app.py` | ไม่ส่ง runtime params ไป Ollama (ให้ Modelfile defaults ทำงาน); เพิ่ม leakage detection (กรอง model output ที่ echo training prompt); normalize `\r\n` line endings; ลบ debug instrumentation |
| `/opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/app.py` | Sync จาก live (commit `5858e3a2`) |
| Live DB: `tags` table | `ALTER TABLE tags ADD COLUMN public_id CHAR(36) NOT NULL UNIQUE` + backfill existing row ด้วย UUIDv7 |
| `backend/src/modules/tags/entities/tag.entity.ts` | Consolidate — เพิ่ม `project` relation (จาก master entity) |
| `backend/src/modules/master/master.module.ts` | Import `Tag` จาก `tags/entities/` แทน `master/entities/` |
| `backend/src/modules/master/master.service.ts` | Import `Tag` จาก `tags/entities/` แทน `master/entities/` |
| `backend/src/modules/correspondence/correspondence.module.ts` | Import `CorrespondenceTag` จาก `tags/entities/` แทน `correspondence/entities/` |
| `backend/src/modules/correspondence/correspondence.service.ts` | Import `CorrespondenceTag` + `Tag` จาก `tags/entities/` แทน `master/entities/` |
| `backend/src/modules/correspondence/correspondence.service.spec.ts` | Import `CorrespondenceTag` จาก `tags/entities/` แทน `correspondence/entities/` |
| `backend/src/modules/master/entities/tag.entity.ts` | **ลบ** (duplicate entity) |
| `backend/src/modules/correspondence/entities/correspondence-tag.entity.ts` | **ลบ** (duplicate entity) |

## กฎที่ Lock แล้ว

- **D199:** Ollama OpenAI-compatible endpoint bug — การส่ง param ใดๆ ใน payload จะ reset Modelfile params อื่นๆ เป็น Ollama defaults → แก้โดยไม่ส่ง runtime params ไป Ollama เลย (ให้ Modelfile defaults ทำงาน)
- **D200:** Sidecar compose ต้องใช้ `--env-file ../../.env` เสมอ เพื่อ interpolate `REDIS_PASSWORD` เข้า `REDIS_URL`
- **D201:** ต้องมี Tag entity เดียวสำหรับตาราง `tags` (consolidated ที่ `tags/entities/tag.entity.ts`) — ห้ามสร้าง duplicate entity สำหรับตารางเดียวกัน
- **D202:** Leakage detection ใน sidecar กรอง model output ที่ echo training prompt markers (`Extract all text from the image`, `Only return the clean Markdown`, ฯลฯ) → คืน empty string + log warning
- **D203:** Normalize `\r\n` → `\n` ใน systemPrompt/userPrompt ก่อนส่งให้ typhoon_ocr (backend อาจส่ง Windows line endings)

## Verification

- [x] Direct sidecar test: QC-0001.pdf maxPages=1 → 2397 chars clean OCR output (no leakage)
- [x] Direct sidecar test: 00-test.pdf maxPages=1 → 3032 chars clean OCR output
- [x] Direct sidecar test: QC-0001.pdf maxPages=3 → 2131 chars clean OCR output
- [x] Sidecar logs: `Redis client connected for prompt cache invalidation`
- [x] Sidecar logs: `systemPrompt changed — forcing model unload` (prompt change triggers unload)
- [x] Sidecar logs: `prompt unchanged — skipping unload` (same prompt keeps residency)
- [x] Backend logs: `Tag.public_id` error หายไป (เหลือแค่ OCR_FAILED จาก leakage ที่แยกต่างหาก)
- [x] DB: `tags.public_id` column exists + backfilled (1 row: `01a05d5a-abf8-729d-b167-c0046826a6cd`)
- [x] Backend build: ผ่าน
- [x] Backend lint: ผ่าน
- [x] Backend tests: 2254 passed, 0 failed
- [x] Re Extract button visible และ clickable บน `/admin/migration/review/[id]`
- [x] Commit `5858e3a2` (sidecar fix) + `ed17d049` (Tag consolidation)
- [ ] Backend Re-Extract ผ่าน browser ยังคืน OCR_FAILED (leakage ยังเกิดบางหน้า — ดู "ปัญหาที่ยังเหลือ" ด้านล่าง)

## ปัญหาที่ยังเหลือ (Follow-up)

### OCR leakage บางหน้าของ QC-0001

Direct sidecar test (manual unload + clear Redis hash) ได้ clean output แต่ backend Re-Extract ยังคืน leakage บางหน้า สาเหตุที่เป็นไปได้:
- Stale prompt hash ใน Redis ทำให้ sidecar skip unload แม้ model state ค้าง
- Model behavior sensitive to specific page content (บางหน้าทำให้ model echo training prompt)

**แนวทางแก้:**
- เพิ่ม logic ใน sidecar ให้ unload model เมื่อ leakage detected (force fresh load ครั้งถัดไป)
- หรือเพิ่ม retry logic ใน sidecar (unload + retry ครั้งเดียวเมื่อ leakage detected)
