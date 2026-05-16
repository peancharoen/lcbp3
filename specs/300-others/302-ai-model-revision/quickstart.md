# Quickstart: AI Model Revision (ADR-023A)

**Feature**: `302-ai-model-revision`
**Date**: 2026-05-15

---

## Prerequisites

1. Desk-5439 มี Ollama พร้อมใช้งาน: `ollama list` ต้องแสดง `gemma4:e4b` และ `nomic-embed-text`
2. Qdrant instance running: `http://QDRANT_HOST:6333/health` → `{"status":"ok"}`
3. Redis 7 running (ใช้ instance เดิมกับ existing BullMQ)
4. `@qdrant/js-client-rest` ต้องติดตั้งใน backend: `npm ls @qdrant/js-client-rest`

---

## Environment Variables (เพิ่มใน `backend/.env`)

```env
# AI Infrastructure
OLLAMA_HOST=http://192.168.10.XX:11434
OLLAMA_MODEL_MAIN=gemma4:e4b
OLLAMA_MODEL_EMBED=nomic-embed-text

# Qdrant
QDRANT_HOST=http://192.168.10.XX:6333
QDRANT_COLLECTION=lcbp3_documents

# OCR
OCR_CHAR_THRESHOLD=100
OCR_API_URL=http://localhost:8765   # PaddleOCR sidecar

# BullMQ Queue Names (for reference — hardcoded in code)
# ai-realtime: RAG Q&A, AI Suggest
# ai-batch: OCR, Extract, Embed
```

---

## Verification Scenarios (สำหรับ QA / UAT)

### Scenario 1: Digital PDF Classification (Fast Path)

```bash
# 1. Upload a digital PDF via RFA form
# 2. Monitor BullMQ dashboard (if Bull Board installed)
# Expected: ai-realtime queue → ai-suggest job → completed within 30s
# Expected: ai-batch queue → embed-document job → completed in background
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/ai/jobs/status/$JOB_ID
```

### Scenario 2: Scanned PDF (OCR Path)

```bash
# 1. Upload a scanned (image-only) PDF
# Expected: ai-batch queue → ocr job first → then ai-suggest
# OCR detection: extracted_chars < 100 per page triggers slow path
```

### Scenario 3: RAG Query (Multi-tenancy Check)

```bash
# 1. Embed 2 docs in Project A, 1 doc in Project B
# 2. Query from Project A context
# Expected: results contain ONLY Project A docs
curl -X POST http://localhost:3001/api/ai/rag/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectPublicId":"<project-a-uuid>","question":"ค้นหา shop drawing หมายเลข SD-001"}'
```

### Scenario 4: Legacy Migration (Admin Only)

```bash
# 1. Trigger via n8n (or direct API for testing):
curl -X POST http://localhost:3001/api/ai/migration/queue \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Idempotency-Key: SD-001-2026:batch-001" \
  -H "Content-Type: application/json" \
  -d '{"batchId":"batch-001","filename":"SD-001.pdf","tempPath":"/uploads/temp/SD-001.pdf"}'
# 2. Check migration_review_queue: status = PENDING
# 3. Admin Approve from UI → status = IMPORTED
```

### Scenario 5: Typhoon Removal Verification

```bash
# After implementation, run:
grep -r "typhoon" backend/src --include="*.ts"
# Expected: NO results (file should be deleted)
```

### Scenario 6: GPU Overload Prevention + VRAM Verification

```bash
# 1. While ai-batch job is running, submit ai-realtime job
# Expected: ai-batch pauses; ai-realtime job completes; ai-batch resumes
# Observable via BullMQ dashboard or job status API

# 2. Measure VRAM peak during job run (verify SC-003):
nvidia-smi --query-gpu=memory.used --format=csv,noheader
# Expected: value < 5120 MB (5GB threshold per SC-003)
# Repeat during both ai-batch and ai-realtime jobs to verify peak
```

---

## Key Files to Modify (Priority Order)

| Priority | File | Change |
|---------|------|--------|
| 🔴 CRITICAL | `backend/src/modules/ai/rag/typhoon.service.ts` | DELETE |
| 🔴 CRITICAL | `backend/src/config/bullmq.config.ts` | Add `ai-batch` queue |
| 🔴 CRITICAL | `specs/03-Data-and-Storage/deltas/14-add-migration-review-queue.sql` | CREATE |
| 🟡 HIGH | `backend/src/modules/ai/services/qdrant.service.ts` | Enforce `projectPublicId` param |
| 🟡 HIGH | `backend/src/modules/ai/processors/ai-batch.processor.ts` | NEW — replace old processor |
| 🟡 HIGH | `backend/src/modules/ai/services/ocr.service.ts` | NEW — auto-detect routing |
| 🟢 NORMAL | `frontend/app/(dashboard)/ai-staging/page.tsx` | Add Migration Queue tab |
