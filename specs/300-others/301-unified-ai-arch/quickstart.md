# Quickstart: Unified AI Architecture (ADR-023)

> **Target Machine:** Desk-5439 (AI Host) — IP: `<desk-5439-ip>`
> **Stack:** Ollama + Qdrant + n8n + Redis + NestJS BullMQ

---

## 1. Setup the AI Host (Desk-5439)

### 1.1 Ollama

```bash
# Install Ollama (Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull gemma2:9b           # RAG generation (OLLAMA_RAG_MODEL)
ollama pull nomic-embed-text    # Embedding (OLLAMA_EMBED_MODEL)

# Verify
ollama list
# gemma2:9b        ...
# nomic-embed-text ...

# Start Ollama server (default port: 11434)
ollama serve
```

### 1.2 Qdrant (Vector Database)

```bash
# Start Qdrant with persistent storage via Docker
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v /opt/qdrant/data:/qdrant/storage \
  qdrant/qdrant:latest

# Verify
curl http://localhost:6333/health
# {"status":"ok","version":"..."}
```

Collection `lcbp3_vectors` is created automatically on first vector ingest.
Vector size: **768** (nomic-embed-text output dimension).

### 1.3 n8n (Workflow Orchestrator)

```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=<secure-password> \
  -v /opt/n8n/data:/home/node/.n8n \
  n8nio/n8n:latest
```

Configure the DMS backend webhook URL as `http://<backend-ip>:3001/api/ai/callback`.

### 1.4 Redis (BullMQ + Cache)

Redis should already be running as part of the core LCBP3 stack.
BullMQ queues registered in the AI module:

| Queue | Purpose | Concurrency |
|---|---|---|
| `ai-ingest-queue` | Legacy PDF batch ingestion | 2 |
| `ai-rag-query` | RAG Q&A LLM generation | **1** (VRAM guard) |
| `ai-vector-deletion` | Async Qdrant cleanup | 3 |

---

## 2. Environment Variables (Backend `.env`)

```bash
# ─── Core AI Host ───────────────────────────────────────────
AI_HOST_URL=http://<desk-5439-ip>
AI_QDRANT_URL=http://<desk-5439-ip>:6333
AI_N8N_WEBHOOK_URL=http://<desk-5439-ip>:5678/webhook/lcbp3
AI_N8N_SERVICE_TOKEN=<generate-with: openssl rand -hex 32>

# ─── Ollama Models ──────────────────────────────────────────
OLLAMA_URL=http://<desk-5439-ip>:11434
OLLAMA_RAG_MODEL=gemma2:9b
OLLAMA_EMBED_MODEL=nomic-embed-text

# ─── RAG Tuning ─────────────────────────────────────────────
RAG_TIMEOUT_MS=30000           # 30 second LLM timeout

# ─── AI Timeout ─────────────────────────────────────────────
AI_TIMEOUT_MS=30000            # n8n extraction timeout
```

---

## 3. Usage Flows

### 3.1 RAG Conversational Q&A

```
User → RagChatWidget (Next.js)
  → POST /api/ai/rag/query  { question, projectPublicId }
  → BullMQ: ai-rag-query (concurrency=1)
  → AiRagProcessor
      → AiQdrantService.searchByProject (project isolation enforced)
      → Ollama /api/embeddings (nomic-embed-text)
      → Ollama /api/generate (gemma2:9b)
  → Redis result stored (TTL: 5min)
  → GET /api/ai/rag/jobs/:requestPublicId  (polling every 2s)
  → Response: { answer, citations, confidence }
```

**Rate limit:** 5 requests/minute per user.
**FR-009:** Only 1 active job per user at a time (Redis-enforced).
**FR-011:** Cancel via `DELETE /api/ai/rag/jobs/:requestPublicId`.

### 3.2 Real-time Document Extraction

```
User uploads document →
  POST /api/ai/extract  { attachmentPublicId, projectPublicId }
  → AiService.extractRealtime
  → n8n webhook (OCR + Gemma4 extraction)
  → POST /api/ai/callback  (n8n callback with Bearer token)
  → AiAuditLog saved with AI suggestion JSON
```

**Permission required:** `ai.extract` (standard DMS user role).

### 3.3 Legacy Migration Batch Ingest

```
n8n POST /api/ai/legacy-migration/ingest  (ServiceAccountGuard)
  → AiIngestService.ingest (PDFs → MigrationReviewRecord)
  → BullMQ: ai-ingest-queue
  → Admin reviews via GET /api/ai/legacy-migration/queue
  → POST /api/ai/legacy-migration/queue/:publicId/approve
  → MigrationService.importCorrespondence
  → AiAuditLog saved with { aiSuggestionJson, humanOverrideJson }
```

**Permission required:** `ai.migration_manage`.

### 3.4 Vector Cleanup (Async)

When an attachment is deleted:
```
RagService.deleteVectors(attachmentPublicId)
  → DocumentChunk deleted (synchronous, DB)
  → BullMQ: ai-vector-deletion (async, 3 retries exponential)
  → AiVectorDeletionProcessor
  → AiQdrantService.deleteByDocumentPublicId
```

---

## 4. Audit Logs

AI audit logs are stored in `ai_audit_logs` table.

**Hard delete (SYSTEM_ADMIN only):**
```http
DELETE /api/ai/audit-logs?olderThanDays=90
DELETE /api/ai/audit-logs?documentPublicId=<uuid>
```

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| RAG returns `RAG_NOT_READY` | Qdrant not reachable | Check `AI_QDRANT_URL`, restart Qdrant container |
| RAG returns `ไม่พบข้อมูลในเอกสารที่ระบุ` | No vectors for project | Trigger document re-ingest via RAG module |
| Callback returns 401 | Wrong `AI_N8N_SERVICE_TOKEN` | Regenerate token, update n8n + `.env` |
| Jobs stuck in `pending` | Redis/BullMQ not running | `docker ps` check Redis container |
| Ollama timeout | Model too large for VRAM | Use `gemma2:2b` for low-resource machines |
| Qdrant 5xx on vector insert | Collection not initialized | Restart backend (auto-creates collection on `onModuleInit`) |
