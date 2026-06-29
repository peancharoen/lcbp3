# LCBP3 DMS — RAG v1.1.2 Enterprise Implementation Guide by ChatGPT

Version: 1.1.2
Project: Laem Chabang Basin Phase 3
Stack: NestJS + Next.js + MariaDB + Qdrant + Redis + Ollama + Typhoon API

---

# 1. Overview

ถูกออกแบบเพื่อยกระดับให้รองรับ Production จริง โดยเน้น:

* Security (RBAC + Classification)
* Scalability (Async + Queue + Batch)
* Accuracy (Hybrid Search + Re-ranking)
* Observability (Logging + Metrics)

---

## Clarifications

### Session 2026-04-19

- Q: Qdrant Multi-tenancy Strategy: ระบบ RAG ควรแยกข้อมูลระหว่างโครงการใน Qdrant อย่างไร? → A: Option C — Tiered Multitenancy: single collection + custom sharding + `is_tenant: true` payload index บน `project_public_id` (Qdrant v1.16+)
- Q: Typhoon API Failover: เมื่อ Typhoon Cloud API ใช้งานไม่ได้สำหรับ non-CONFIDENTIAL ระบบควรทำอย่างไร? → A: Option B — Auto-failover to local Ollama LLM โดยอัตโนมัติ พร้อมแจ้ง user ว่าใช้ local model (คุณภาพอาจลดลง)
- Q: Thai Language Preprocessing: ควรเพิ่ม preprocessing ก่อนส่ง embed (หลังจาก OCR) ไหม? → A: Option B — เพิ่ม PyThaiNLP tokenization + normalize (Thai number, คำย่อ, section header) ก่อนส่ง nomic-embed-text; ยังใช้ embedding model เดิม
- Q: `rag_status` field location: ควรเก็บสถานะ RAG ingestion ไว้ใน table ไหน? → A: Option A — เพิ่ม `rag_status ENUM('PENDING','PROCESSING','INDEXED','FAILED')` และ `rag_last_error TEXT` ใน `attachments` table (ADR-009: แก้ SQL โดยตรง, ห้ามใช้ migration)
- Q: End-to-End RAG Query Latency SLO: เป้าหมาย latency สำหรับ RAG query ควรเป็นเท่าไหร่? → A: Option D — แยก SLO ตาม path: Typhoon primary p95 < 3s / Ollama fallback p95 < 10s

---

# 2. High-Level Architecture

## Flow

Upload → OCR → Normalize → Chunk → Embed → Store

Query → Auth → Rewrite → Hybrid Search → Re-rank → Context Build → LLM → Response

---

# 3. Core Components

## 3.1 Storage

* MariaDB: Document metadata + chunks
* Qdrant: Vector store — **Tiered Multitenancy** (single collection `lcbp3_vectors`, Qdrant v1.16+)
  * ใช้ `is_tenant: true` payload index บน `project_public_id` (ห้ามใช้ separate collection ต่อโครงการ)
  * Custom sharding เพื่อลด noisy-neighbor ระหว่างโครงการ
  * ทุก query ต้องมี payload filter `project_public_id` เสมอ (non-negotiable)
* Redis: Cache + Queue

## 3.2 AI Layer

* Embedding: Ollama (nomic-embed-text)
* LLM (Primary): Typhoon API — สำหรับ PUBLIC + INTERNAL
* LLM (Fallback): Local Ollama — auto-failover อัตโนมัติเมื่อ Typhoon timeout/down พร้อมส่ง flag `used_fallback_model: true` ในผลลัพธ์
* LLM (CONFIDENTIAL): Local Ollama เท่านั้น (ADR-018, non-negotiable)
* Failover trigger: Typhoon API timeout > 5 วินาที หรือ HTTP error 5xx

---

# 4. Data Model

## document_chunks

* id (UUID)
* document_id
* chunk_index
* content
* doc_type
* doc_number
* revision
* project_code
* classification
* version
* embedding_model
* created_at

## Indexes

* INDEX(document_id)
* INDEX(doc_number, revision)
* FULLTEXT(content)

## attachments (RAG fields — เพิ่มใหม่, ADR-009)

* `rag_status ENUM('PENDING','PROCESSING','INDEXED','FAILED') DEFAULT 'PENDING'` — ติดตามสถานะ ingestion ระดับ file
* `rag_last_error TEXT NULL` — เก็บ error message สุดท้ายเมื่อ status = FAILED

