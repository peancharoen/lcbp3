# Session — 2026-06-20 (OCR Sidecar Refactor Phase 6-9 Implementation)

## Summary

Implemented Phases 6, 8, and 9 of the OCR Sidecar Refactor (Speckit-140) following ADR-040. Phase 6 refactored the sidecar to async I/O with lifespan context manager. Phase 8 removed the unused `/normalize` endpoint. Phase 9 polished Dockerfile, docker-compose.yml, created README.md, and validated quickstart.md. All 19 Python tests pass.

## ปัญหาที่พบ (Root Cause)

ไม่มี bug ใน session นี้ — เป็นการ implement feature ใหม่ตาม ADR-040:
- **Sync I/O bottleneck**: `process_ocr` ใช้ `httpx.Client` แบบ sync ทำให้ block FastAPI event loop
- **Stale startup pattern**: `@app.on_event("startup")` deprecate แล้วใน FastAPI 0.111+
- **Unused /normalize endpoint**: ไม่มี consumers ใน backend codebase
- **Stale Docker config**: `OCR_LANG`, `USE_GPU` เป็น Tesseract config ที่ไม่ใช้แล้ว
- **Missing curl**: Dockerfile ไม่มี `curl` ทำให้ HEALTHCHECK ล้มเหลว

## การแก้ไข (Fix)

### Phase 6: Async I/O Performance (T041-T046)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `specs/04-Infrastructure-OPS/.../ocr-sidecar/app.py` | `process_ocr` → `async def`, `_process_pdf_doc` → `async def`, `/ocr` + `/ocr-upload` → `async def` |
| `app.py` | เพิ่ม `ollama_client` global (`httpx.AsyncClient`) สร้างใน lifespan context manager |
| `app.py` | แทน `@app.on_event("startup")` ด้วย `@asynccontextmanager lifespan` |
| `app.py` | Model loading ผ่าน `asyncio.to_thread(_load_bge_models)` |
| `app.py` | แทน `httpx.Client` ด้วย `await client.post()` (AsyncClient) |
| `tests/integration/ocr-sidecar/test_async_performance.py` | **New file**: 6 tests (coroutine check, lifespan, ollama_client global, /normalize removed, concurrent requests) |
| `tests/unit/ocr-sidecar/test_residency_wiring.py` | Updated: `FakeClient` → `FakeAsyncClient`, sync → `asyncio.run()` |
| `tests/integration/ocr-sidecar/test_parameter_governance.py` | Updated: async mock, patch `ollama_client` |
| `tests/integration/ocr-sidecar/test_active_prompt.py` | Updated: async mock, patch `ollama_client` |

### Phase 8: Remove /normalize (T054-T055)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `app.py` | ลบ `NormalizeRequest`, `NormalizeResponse`, `/normalize` endpoint, `pythainlp` imports |
| `requirements.txt` | ลบ `pythainlp==5.0.4` และ `Pillow==10.0.0` |
| (grep verified) | ไม่มี `/normalize` หรือ `THAI_PREPROCESS_URL` consumers ใน backend |

### Phase 9: Polish (T056-T063)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `Dockerfile` | เพิ่ม `curl` สำหรับ HEALTHCHECK, change log entry |
| `docker-compose.yml` | ลบ `OCR_LANG`, `USE_GPU`; เพิ่ม `OCR_SIDECAR_API_KEY`, `OCR_ACTIVE_PROFILE` |
| `README.md` | **New file**: architecture, endpoints, env vars, deploy guide, test coverage |
| `quickstart.md` | แก้ stale requirements (ลบ pythainlp/Pillow), แก้ `TYPHOON_OCR_MODEL` → `OCR_MODEL` |
| `tasks.md` | Mark T041-T046, T054-T063 as `[x]` |

## กฎที่ Lock แล้ว

- **Async I/O pattern**: `process_ocr` ต้องเป็น `async def` และใช้ `httpx.AsyncClient` ผ่าน `ollama_client` global (สร้างใน lifespan)
- **Lifespan over startup event**: ใช้ `@asynccontextmanager lifespan` แทน `@app.on_event("startup")` — deprecate แล้วใน FastAPI 0.111+
- **Model loading non-blocking**: ใช้ `asyncio.to_thread()` สำหรับ model loading ใน lifespan เพื่อไม่ block startup
- **No /normalize**: endpoint ถูกลบแล้ว — ไม่มี consumers ใน backend
- **Test mock pattern**: ใช้ `FakeAsyncClient` (async `post()` + `aclose()`) แทน `FakeClient` (sync) สำหรับทุก test ที่ mock Ollama API

## Verification

- [x] `python -m pytest tests/ -v` — **19/19 tests passed** in 4.81s
- [x] `test_process_ocr_is_coroutine_function` — process_ocr เป็น async ✅
- [x] `test_process_pdf_doc_is_coroutine_function` — _process_pdf_doc เป็น async ✅
- [x] `test_app_uses_lifespan_not_startup_event` — ใช้ lifespan ไม่ใช่ on_event ✅
- [x] `test_app_has_async_client_global` — ollama_client global มีอยู่ ✅
- [x] `test_normalize_endpoint_removed` — /normalize ถูกลบแล้ว ✅
- [x] `test_concurrent_ocr_requests_dont_block` — 3 concurrent requests สำเร็จ ✅
- [x] Existing tests (path traversal, API key, residency, CPU fallback, parameter governance, active prompt) — ทั้งหมดผ่าน ✅
