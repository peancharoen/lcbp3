# Session 2026-06-20 — OCR Backend Cleanup (Legacy Alias Removal)

## Summary

ทำความสะอาด backend code ให้ใช้ canonical naming อย่างสม่ำเสมอ: เปลี่ยน `typhoon-llm` → `np-dms-ai`, ลบ `tesseract` references ทั้งหมด, และ apply recommended fixes (P1–P3) จาก code review

## การเปลี่ยนแปลง (Fix)

### P1: Critical Fixes

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/services/ocr.service.ts` | P1-1: ลบ `keep_alive` ออกจาก multipart form data (sidecar คำนวณ internally); P1-2: ลบ hardcoded API key default — throw ถ้า `OCR_SIDECAR_API_KEY` ไม่ set; เปลี่ยน `processWithTyphoon` → `processWithNpDmsOcr`, `processWithTesseract` → `processWithFastPath`; audit log model names เปลี่ยนเป็น `fast-path`/`pymupdf` และ `np-dms-ocr` |
| `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts` | P1-2: ลบ hardcoded API key default — throw ถ้า `OCR_SIDECAR_API_KEY` ไม่ set; ลบ `'tesseract'` ออกจาก `SandboxOcrEngineType`; อัปเดต routing condition และ fallback comments |

### P2: Important Fixes

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/.env.example` | P2-1: `OCR_API_KEY` → `OCR_SIDECAR_API_KEY` (align กับ code); P2-2: OCR URL `192.168.10.8` → `192.168.10.100` (Desk-5439); ลบ `THAI_PREPROCESS_URL` (endpoint deleted in ADR-040 Phase 8); comment "PaddleOCR" → "np-dms-ocr" |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/Dockerfile` | P2-5: `python:3.10-slim` → `python:3.11-slim` |

### P3: Medium Priority

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py` | P3-1/P3-2: Wrap sync VRAM calls ใน `asyncio.to_thread()` — `calculate_ocr_residency()` ใน `process_ocr`, `get_vram_headroom()` ใน `/embed` และ `/rerank` |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/services/residency_policy.py` | อัปเดต comment "Typhoon OCR" → "np-dms-ocr" |

### typhoon-llm → np-dms-ai Rename

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/processors/np-dms-ai.processor.ts` | **สร้างใหม่** — `NpDmsAiProcessor`, `QUEUE_NP_DMS_AI = 'np-dms-ai'`, `NpDmsAiJobData`, Redis key `ai:np-dms-ai:llm:`, audit `aiModel: 'np-dms-ai'` |
| `backend/src/modules/ai/processors/typhoon-llm.processor.ts` | **ลบ** — แทนที่ด้วย `np-dms-ai.processor.ts` |
| `backend/src/modules/ai/ai.module.ts` | เปลี่ยน import จาก `typhoon-llm.processor` → `np-dms-ai.processor`; queue name `QUEUE_TYPHOON_LLM` → `QUEUE_NP_DMS_AI`; provider `TyphoonLlmProcessor` → `NpDmsAiProcessor` |

### Tesseract Cleanup

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/entities/ocr-engine-configuration.entity.ts` | `TESSERACT` → `FAST_PATH`, `TYPHOON_OCR` → `NP_DMS_OCR` ใน enum |
| `backend/src/modules/ai/ai.controller.ts` | ลบ `'tesseract'` ออกจาก Swagger enum และ `validEngineTypes` |
| `backend/src/modules/ai/entities/ai-audit-log.entity.ts` | อัปเดต comment examples: `tesseract` → `fast-path`, `typhoon-ocr-3b` → `np-dms-ocr` |

### Test Files Updated

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/services/sandbox-ocr-engine.service.spec.ts` | ลบ tesseract test block; อัปเดต `engineUsed` expectations จาก `'tesseract'` → `'fast-path'`; อัปเดต fallback test descriptions และ mock text |

### User Manual Changes (หลัง session)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/processors/typhoon-ocr.processor.ts` | **ลบโดย user** — renamed ไป `np-dms-ocr-processor.ts` |
| `backend/src/modules/ai/processors/np-dms-ocr-processor.ts` | **สร้างโดย user** — renamed file; class name ยังเป็น `TyphoonOcrProcessor` และ queue `QUEUE_TYPHOON_OCR` |
| `backend/src/modules/ai/ai.module.ts` | User อัปเดต import path เป็น `./processors/np-dms-ocr-processor` |

## กฎที่ Lock แล้ว

- **Canonical naming:** `np-dms-ai` (LLM processor/queue), `np-dms-ocr` (OCR engine), `fast-path` (PyMuPDF text layer) — ไม่ใช้ `typhoon-llm`, `tesseract`, หรือ `Typhoon OCR` ใน code ใหม่
- **API Key:** `OCR_SIDECAR_API_KEY` เป็น mandatory env var — ห้ามมี hardcoded default
- **keep_alive:** Backend ไม่ส่ง `keep_alive` ใน form data — sidecar คำนวณผ่าน `calculate_ocr_residency()` เท่านั้น
- **VRAM calls:** Sync VRAM/residency calls ใน async endpoints ต้อง wrap ใน `asyncio.to_thread()`

## Remaining Work (Next Session)

- [ ] **Rename `TyphoonOcrProcessor` → `NpDmsOcrProcessor`** ใน `np-dms-ocr-processor.ts` (class name + queue constant `QUEUE_TYPHOON_OCR` → `QUEUE_NP_DMS_OCR`)
- [ ] **อัปเดต `ai.module.ts`** import ให้ใช้ `NpDmsOcrProcessor` และ `QUEUE_NP_DMS_OCR`
- [ ] **อัปเดต `typhoon-ocr.processor.spec.ts`** ถ้ามี — rename และ update references
- [ ] **tsc --noEmit verification** หลัง rename ครบ
- [ ] **Backend build** เพื่อยืนยันไม่มี broken imports

## Verification

- [ ] `pnpm --filter backend exec tsc --noEmit` — ยังไม่ได้รัน (pending rename TyphoonOcrProcessor)
- [ ] Backend unit tests — ยังไม่ได้รัน
- [ ] Python tests — ยังไม่ได้รันหลัง asyncio.to_thread changes
