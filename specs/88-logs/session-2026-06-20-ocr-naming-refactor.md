# Session — 2026-06-20 (OCR Naming Refactor: typhoon → np-dms-ocr)

## Summary

ทำการ refactor naming conventions ที่เกี่ยวข้องกับ OCR engine จาก "typhoon" เป็น "np-dms-ocr" ทั้ง backend และ frontend อย่างครบถ้วน รวมถึงการ cleanup Tesseract references ที่เหลืออยู่ใน test files และ source code

## การเปลี่ยนแปลง (Changes)

### Backend (7 files + 3 test files)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `sandbox-ocr-engine.service.ts` | `OcrTyphoonOptions` → `OcrNpDmsOptions`, `typhoonOptions` → `ocrOptions`, log messages |
| `np-dms-ocr-processor.ts` | Import `OcrNpDmsOptions`, field `typhoonOptions` → `ocrOptions` |
| `ai.controller.ts` | `typhoonOptions` → `ocrOptions` ใน `submitSandboxOcr` |
| `ai-batch.processor.ts` | Import + all `typhoonOptions` → `ocrOptions` (5 locations) |
| `ai-queue.service.ts` | Field `typhoonOptions` → `ocrOptions` ใน payload type + job data |
| `ocr.service.ts` | `OcrDetectionInput.typhoonOptions` → `ocrOptions`, override logic |
| `ai.module.ts` | Change log comment: `TyphoonOcrProcessor` → `NpDmsOcrProcessor` |
| `ai-batch.processor.spec.ts` | Test assertion: `typhoonOptions` → `ocrOptions` |
| `ocr.service.spec.ts` | Test input: `typhoonOptions` → `ocrOptions` |
| `sandbox-ocr-engine.service.spec.ts` | Test description: `typhoonOptions` → `ocrOptions` |

### Frontend (7 files)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `admin-ai.service.ts` | Param `typhoonOptions` → `ocrOptions` ใน `submitSandboxOcr` |
| `OcrSandboxPromptManager.tsx` | State vars `typhoon*` → `ocr*`, UI label "Typhoon OCR Options" → "OCR Options", engineType mapping `tesseract` → `fast_path` → `auto`, ลบ dead `typhoon_ocr` check, fallback label "Tesseract" → "Fast Path (OCR)" |
| `OcrEngineSelector.tsx` | `isTyphoon` → `isAiPowered`, ลบ dead `typhoon_ocr` check |
| `SandboxTestArea.tsx` | UI labels "Typhoon OCR" → "np-dms-ocr" |
| `page.tsx` | ลบ `name.includes('typhoon')` 4 จุด, เปลี่ยน `name.includes('ocr')` → `name.includes(OCR_MODEL_NAME)` 4 จุด |
| `ocr-engine-selector.test.tsx` | Mock Tesseract → Fast Path (PyMuPDF), assertions อัปเดต |
| `OcrEngineSelector.test.tsx` | Mock Tesseract → Fast Path (PyMuPDF), assertions อัปเดต |
| `ocr-sandbox-prompt-manager.test.tsx` | Mock `engineType: 'typhoon_ocr'` → `'np_dms_ocr'` |

## กฎที่ Lock แล้ว

- **D28 (เดิม):** Canonical naming: `np-dms-ai` (LLM), `np-dms-ocr` (OCR), `fast-path` (PyMuPDF) — ครบทุก layer แล้ว
- **เพิ่มเติม:** Frontend model name normalization ใช้ constants `OCR_MODEL_NAME` และ `MAIN_MODEL_NAME` เท่านั้น — ห้าม hardcoded strings
- **เพิ่มเติม:** Backend `OcrEngineType` enum มีแค่ `FAST_PATH` และ `NP_DMS_OCR` — ไม่มี `TESSERACT` หรือ `TYPHOON_OCR` แล้ว

## Verification

- [ ] `pnpm --filter backend exec tsc --noEmit` — ยังไม่ได้รัน
- [ ] `pnpm --filter lcbp3-frontend exec tsc --noEmit` — ยังไม่ได้รัน
- [ ] Backend unit tests — ยังไม่ได้รัน
- [ ] Frontend unit tests — ยังไม่ได้รัน
- [x] `grep_search` สำหรับ `typhoon|Typhoon|TYPHOON` ใน frontend — เหลือเฉพาะ change log comments
- [x] `grep_search` สำหรับ `tesseract|Tesseract` ใน frontend — เหลือเฉพาะ change log comments
- [x] `grep_search` สำหรับ `typhoonOptions|OcrTyphoonOptions|QUEUE_TYPHOON_OCR|TyphoonOcrProcessor` ใน backend — ไม่พบ
