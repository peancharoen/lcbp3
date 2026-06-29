# Session — 2026-06-20 (OCR Sidecar Review Fixes)

## Summary

ทำ Code Review ของ `specs/100-Infrastructures/140-ocr-sidecar-refactor/` ทั้งหมด (spec, plan, tasks, data-model, quickstart, research, checklists, contracts) เทียบกับ implementation จริง พบ 3 Critical + 7 High + 6 Medium + 3 Low + 2 Suggestions จากนั้นแก้ 3 Critical issues ตาม Recommended Actions

## ปัญหาที่พบ (Root Cause)

1. **Hardcoded API Key ใน SandboxOcrEngineService** — `OCR_SIDECAR_API_KEY` มี default `'lcbp3-dms-ocr-sidecar-secure-token-2026'` ทำให้ระบบ start ได้แม้ไม่ตั้งค่า env var (FR-001 violation)
2. **API Contract ขาด Endpoints หลัก** — contract มีแค่ `/ocr` + `/health` แต่ implementation มี 4 endpoints (`/ocr-upload`, `/embed`, `/rerank` ขาด) และ field naming ผิด (snake_case แทน camelCase)
3. **Path Traversal Gap** — `/ocr-upload` (production endpoint) ไม่ใช้ `validate_pdf_path()` เพราะรับ file bytes ไม่ใช่ path แต่ spec ไม่ได้ document ไว้ ทำให้ดูเหมือน security gap

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts` | ลบ hardcoded default `'lcbp3-dms-ocr-sidecar-secure-token-2026'` เปลี่ยนเป็น fail-fast `throw new Error` เมื่อ `OCR_SIDECAR_API_KEY` ไม่ถูกตั้งค่า (matching `OcrService` pattern) |
| `specs/100-Infrastructures/140-ocr-sidecar-refactor/contracts/sidecar-api.md` | Rewrite contract v1.1: เพิ่ม `/ocr-upload`, `/embed`, `/rerank` endpoints; แก้ field naming เป็น camelCase; แก้ response schema ให้ตรง implementation (pageCount, charCount, engineUsed); แก้ health response; แก้ error format เป็น FastAPI default `{"detail":"..."}`; เพิ่ม Path Traversal Safety section สำหรับ `/ocr-upload`; mark `/ocr` เป็น legacy |

## กฎที่ Lock แล้ว

- **D30**: API Contract ต้อง match actual implementation — ห้ามเขียน contract ที่ field naming หรือ response schema ไม่ตรง Pydantic models จริง
- **D31**: `/ocr-upload` เป็น primary production endpoint — `/ocr` เป็น legacy สำหรับ shared-volume deployments เท่านั้น
- **D32**: `/ocr-upload` ปลอดภัยจาก path traversal โดย design (รับ file bytes ไม่ใช่ path) — ไม่ต้องเรียก `validate_pdf_path()`

## Verification

- [ ] `tsc --noEmit` (backend) หลังแก้ SandboxOcrEngineService
- [ ] Python unit tests ยังผ่าน (3 files: test_path_traversal, test_api_key_validation, test_residency_wiring)
- [ ] API contract fields ตรงกับ Pydantic models ใน `app.py`
