# Session 2026-09-01 — OCR Prompt Leakage + Re Extract UI + Prompt Hot-Load

## Summary

ทำตามลำดับ Phase 1 → Phase 4 → Phase 2 ตามที่ผู้ใช้ระบุ:
- ทดสอบ prompt ต่อ sidecar/Ollama จริงเพื่อหาโครงสร้าง system/user message ที่ถูกต้อง
- แก้ไข OCR sidecar ให้แยก system prompt และ user prompt เป็น OpenAI-compatible roles
- แก้ prompt hash ให้ครอบคลุม effective prompt (system + user + dms tags) เพื่อ hot-load/unload
- เพิ่ม Re Extract UI บนหน้า `/admin/migration/review/[id]`
- คงการตัดสินใจไม่ restore `source_file_path` ของ QC-0001/QC-0002 (Phase 3 ต่อจากครั้งก่อน)
- รัน verification ทั้ง frontend, backend, sidecar; commit ผ่าน pre-commit hooks

## ปัญหาที่พบ (Root Cause)

1. **OCR prompt leakage**: `np-dms-ocr` คืนข้อความ OCR instruction ("Extract all text from the image...") ในผลลัพธ์ QC-0001/QC-0002 เนื่องจาก sidecar แทรก `systemPrompt` เข้าไปใน user message เดียวกับรูปภาพ และมีกรณีที่ user message ขาดข้อความคำสั่นจน model fallback ไป echo Modelfile default
2. **Re Extract ไม่เห็น/ใช้ไม่ได้**: backend endpoint `/re-extract` มีอยู่แล้ว แต่หน้า review detail ไม่มีปุ่ม Re Extract สำหรับ item ที่ `PENDING_REVIEW` หรือ `aiStatus=FAILED`
3. **Prompt hot-load**: prompt cache hash เดิมคำนวณจาก `systemPrompt` อย่างเดียว ไม่ครอบ `userPrompt` หรือ DMS tags ทำให้ prompt เปลี่ยนแล้วอาจไม่ unload model
4. **Preview หาย (Phase 3)**: `updateQueueEnrichment` ทำ `details = data.details` แทน merge ทำให้ `source_file_path` หายตอน AI ล้ม

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | -------------- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/app.py` | แยก `system` message / `user` message; `systemPrompt` อยู่ `system` role; `userPrompt` (หรือ typhoon_ocr default) อยู่ `user` role คู่กับ image; รับ `userPrompt` form field ใหม่ |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/services/prompt_cache.py` | `check_and_unload_if_changed` รับ `effective_prompt` (system+user+dms) แทน hash เฉพาะ system prompt |
| `backend/src/modules/ai/services/ocr.service.ts` | ส่ง `systemPrompt` จาก `ocr_system` และพยายามดึง `ocr_user` prompt type ส่งเป็น `userPrompt` |
| `backend/src/modules/migration/migration.service.ts` | `updateQueueEnrichment` merge `details` แทน replace |
| `backend/src/modules/migration/migration.service.spec.ts` | Regression test: source_file_path รอดจาก enrichment failure |
| `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | เพิ่ม `handleReExtract` + ปุ่ม Re Extract สำหรับ `PENDING_REVIEW`/`FAILED` |
| `frontend/lib/services/migration.service.ts` | เพิ่ม `reExtractQueueItem()` |
| `frontend/hooks/use-migration-review.ts` | เพิ่ม `useReExtractQueueItem()` mutation + cache invalidation |
| `frontend/components/migration/__tests__/review-detail-page.test.tsx` | เพิ่ม mock `useReExtractQueueItem` |

## กฎที่ Lock แล้ว

- **D196**: OCR user message ต้องมีข้อความคำสั่น (typhoon_ocr structure prompt หรือ `ocr_user` custom prompt) คู่กับ image ไม่อย่างงั้น model จะ echo Modelfile default instruction
- **D197**: Prompt cache hash ต้องครอบ effective prompt ทั้งหมด: `systemPrompt` + `userPrompt` + DMS tags เพื่อให้ prompt เปลี่ยนแล้ว unload model ถูกต้อง และ unchanged prompt ไม่ unload
- **D198**: Re Extract แสดงบนหน้า review detail สำหรับ `PENDING_REVIEW` หรือ `aiStatus=FAILED`; ไม่ต้อง restore `source_file_path` เก่าของ QC-0001/QC-0002

## Verification

- ✅ `backend` build (`nest build`)
- ✅ `backend` lint (`pnpm --filter backend lint:ci`)
- ✅ `backend` focused tests — 54 suites passed / 2 skipped, 960 tests passed
- ✅ `frontend` build (`pnpm --filter lcbp3-frontend build`)
- ✅ `frontend` tests (`pnpm --filter lcbp3-frontend test run`) — 143 passed, 993 tests passed
- ✅ sidecar `prompt_cache.py` tests — 16 passed
- ✅ sidecar `/ocr-upload` ทดสอบด้วย test PDF → ไม่มี prompt echo
- ✅ sidecar `/health` 200
- ✅ git commit `d70eb697` ผ่าน pre-commit hooks

## สิ่งต้องทำต่อ (Next)

- [ ] restart backend container เพื่อให้ `OcrService` ใหม่มีผล
- [ ] deploy frontend ตาม Gitea Actions workflow
- [ ] ตรวจสอบ OCR output ของ QC-0001/QC-0002 หลัง Re Extract จริง
- [ ] สร้าง `ocr_user` prompt type ใน AI Admin Console ถ้าต้องการปรับ user prompt โดยไม่แตะ sidecar
- [ ] ลบไฟล์ untracked `00-test.pdf` และ `patches/00-test.pdf` ถ้าไม่ใช้
