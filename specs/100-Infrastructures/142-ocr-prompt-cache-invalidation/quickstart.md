// File: specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/quickstart.md
// Change Log:
// - 2026-07-23: Initial quickstart for OCR Prompt Cache Invalidation

# Quickstart: OCR Prompt Cache Invalidation

## Prerequisites

- Docker + Docker Compose
- Redis running (part of docker-compose stack)
- Ollama running with `np-dms-ocr:latest` model
- OCR sidecar container

## Setup

### 1. เพิ่ม Redis dependency ใน sidecar

```bash
# ใน ocr-sidecar/requirements.txt เพิ่ม:
# redis>=5.0.0
```

### 2. เพิ่ม REDIS_URL ใน docker-compose.yml

```yaml
# ใน ocr-sidecar service section:
environment:
  - REDIS_URL=redis://redis:6379/0   # ใช้ service name 'redis' ใน Docker network
```

### 3. Rebuild sidecar container

```bash
cd specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai
docker-compose build ocr-sidecar
docker-compose up -d ocr-sidecar
```

## Verification

### Test 1: Prompt ไม่เปลี่ยน → ไม่ unload (hot path)

```bash
# ส่ง OCR ครั้งที่ 1
curl -X POST http://localhost:8765/ocr-upload \
  -F "file=@test.pdf" \
  -F "systemPrompt=Extract all text"

# ส่ง OCR ครั้งที่ 2 ด้วย prompt เดียวกัน
curl -X POST http://localhost:8765/ocr-upload \
  -F "file=@test2.pdf" \
  -F "systemPrompt=Extract all text"

# ตรวจสอบ log: ไม่ควรมี "systemPrompt changed" ในครั้งที่ 2
# และ inference time ครั้งที่ 2 ควร < 50% ของครั้งที่ 1
```

### Test 2: Prompt เปลี่ยน → unload + reload

```bash
# ส่ง OCR ด้วย prompt A
curl -X POST http://localhost:8765/ocr-upload \
  -F "file=@test.pdf" \
  -F "systemPrompt=Extract all text"

# เปลี่ยนเป็น prompt B
curl -X POST http://localhost:8765/ocr-upload \
  -F "file=@test.pdf" \
  -F "systemPrompt=Extract text and identify document type"

# ตรวจสอบ log: ควรเห็น "systemPrompt changed (hash_a1b2 → hash_c3d4) — forcing model unload"
```

### Test 3: Redis hash persistence

```bash
# ตรวจสอบ Redis
docker exec cache redis-cli get ocr:prompt:hash:np-dms-ocr
# ควรได้ hash 16 chars ของ prompt ล่าสุด
```

### Test 4: Sidecar restart → ไม่ unload ใน request แรก

```bash
# Restart sidecar
docker-compose restart ocr-sidecar

# ส่ง OCR ครั้งแรกหลัง restart
curl -X POST http://localhost:8765/ocr-upload \
  -F "file=@test.pdf" \
  -F "systemPrompt=Extract all text"

# ตรวจสอบ log: ไม่ควรมี "systemPrompt changed" (เพราะ Redis ยังมี hash เดิม หรือไม่มี hash = first request)
# แต่ถ้า Redis ยังมี hash ของ prompt เดียวกัน → skip unload ✓
# ถ้า Redis ไม่มี hash → first request ไม่ unload ✓
```
