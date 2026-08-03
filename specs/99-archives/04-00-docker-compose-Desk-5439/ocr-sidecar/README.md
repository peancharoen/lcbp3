# OCR Sidecar — Desk-5439

HTTP API server สำหรับสกัดข้อความจาก PDF ผ่าน np-dms-ocr (Ollama) — รันบน Desk-5439 ตาม ADR-023A/ADR-040.

## สถาปัตยกรรม

```
Backend (QNAP) → POST /ocr-upload → OCR Sidecar (Desk-5439:8765)
                                          ↓
                                    PyMuPDF (fast-path: chars > 100)
                                          ↓ (ถ้า chars ≤ 100)
                                    prepare_ocr_messages (typhoon_ocr)
                                    + poppler/pdftoppm (PDF → image)
                                          ↓
                                    np-dms-ocr via Ollama /v1/chat/completions
                                          ↓
                                    JSON → natural_text (Markdown)
```

## Endpoints

| Endpoint | Method | Auth | หน้าที่ |
|----------|--------|------|---------|
| `/health` | GET | — | ตรวจสอบสถานะ sidecar |
| `/ocr` | POST | X-API-Key | OCR จาก path (ใช้เมื่อ shared volume mount) |
| `/ocr-upload` | POST | X-API-Key | OCR จาก multipart file upload |
| `/embed` | POST | X-API-Key | BGE-M3 embedding (Dense + Sparse) พร้อม CPU fallback |
| `/rerank` | POST | X-API-Key | BGE-Reranker-Large chunk re-ranker พร้อม CPU fallback |

**Removed endpoints:**
- `POST /normalize` — ลบออกแล้วตาม ADR-040 Phase 8 (ไม่มี consumers)

## Environment Variables

| Variable | Default | หน้าที่ |
|----------|---------|---------|
| `OCR_SIDECAR_API_KEY` | (required) | API key สำหรับ authentication (Phase 1) |
| `OCR_SIDECAR_UPLOAD_BASE` | `/mnt/uploads` | Base path whitelist สำหรับ path traversal protection |
| `OLLAMA_API_URL` | `http://host.docker.internal:11434` | Ollama API URL |
| `OCR_MODEL` | `np-dms-ocr:latest` | ชื่อ OCR model ใน Ollama |
| `OCR_TIMEOUT` | `360` | Timeout วินาทีต่อ request |
| `OCR_CHAR_THRESHOLD` | `100` | Fast-path threshold (chars > 100 = ใช้ text layer โดยตรง) |
| `OCR_MAX_PAGES` | `0` | จำนวนหน้าสูงสุด (0 = ทุกหน้า) |
| `OCR_ACTIVE_PROFILE` | (optional) | ชื่อ profile ใน `ai_execution_profiles` |
| `VRAM_HEADROOM_THRESHOLD_MB` | `3000.0` | Threshold สำหรับ CPU fallback |
| `RETRIEVAL_TIMEOUT_SECONDS` | `30.0` | Timeout สำหรับ /embed และ /rerank |
| `MAX_SYSTEM_PROMPT_LENGTH` | `10000` | ความยาวสูงสุดของ systemPrompt |

## การ Deploy

```bash
# 1. คัดลอก .env.example เป็น .env และกรอกค่า
cp .env.example .env
# แก้ OCR_SIDECAR_API_KEY เป็นค่าจริง

# 2. Build และรัน
docker compose up -d --build

# 3. ตรวจสอบ
curl http://192.168.10.100:8765/health
```

## การทดสอบ

```bash
# รันทุก test (จาก project root)
python -m pytest tests/ -v

# รันเฉพาะ unit tests
python -m pytest tests/unit/ocr-sidecar/ -v

# รันเฉพาะ integration tests
python -m pytest tests/integration/ocr-sidecar/ -v
```

### Test Coverage

| Test File | หน้าที่ |
|-----------|---------|
| `test_path_traversal.py` | Path traversal protection (US1) |
| `test_api_key_validation.py` | API key validation (US1) |
| `test_residency_wiring.py` | Adaptive OCR residency wiring (US2) |
| `test_cpu_fallback.py` | CPU fallback for /embed and /rerank (US2) |
| `test_parameter_governance.py` | Runtime parameter governance (US3) |
| `test_active_prompt.py` | System prompt + DMS tags injection (US3) |
| `test_async_performance.py` | Async I/O + lifespan + concurrent requests (US4) |

## ADR-040 Phases

| Phase | Status | หน้าที่ |
|-------|--------|---------|
| Phase 1-2 | ✅ Complete | Setup + Foundational |
| Phase 3 | ✅ Complete | US1: Security Hardening |
| Phase 4 | ✅ Complete | US2: GPU Resource Management |
| Phase 5 | ✅ Complete | US3: Parameter Governance |
| Phase 6 | ✅ Complete | US4: Async I/O Performance |
| Phase 7 | ⏳ Blocked | US5: Network Isolation Auth (รอ ADR-041) |
| Phase 8 | ✅ Complete | Remove /normalize endpoint |
| Phase 9 | ✅ Complete | Polish & documentation |

## ไฟล์ในโปรเจกต์

```
ocr-sidecar/
├── app.py              — FastAPI server (async I/O, lifespan)
├── Dockerfile          — Docker image (python:3.10-slim + poppler + curl)
├── docker-compose.yml  — Compose config (ocr-sidecar + ollama-metrics)
├── requirements.txt    — Python dependencies
├── .env.example        — Environment template
├── services/
│   ├── vram_monitor.py     — VRAM headroom monitoring
│   └── residency_policy.py — Adaptive OCR residency calculation
└── tests/
    └── test_retrieval_fallback.py — Retrieval fallback tests
```