> ⚠໰ ห้ามเพิ่ม `rag_status` ใน `document_chunks` (เก็บ chunks ที่ indexed แล้วเท่านั้น)

---

# 5. Security Model

## 5.1 RBAC

* Enforce ทุก query ด้วย CASL permission `manage:rag`
* Filter ตาม user permission + `project_public_id` (tenant isolation)
* ทุก endpoint ต้องมี CASL Guard — ห้าม bypass

## 5.2 Classification

* PUBLIC
* INTERNAL
* CONFIDENTIAL

CONFIDENTIAL → ใช้ local LLM เท่านั้น

---

# 6. Chunking Strategy

| Type     | Strategy    | Size | Overlap |
| -------- | ----------- | ---- | ------- |
| CORR/MOM | Paragraph   | 500  | 50      |
| RFI/NCR  | Section     | 300  | 30      |
| CONTRACT | Table-aware | 400  | 40      |
| RPT      | Sliding     | 600  | 100     |

---

# 7. Ingestion Pipeline

## Steps

1. Extract text (OCR — Tesseract, ตาม ADR-017B)
2. **Thai Preprocessing (PyThaiNLP):** tokenize + normalize (ตัวเลขไทย, คำย่อ เช่น "รฟม." → expansion, section header strip)
3. Chunk (ตาม strategy ใน Section 6)
4. Send to queue (BullMQ)
5. Embed (parallel — nomic-embed-text via Ollama)
6. Upsert Qdrant (batch, collection `lcbp3_vectors`)
7. Save DB (document_chunks + update rag_status)

## Queue Design (BullMQ — ADR-008)

| Queue | Consumer | Workers |
|-------|----------|---------|
| `rag:ocr` | OcrProcessor | 2 |
| `rag:thai-preprocess` | ThaiPreprocessProcessor | 4 |
| `rag:embedding` | EmbeddingProcessor | 3 |

---

# 8. Retrieval (Hybrid)

## Vector Search

Qdrant top 20

## Keyword Search

MariaDB FULLTEXT top 20

## Merge

score = 0.7 vector + 0.3 keyword

---

# 9. Re-ranking

Top 20 → Re-rank → Top 5

**Decision (MVP)**: Score-based sort — ใช้ `mergedScore` จาก Hybrid Search (0.7 vector + 0.3 keyword) เรียงลำดับ descending แล้วตัด top 5 ไม่มี LLM re-ranking call เพิ่มเติมใน MVP

**Future Enhancement**: Typhoon LLM cross-encoder re-ranking (defer ไป Phase 2)

---

# 10. Context Builder

* จำกัด 3–5 documents
* จำกัด token ~3000

Format:
[DOC_TYPE - DOC_NUMBER - REV]
Content snippet

---

# 11. Prompt Design

System Prompt:

* Answer only from context
* If not found → "ไม่พบข้อมูลในเอกสาร"
* MUST cite source

---

# 12. Query Flow

1. Validate user
2. Embed question
3. Hybrid search
4. Filter by ACL
5. Re-rank
6. Build context
7. Generate answer
8. Return + sources

---

# 13. Performance

## Latency SLO (End-to-End RAG Query)

| Path | Target | เงื่อนไข |
|------|--------|---------|
| **Typhoon primary** | p95 < 3s | สำหรับ PUBLIC + INTERNAL เมื่อ Typhoon พร้อมใช้งาน |
| **Ollama fallback** | p95 < 10s | เมื่อ Typhoon down หรือ CONFIDENTIAL |

## Cache

* embedding cache
* query result cache (TTL 5 min)

## Retry

* 3 attempts
* exponential backoff

## Timeout

* 5 seconds per service (individual service call limit)
* Typhoon API: timeout 5s → trigger fallover to Ollama

---

# 14. Observability

## Logging

* user_id
* question
* retrieved docs
* answer
* latency

## Metrics

* latency
* QPS
* accuracy

---

# 15. Deployment

## Docker Services

* qdrant
* redis
* ollama
* api (NestJS)

---

# 16. Rollout Plan

> ดู `plan.md` สำหรับรายละเอียด rollout phases ครบถ้วน

| Phase | ชื่อ | ระยะเวลา |
|-------|------|----------|
| 1 | Infrastructure | 2 วัน |
| 2 | Core Services | 3 วัน |
| 3 | RAG Query API (MVP) | 2 วัน |
| 4 | Ingestion Pipeline | 3 วัน |
| 5 | Frontend UI + Polish | 3 วัน |

---

# 17. Best Practices

