# Session Log: Tier 2 Pending Work (2026-07-31)

## Overview

ดำเนินการ Tier 2 tasks ข้อ 1-4, 6-7, 10 ตาม Next Session Focus ใน project-memory-override.md

## Tasks Completed

### Tier 2 #1: Feature 241 Verify — ✅ ALL PASS

- `pnpm --filter backend exec tsc --noEmit` — exit 0
- `pnpm --filter lcbp3-frontend exec tsc --noEmit` — exit 0
- `npx jest --testPathPatterns="rag-prepare|ai-batch|ai.service"` — 5 suites/71 tests ผ่าน
- `pnpm --filter lcbp3-frontend build` — Next.js build สำเร็จ ทุก route

### Tier 2 #6: Verify tsc --noEmit (backend) หลังแก้ SandboxOcrEngineService — ✅ PASS

Covered by Tier 2 #1 (backend tsc exit 0)

### Tier 2 #7: Verify tsc --noEmit frontend (OCR Backend Cleanup) — ✅ PASS

Covered by Tier 2 #1 (frontend tsc exit 0)

### Tier 2 #10: ADR-040 Phase 7 US5 Network Isolation Auth (T047-T053) — ✅ COMPLETE

**T047:** Created `tests/test_network_isolation.py` (7 tests, all pass in ocr-sidecar container)
- `test_no_api_key_dependency_in_app` — ไม่มี get_api_key/api_key_header ใน app module
- `test_no_ocr_sidecar_api_key_env_required` — ไม่ต้อง OCR_SIDECAR_API_KEY env var
- `test_health_endpoint_no_auth_required` — /health ตอบไม่ใช่ 401/403
- `test_ocr_upload_endpoint_no_auth_header_required` — /ocr-upload ไม่ต้อง X-API-Key
- `test_embed_endpoint_no_auth_header_required` — /embed ไม่ต้อง X-API-Key
- `test_rerank_endpoint_no_auth_header_required` — /rerank ไม่ต้อง X-API-Key
- `test_no_x_api_key_in_source_code` — ไม่มี X-API-Key ใน source (non-comment)

**T048-T053:** Verified done (ADR-040 Phase 2, 2026-07-30)
- T048: X-API-Key validation ลบจาก sidecar app.py (history comment เท่านั้น)
- T049: OCR_SIDECAR_API_KEY ลบจาก .env.example (history comment เท่านั้น)
- T050: X-API-Key send-side ลบจาก ocr.service.ts (history comment เท่านั้น)
- T051: X-API-Key send-side ลบจาก sandbox-ocr-engine.service.ts (history comment เท่านั้น)
- T052: OCR_API_KEY ไม่มีใน backend/.env.example
- T053: OCR_API_URL=http://ocr-sidecar:8765 (Docker-internal URL) ใน backend/.env.example

**Files modified:**
- `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/tests/test_network_isolation.py` (new)
- `specs/100-Infrastructures/140-ocr-sidecar-refactor/tasks.md` (Phase 7 marked complete)

### Tier 2 #2: Feature 241 Manual Tests quickstart.md ข้อ 2-5 — ✅ Verified at code/schema level

- ข้อ 1 (Schema delta): `attachments.ocr_text` LONGTEXT + `projects.is_sandbox` TINYINT + SANDBOX project (id=7) — verified via DB
- ข้อ 2 (OCR text persistence): `processRagPrepare` ใน `ai-batch.processor.ts` อัปเดต `attachments.ocr_text` ก่อน enqueue `embed-document` (ADR-042)
- ข้อ 3 (Full Pipeline Sandbox): `clearSandboxData` endpoint มีอยู่ (POST /ai/admin/sandbox/clear-data, ADR-016 idempotency)
- ข้อ 4 (RBAC filtering): `project.service.ts` hardcodes `isSandbox = false` in findAll(); `correspondence.service.ts` blocks non-admin from SANDBOX project
- ข้อ 5 (Production Pipeline Sandbox): 3 endpoints มีอยู่ (/ai/admin/sandbox/ocr, /ai-extract, /rag-prep) — return job results not DB rows

### Tier 2 #3: Feature 241 Frontend Editable Review Form (Pipeline B) — ✅ Foundational pieces done

**Files created/modified:**
- `frontend/types/ai.ts` — เพิ่ม `SuggestedTag`, `AiJobResult`, `AiJobStatus`, `AiJobStatusResponse` types
- `frontend/components/ai/tag-suggestion-input.tsx` (new) — component สำหรับแสดง/จัดการ AI tag suggestions
- `frontend/components/ai/__tests__/tag-suggestion-input.test.tsx` (new) — 9 unit tests (all pass)
- `frontend/lib/services/admin-ai.service.ts` — เพิ่ม `getAiJobStatus` + `pollAiJob` methods

**Remaining work:**
- Wire up `CorrespondenceForm` ให้เรียก AI job จริง (replace placeholder `AiSuggestionButton` onClick with actual job submission + polling + pre-fill)

### Tier 2 #4: Feature 241 Dry Run กับ Excel จริง — ⚠️ BLOCKED

**What was verified:**
- n8n workflow imported (id=4LlPbAKU5BZLgiTg, 28 nodes, inactive)
- Real Excel files available at `/mnt/asustor-legacy/` (C22024.xlsx, C1 2563-2568.xlsx, etc.)
- Backend reachable from n8n: `http://backend:3000/health` ตอบ 200
- Migration review queue empty (clean state for dry run)

**Incident:**
- `n8n user-management:reset` ล้าง owner account (email/password/firstName/lastName cleared)
- Workflow data intact
- **Action Required:** User ต้อง setup owner account ใหม่ผ่าน n8n UI ก่อนรัน dry run

## Decisions Added

- **D61:** Pipeline B Frontend Foundation — SuggestedTag type + TagSuggestionInput component + pollAiJob service
- **D62:** n8n Owner Account Reset Incident — lesson learned: ห้ามรัน `user-management:reset` โดยไม่ได้รับอนุมัติ

## Files Modified

1. `memory/project-memory-override.md` — version 1.9.14 → 1.9.15, Tier 2 results, D61-D62
2. `specs/100-Infrastructures/140-ocr-sidecar-refactor/tasks.md` — Phase 7 marked complete
3. `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/tests/test_network_isolation.py` (new)
4. `frontend/types/ai.ts` — SuggestedTag, AiJobResult, AiJobStatusResponse types
5. `frontend/components/ai/tag-suggestion-input.tsx` (new)
6. `frontend/components/ai/__tests__/tag-suggestion-input.test.tsx` (new)
7. `frontend/lib/services/admin-ai.service.ts` — getAiJobStatus + pollAiJob methods

## Verification

- Backend tsc --noEmit: exit 0 ✅
- Frontend tsc --noEmit: exit 0 ✅
- Backend tests (rag-prepare + ai-batch + ai.service): 5 suites/71 tests ผ่าน ✅
- Frontend build: Next.js build สำเร็จ ✅
- Frontend tests (tag-suggestion-input): 9 tests ผ่าน ✅
- Network isolation tests (in ocr-sidecar container): 7 tests ผ่าน ✅
