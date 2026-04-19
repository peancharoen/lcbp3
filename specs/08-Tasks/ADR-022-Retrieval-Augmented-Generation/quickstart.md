# Quickstart: ADR-022 RAG — Local Development Setup

**Date**: 2026-04-19 | **สำหรับ**: Developer ที่ต้องการรัน RAG pipeline บน local machine

---

## Prerequisites

| Dependency | Version | หมายเหตุ |
|------------|---------|----------|
| Docker Desktop | 4.x+ | สำหรับ Qdrant + Redis |
| Node.js | 20.x | NestJS backend |
| pnpm | 9.x | Package manager |
| Python | 3.11 | PyThaiNLP microservice |
| Ollama | latest | ต้องติดตั้งบน Admin Desktop หรือ local |

---

## Step 1: Start Infrastructure

```bash
# เพิ่ม Qdrant + Redis ใน docker-compose.override.yml (local dev)
docker compose -f docker-compose.yml -f docker-compose.override.yml up qdrant redis -d

# ตรวจสอบ Qdrant
curl http://localhost:6333/healthz
# → {"title":"qdrant - serving","version":"..."}
```

---

## Step 2: Setup PyThaiNLP Microservice

```bash
# บน Admin Desktop (หรือ local สำหรับ dev)
cd backend/services/thai-preprocess   # สร้าง directory นี้ในอนาคต

pip install pythainlp==5.0.* fastapi uvicorn

# รัน microservice
python -m uvicorn main:app --host 0.0.0.0 --port 8765

# ทดสอบ
curl -X POST http://localhost:8765/preprocess \
  -H "Content-Type: application/json" \
  -d '{"text": "มาตรา ๑๐ ของสัญญา"}'
# → {"normalized": "มาตรา 10 ของสัญญา"}
```

---

## Step 3: Configure Environment Variables

```env
# backend/.env (dev override)

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=lcbp3_vectors

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Ollama (Admin Desktop หรือ local)
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_RAG_MODEL=<กำหนดโดย ops team>   # ดู research.md R1

# PyThaiNLP Microservice
THAI_PREPROCESS_URL=http://localhost:8765

# Typhoon API (อาจใช้ sandbox key สำหรับ dev)
TYPHOON_API_KEY=<dev-key>
TYPHOON_API_URL=https://api.opentyphoon.ai/v1

# RAG Config
RAG_TOPK=20
RAG_FINAL_K=5
RAG_TIMEOUT_MS=5000
RAG_QUERY_CACHE_TTL=300   # seconds
```

---

## Step 4: Pull Ollama Models

```bash
# บน Admin Desktop / local Ollama
ollama pull nomic-embed-text     # embedding model (768 dims)
ollama pull <OLLAMA_RAG_MODEL>   # local LLM (ดูจาก ops team)
```

---

## Step 5: Run Schema Delta

```sql
-- รัน SQL delta ตาม ADR-009 (แก้โดยตรง ห้ามใช้ migration)
-- specs/03-Data-and-Storage/deltas/06-add-rag-status-to-attachments.sql
-- specs/03-Data-and-Storage/deltas/06b-create-document-chunks.sql
```

---

## Step 6: Start NestJS Backend

```bash
cd backend
pnpm install
pnpm run start:dev
```

---

## Step 7: Initialize Qdrant Collection

```bash
# เรียก endpoint เพื่อ create collection (ถ้ายังไม่มี)
curl -X POST http://localhost:3001/api/rag/admin/init-collection \
  -H "Authorization: Bearer <admin-token>"
# → {"message": "Collection lcbp3_vectors initialized"}
```

---

## Step 8: Test RAG Query

```bash
# 1. Upload + commit ไฟล์ PDF (ผ่าน DMS upload API ปกติ)
# → rag_status จะเปลี่ยนเป็น PENDING → PROCESSING → INDEXED

# 2. ตรวจสอบ status
curl http://localhost:3001/api/rag/status/<attachment-uuid> \
  -H "Authorization: Bearer <token>"
# → {"data": {"ragStatus": "INDEXED", "chunkCount": 12}}

# 3. RAG query
curl -X POST http://localhost:3001/api/rag/query \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "เอกสารนี้เกี่ยวกับอะไร?",
    "projectPublicId": "<project-uuid>"
  }'
# → {"data": {"answer": "...", "citations": [...], "fallbackUsed": false}}
```

---

## Troubleshooting

| ปัญหา | สาเหตุ | แก้ไข |
|-------|-------|-------|
| `rag_status` ค้างที่ PROCESSING | BullMQ worker ไม่ทำงาน | ตรวจสอบ Redis connection + worker process |
| Qdrant connection refused | Qdrant container ไม่ run | `docker compose up qdrant -d` |
| PyThaiNLP timeout | Microservice ไม่ start | ตรวจสอบ port 8765 + Python service |
| `fallbackUsed: true` ตลอด | Typhoon API key ผิด / network block | ตรวจสอบ `TYPHOON_API_KEY` + network |
| `chunkCount: 0` หลัง INDEXED | Collection ยังไม่ถูก init | เรียก `/api/rag/admin/init-collection` |
