# Session 2026-07-30 #3 — ADR-040 Phase 2 (T016-T018): X-API-Key Removal

## Summary

ลบ `X-API-Key` authentication ออกจาก OCR sidecar และ backend ทั้งหมด เปลี่ยนเป็น Docker-internal network isolation ตาม ADR-040 D6 Phase 2 (ADR-041 consolidation complete — ทุก services อยู่บน single Docker host แล้ว)

## ปัญหาที่พบ (Root Cause)

### 1. ADR-041 T016 contradiction (จาก Review Pass ก่อนหน้า)
ADR-041 T016 ระบุสถานะ `✅ Done` แต่ git history และ code verification พบว่า:
- `app.py:129-135` — sidecar ยังคง validate `X-API-Key`
- `ocr.service.ts:311,378,493,560,587` — backend ยังคงส่ง `X-API-Key`
- `sandbox-ocr-engine.service.ts:174` — sandbox ยังคงส่ง `X-API-Key`
- ไม่มี commit ใดลบออก — สถานะ Done ถูก mark ก่อน implementation จริง

### 2. Pre-existing syntax corruption
- `ai-batch.processor.ts:1711` — มี `} }` ซ้ำเกิน (pre-existing from previous session)
- `ocr.service.ts:545` — axios.post embed call ถูกทำลายระหว่าง edit (merge ผิด)

## การแก้ไข (Fix)

### Code Changes (3 files)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `specs/04-.../04-ai/ocr-sidecar/app.py` | ลบ `get_api_key()`, `APIKeyHeader`, `Security`/`Depends` imports, `OCR_SIDECAR_API_KEY` env var check, `Depends(get_api_key)` จาก 4 endpoints (`/ocr`, `/ocr-upload`, `/embed`, `/rerank`) |
| `backend/src/modules/ai/services/ocr.service.ts` | ลบ `ocrSidecarApiKey` field, env var validation, และ 5 `X-API-Key` headers (health, 2x ocr-upload, embed, rerank) |
| `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts` | ลบ `ocrSidecarApiKey` field, env var validation, และ 1 `X-API-Key` header (ocr-upload) |

### Config/Env Changes (6 files)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `04-ai/ocr-sidecar/docker-compose.yml` | ลบ `OCR_SIDECAR_API_KEY` env + comment |
| `03-application/docker-compose.yml` | ลบ `OCR_SIDECAR_API_KEY` env (required check) |
| `.env.template` | ลบ `OCR_SIDECAR_API_KEY` line |
| `04-ai/ocr-sidecar/.env.example` | ลบ `OCR_SIDECAR_API_KEY` line |
| `backend/.env.example` | ลบ `OCR_SIDECAR_API_KEY` line + อัปเดต OCR_API_URL เป็น Docker internal |
| `MIGRATION-PLAN.md` | ลบ sed command + env table entry |

### Test Changes (9 files)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `tests/unit/ocr-sidecar/test_api_key_validation.py` | **ลบไฟล์** (feature ไม่มีแล้ว) — `git rm` |
| `tests/unit/ocr-sidecar/test_path_traversal.py` | ลบ `OCR_SIDECAR_API_KEY` env + `X-API-Key` headers |
| `tests/unit/ocr-sidecar/test_residency_wiring.py` | ลบ `X-API-Key` header |
| `tests/integration/ocr-sidecar/test_cpu_fallback.py` | ลบ `X-API-Key` headers |
| `tests/integration/ocr-sidecar/test_parameter_governance.py` | ลบ `X-API-Key` header |
| `tests/integration/ocr-sidecar/test_active_prompt.py` | ลบ `X-API-Key` header |
| `04-ai/ocr-sidecar/tests/test_retrieval_fallback.py` | ลบ `OCR_SIDECAR_API_KEY` env + `API_HEADERS` + `get_api_key` import |
| `backend/.../sandbox-ocr-engine.service.spec.ts` | ลบ `OCR_SIDECAR_API_KEY` จาก mock + เปลี่ยน X-API-Key assertion → timeout assertion + แก้ 2 pre-existing engineUsed assertions ('fast-path' → 'np-dms-ocr') |
| `backend/.../ocr.service.spec.ts` + `ocr-residency.spec.ts` | ลบ `OCR_SIDECAR_API_KEY` จาก mock config |

### Documentation Changes (7 files)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `docs/ocr-sidecar-curl-testing-guide.md` | ลบ X-API-Key จากตาราง + ทุก curl examples (bash + PowerShell) + troubleshooting |
| `04-ai/ocr-sidecar/README.md` | ลบ `OCR_SIDECAR_API_KEY` env row + deploy instruction |
| `ADR-040` | Status → Accepted (Phase 1 + Phase 2), T016-T018 → Done, Change Log updated |
| `ADR-041` | T016 → Done, Change Log updated |
| `ADR-033` | §7 supersede note → "complete" |
| `ADR README` | อัปเดต statuses (ADR-033, ADR-040, ADR-041) + category descriptions |
| `rollouts.md` + `project-memory-override.md` | เพิ่ม entries ใหม่ |

### Pre-existing fixes (2 files)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `backend/.../ai-batch.processor.ts:1711` | ลบ `} }` ซ้ำเกิน (pre-existing syntax corruption) |
| `backend/.../ocr.service.ts:545` | แก้ axios.post embed call ที่ถูกทำลายระหว่าง edit |

## กฎที่ Lock แล้ว

- **D38:** ADR-040 Phase 2 complete — X-API-Key auth ถูกลบทั้งหมด ใช้ Docker-internal network isolation แทน (ADR-041 consolidation complete)
- **D39:** `OCR_SIDECAR_API_KEY` env var ไม่มีอยู่แล้วในระบบ — ห้ามเพิ่มกลับมา
- **D40:** Sidecar endpoints (`/ocr`, `/ocr-upload`, `/embed`, `/rerank`) ไม่ต้องมี auth — พึ่ง network isolation เท่านั้น
- **D41:** `test_api_key_validation.py` ถูกลบ — ห้ามสร้างใหม่ (feature ไม่มีแล้ว)

## Verification

- [x] `tsc --noEmit` (backend) — clean (0 errors)
- [x] `npx jest --testPathPatterns="ocr|sandbox-ocr"` — 4 suites / 34 tests ผ่าน
- [x] `npx jest` (full backend) — 101 passed, 2 failed (pre-existing: transform.interceptor + correspondence.service — unrelated to OCR/AI)
- [x] grep `X-API-Key` ใน active code — เหลือเฉพาะใน historical docs (session logs, feature specs, legacy Desk-5439 sidecar)
- [x] grep `OCR_SIDECAR_API_KEY` ใน active config — เหลือเฉพาะใน historical docs + memory (decision history)
- [ ] **Build + Deploy** — rebuild backend + sidecar image เพื่อให้การลบ X-API-Key มีผลใน production
- [ ] **Python tests** — ไม่สามารถรันใน environment นี้ได้ (pytest ไม่ได้ติดตั้ง) — ต้อง verify ใน CI หรือ local ที่มี pytest