* ใช้ batch embedding
* จำกัด context
* log ทุก query
* ทดสอบด้วย dataset จริง

---

# 18. Future Enhancements

* Re-ranking model tuning
* Feedback loop
* Active learning
* Multilingual support

---

---

# 19. Production Rollout Package (v2.1)

## 19.1 Docker Compose (Production Example)

```yaml
version: '3.9'
services:
  qdrant:
    image: qdrant/qdrant:latest
    restart: unless-stopped
    volumes:
      - qdrant_data:/qdrant/storage
    networks: [internal]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks: [internal]

  ollama:
    image: ollama/ollama
    restart: unless-stopped
    volumes:
      - ollama_data:/root/.ollama
    networks: [internal]

  api:
    build: .
    restart: unless-stopped
    depends_on:
      - qdrant
      - redis
      - ollama
    environment:
      - QDRANT_URL=http://qdrant:6333
      - REDIS_HOST=redis
      - OLLAMA_URL=http://ollama:11434
    networks: [internal]

networks:
  internal:
    driver: bridge

volumes:
  qdrant_data:
  redis_data:
  ollama_data:
```

---

## 19.2 Environment (Production)

```env
NODE_ENV=production

QDRANT_URL=http://qdrant:6333
REDIS_HOST=redis
REDIS_PORT=6379

OLLAMA_URL=http://ollama:11434

TYPHOON_API_KEY=***

RAG_TOPK=20
RAG_FINAL_K=5
RAG_TIMEOUT_MS=5000
```

---

## 19.3 Qdrant Optimization (Tiered Multitenancy)

* ใช้ HNSW config สำหรับ tenant-aware index:

  ```
  payload_m: 16   # tenant HNSW index size
  m: 0            # ปิด global index (non-negotiable สำหรับ is_tenant=true)
  ```

* เปิด payload index:

  * `project_public_id` — `is_tenant: true` (required)
  * `doc_number`
  * `classification`

> ⚠️ ห้ามใช้ `m=16` กับ global index เมื่อใช้ tiered multitenancy — ทำให้ is_tenant ไม่ทำงาน

---

## 19.4 Worker Scaling

* แยก worker container:

  * ingestion-worker
  * embedding-worker

* scale:

```bash
docker compose up --scale embedding-worker=3
```

---

## 19.5 Security Hardening Checklist

* Enforce RBAC ทุก endpoint (`manage:rag` CASL guard)
* Validate input (class-validator + Zod frontend)
* Limit context length (≤3000 tokens)
* Strip sensitive fields ก่อน log
* Idempotency-Key header บน `POST /rag/query`
* Prevent prompt injection (research.md R7 — 4 layers):
  1. System prompt boundary markers `<CONTEXT_START>` / `<CONTEXT_END>`
  2. Require JSON-only structured output
  3. Post-generation citation validation (ตรวจ doc_number ใน retrieved chunks)
  4. Fallback response: "ไม่พบข้อมูลที่ระบุ" เมื่อ validation ล้มเหลว

---

## 19.6 Logging & Monitoring Stack

* Logs: JSON format
* Tools:

  * Loki / ELK
  * Prometheus + Grafana

Metrics:

* latency
* error rate
* retrieval accuracy

---

## 19.7 Backup Strategy

* MariaDB: daily dump
* Qdrant: snapshot volume
* Redis: optional (cache)

---

## 19.8 Deployment Strategy

* Blue/Green deployment

* Health check endpoint:
  /health

* Readiness:

  * Qdrant OK
  * Redis OK
  * Ollama OK

---

## 19.9 Testing Checklist

* Query accuracy
* Permission isolation
* Load test (concurrent users)
* Failover test

---

## 19.10 Go-Live Checklist

* Infra ready
* Env configured
* Index built
* RBAC tested
* Monitoring enabled

---

# 20. Edge Cases & Robustness Rules

> เพิ่มจาก Red Team session 2026-04-19 (`/util-speckit.quizme`)

## EC-RAG-001 — Concurrent Ingestion Dedup

**Scenario**: ไฟล์เดิมถูก commit สองครั้งติดกัน (retry / double-click) → `IngestionService.enqueue()` ถูกเรียกซ้ำ

**Rule**: ใช้ `attachmentId` เป็น BullMQ `jobId` บน queue `rag:ocr` เพื่อ native dedup — ถ้า job นั้น active/waiting อยู่แล้ว BullMQ จะ ignore silently และ logger จะ log `'rag:ocr job already queued for {attachmentId}'`

