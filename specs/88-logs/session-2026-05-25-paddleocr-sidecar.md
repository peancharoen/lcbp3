# Session 7 — 2026-05-25 (PaddleOCR Sidecar Setup)

## สิ่งที่ทำ

- แก้ `AggregateError` (empty message) ใน `ocr.service.ts` — wrap เป็น Error พร้อม context ที่ชัดเจน
- สร้าง PaddleOCR + PyThaiNLP FastAPI sidecar รันบน Desk-5439 (Windows 10/11, Docker Desktop WSL2)
- เพิ่ม path remapping `remapPath()` ใน `OcrService` — แปลง `/app/uploads/...` → `/mnt/uploads/...`

## ไฟล์ที่สร้าง/แก้ไข

| ไฟล์                                                                                        | การเปลี่ยนแปลย                                                                  |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/Dockerfile`         | ✅ สร้างใหม่ — Python 3.10 slim, ลบ pre-download step (segfault)                |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py`             | ✅ สร้างใหม่ — FastAPI: `/health`, `/ocr` (PaddleOCR), `/normalize` (PyThaiNLP) |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/requirements.txt`   | ✅ สร้างใหม่ — `numpy<2.0` ต้องอยู่ก่อน paddlepaddle (ABI fix)                  |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/docker-compose.yml` | ✅ สร้างใหม่ — CIFS volume mount + named volume สำหรับ model cache              |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/docker-compose-app.yml`          | เพิ่ม `OCR_API_URL`, `OCR_CHAR_THRESHOLD`, `OCR_SIDECAR_UPLOAD_BASE`            |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/.env.example`                    | เพิ่ม `OCR_API_URL`, `OCR_CHAR_THRESHOLD`, `OCR_SIDECAR_UPLOAD_BASE`            |
| `backend/src/modules/ai/services/ocr.service.ts`                                            | เพิ่ม `remapPath()`, AggregateError fix                                         |

## Known Issues / Fixes

- `numpy<2.0` ต้องอยู่ก่อน `paddlepaddle` — ABI mismatch กับ cv2 (numpy 2.x)
- Docker Desktop WSL2 ไม่รองรับ bind mount จาก network drive (Z:\) → ใช้ CIFS volume แทน
- Pre-download model ใน Dockerfile ทำให้ segfault (exit 139) → ลบออก download ตอน runtime
- `OLLAMA_RAG_MODEL` → เปลี่ยนเป็น `OLLAMA_MODEL_MAIN=gemma4:e2b` ตาม ADR-023A

## CIFS Volume Config

```yaml
volumes:
  qnap_uploads:
    driver: local
    driver_opts:
      type: cifs
      o: 'username=${QNAP_USER},password=${QNAP_PASS},vers=3.0,uid=0,gid=0'
      device: '//192.168.10.8/np-dms-as/data/uploads'
```

## Path Remapping

```
backend: /app/uploads/temp/xxx.pdf → sidecar: /mnt/uploads/temp/xxx.pdf
OCR_SIDECAR_UPLOAD_BASE=/mnt/uploads (env var)
```

## Verification

- `curl http://localhost:8765/health` → `{"status":"ok","engine":"paddleocr"}` ✅
- `POST /ocr` ทดสอบกับไฟล์จริงใน `/mnt/uploads/temp/` → ได้ text กลับ ✅
- 78 test suites, 672 tests ผ่านทั้งหมด ✅
