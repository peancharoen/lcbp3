# Session — 2026-06-20 (Canonical Naming Cleanup — Typhoon → np-dms)

## Summary

ทำความสะอาด "Typhoon" references ที่เหลืออยู่ใน backend code ทั้งหมด หลังจากการ rename ไฟล์และ class ใน session ก่อนหน้า ครอบคลุม comments, log messages, Swagger descriptions, JSDoc, test mocks และ default model names รวม 15+ ไฟล์

## ปัญหาที่พบ (Root Cause)

- หลังจาก rename `TyphoonOcrProcessor` → `NpDmsOcrProcessor` และ `QUEUE_TYPHOON_OCR` → `QUEUE_NP_DMS_OCR` ในไฟล์หลัก ยังมี "Typhoon" ค้างอยู่ใน comments, log messages, constants, test mocks และ Swagger descriptions
- `vram-monitor.service.ts` มี duplicate condition หลังจาก replace `typhoon2.5-np-dms` → `np-dms-ai` (ทั้งสองฝั่งเป็น `np-dms-ai` ซ้ำกัน)
- Test mocks ใช้ model name `typhoon2.5-np-dms:latest` ซึ่งไม่ตรงกับ canonical name ปัจจุบัน

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `processors/np-dms-ocr-processor.ts` | `TYPHOON_OCR_REQUIRED_VRAM_MB` → `NP_DMS_OCR_REQUIRED_VRAM_MB`, log messages Typhoon OCR → np-dms-ocr, JSDoc |
| `processors/np-dms-ai.processor.ts` | default model `typhoon2.5-np-dms:latest` → `np-dms-ai:latest`, JSDoc |
| `processors/ai-batch.processor.ts` | log messages Typhoon OCR → np-dms-ocr, comments |
| `services/vram-monitor.service.ts` | model matching `typhoon2.5-np-dms` → `np-dms-ai`, ลบ duplicate condition |
| `services/ollama.service.ts` | comments Typhoon → np-dms-ai (4 จุด) |
| `services/ocr-cache.service.ts` | comments Typhoon OCR → np-dms-ocr |
| `services/embedding.service.ts` | JSDoc + log typhoon2.5 → np-dms-ai |
| `services/sandbox-ocr-engine.service.ts` | comment Typhoon OCR → np-dms-ocr |
| `services/ocr.service.ts` | comments Typhoon OCR → np-dms-ocr (2 จุด) |
| `interfaces/ocr-residency.interface.ts` | JSDoc Typhoon OCR → np-dms-ocr |
| `ai.module.ts` | comment Typhoon OCR → np-dms-ocr |
| `ai.controller.ts` | Swagger descriptions Typhoon OCR → np-dms-ocr (3 จุด) |
| `entities/ai-model-configuration.entity.ts` | Swagger example typhoon2.1-gemma3-4b → np-dms-ai/np-dms-ocr |
| `entities/ocr-engine-configuration.entity.ts` | comment เพิ่ม canonical naming note |
| `dto/add-ai-model.dto.ts` | Swagger example typhoon2.1-gemma3-4b → np-dms-ai/np-dms-ocr |
| `tests/ai-policy.service.spec.ts` | mock `typhoon2.5-np-dms:latest` → `np-dms-ai:latest` |
| `tests/vram-monitor.service.spec.ts` | mock `typhoon2.5-np-dms:latest` → `np-dms-ai:latest` (3 จุด) |
| `tests/ai.service.spec.ts` | mock `typhoon2.5-np-dms:latest` → `np-dms-ai:latest` (2 จุด) |
| `tests/ai-rag.service.spec.ts` | mock `typhoon2.5-np-dms:latest` → `np-dms-ai:latest` (2 จุด) |
| `services/sandbox-ocr-engine.service.spec.ts` | mock data + assertion `extracted from typhoon` → `extracted from np-dms-ocr` |

## กฎที่ Lock แล้ว

- **D28 (existing):** Canonical naming: `np-dms-ai` (LLM), `np-dms-ocr` (OCR), `fast-path` (PyMuPDF)
- **D29 (new):** ครบทุก "Typhoon" reference ใน backend `src/` ถูกแทนที่ด้วย canonical name แล้ว — เหลือเฉพาะใน historical change log comments ที่บันทึกวันที่เปลี่ยน (ไม่ต้องแก้)

## Verification

- [x] `tsc --noEmit` — exit 0 (ไม่มี errors)
- [x] Backend AI module tests — 32 suites, 299 tests ผ่านทั้งหมด (53.8s)
- [x] grep `[Tt]yphoon` ใน `backend/src/modules/ai/` — เหลือเฉพาะ historical change log comments และ `.understand-anything/knowledge-graph.json` (auto-generated)