**Defense in depth**: `OcrProcessor` ต้อง validate `rag_status !== PROCESSING` เป็น double-check แรกก่อนเริ่มทำงาน — ถ้า PROCESSING อยู่ให้ return `MoveToCompleted` โดยไม่ error

---

## EC-RAG-002 — Partial Ingestion Cleanup Before Re-ingest

**Scenario**: Embedding processor fail ระหว่างทาง (chunks บางส่วน upsert ไป Qdrant แล้ว) → rag_status = FAILED → Admin trigger re-ingest

**Rule**: `RagService.reIngest()` ต้อง cleanup ก่อน re-queue ตามลำดับนี้เสมอ:

1. `DELETE FROM document_chunks WHERE document_id = :attachmentId` (DB transaction — rollback ได้)
2. DELETE Qdrant points WITH payload filter `documentId = :attachmentId`
3. SET `rag_status = PENDING` + clear `rag_last_error`

**Failure handling**:
- Step 1 fail → throw `BusinessException` — ห้ามดำเนินการต่อ
- Step 2 fail → log ERROR แต่ดำเนิน step 3 ต่อ (Qdrant cleanup จะเกิดขึ้นเองเมื่อ re-embed สำเร็จ เพราะใช้ chunk UUID เดิม → upsert ทับ)

---

## EC-RAG-003 — Qdrant Collection Auto-init on Startup

**Scenario**: Qdrant container fresh start / volume หาย — ผู้ใช้ query ก่อน Admin เคยรัน init endpoint

**Rule**: `QdrantService` ต้อง implement `OnModuleInit` เพื่อ idempotently create/validate collection `lcbp3_vectors` ด้วย HNSW config `payload_m:16, m:0` ทุกครั้งที่ app เริ่ม

**Failure handling**:
- Qdrant ไม่ตอบสนอง → log ERROR + set `collectionReady = false` — ห้าม throw (ไม่ crash app)
- Query endpoints ต้อง check `collectionReady` ก่อนทุก call — ถ้า `false` ให้ return 503 `{"message":"RAG service unavailable","code":"RAG_NOT_READY"}`

**Note**: `POST /rag/admin/init-collection` (T038) ยังคงมีประโยชน์สำหรับ force-reinit กรณี Qdrant volume หาย mid-production

---

## EC-RAG-004 — Classification Level Must Be Server-Derived (Never Client-Provided)

**Scenario**: User ที่มีสิทธิ์แค่ PUBLIC ส่ง `maxClassification: "CONFIDENTIAL"` ใน request body โดยตรง

**Rule**: `maxClassification` ห้ามรับจาก request body — ต้องลบออกจาก `RagQueryDto` ทั้งหมด

**Server-side classification derivation**: `RagService.query()` ต้อง derive classification ceiling จาก user role ใน project membership:

| Role | Classification Ceiling |
|------|----------------------|
| Admin / Manager | CONFIDENTIAL |
| Member | INTERNAL |
| Guest / Viewer | PUBLIC |

Qdrant payload filter ใช้ค่าที่ derive จาก server เสมอ — ไม่มีทาง client bypass ได้

**LLM routing** (ADR-018): classification ceiling = CONFIDENTIAL → ใช้ local Ollama เสมอโดยไม่ส่งไป Typhoon API

---

## EC-RAG-005 — Query Cache Key Must Include Tenant + Classification (Cross-Tenant Leak Prevention)

**Scenario**: User A (Project LCBP3, CONFIDENTIAL access) query คำถามเดียวกันกับ User B (Project SAMPLE, PUBLIC only) → User B อาจ hit cache ของ User A และเห็น CONFIDENTIAL content จากโครงการอื่น

**Rule**: Query result cache key ต้องเป็น:

```
cacheKey = SHA256(question + ":" + projectPublicId + ":" + classificationCeiling)
```

- ห้ามใช้แค่ `hash(question)` — cross-tenant leak
- **CONFIDENTIAL queries**: bypass cache ทั้งหมด — ห้าม read และ write Redis cache
- **PUBLIC / INTERNAL queries**: ใช้ cache key ข้างต้น, TTL 5 minutes

---

# END

เวอร์ชันนี้เพิ่มของที่ “ใช้ deploy จริง” ครบ เช่น:

* ✅ docker-compose (production)
* ✅ worker scaling
* ✅ Qdrant tuning (HNSW + index)
* ✅ security hardening checklist
* ✅ monitoring (Loki / Prometheus / Grafana)
* ✅ backup strategy
* ✅ go-live checklist

---
