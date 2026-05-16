# Quickstart: AI Model Revision (ADR-023A)

**Feature**: `302-ai-model-revision`
**Date**: 2026-05-15

---

## Prerequisites

### 1. Ollama on Desk-5439 (AI Inference Engine)

**Requirements:**
- **OS**: Windows 10/11 หรือ Linux (Desk-5439)
- **GPU**: NVIDIA GPU ที่รองรับ CUDA 11.8+ (VRAM ≥ 6GB แนะนำ)
- **Ollama Version**: ≥ 0.5.0
- **Models**: `gemma4:e2b` (Q4_K_M quantization) + `nomic-embed-text`

**Verification Steps:**

```bash
# 1. Check Ollama installation
ollama --version
# Expected: ollama version is 0.5.0 or higher

# 2. Verify GPU access
nvidia-smi
# Expected: NVIDIA GPU detected with CUDA 11.8+

# 3. List installed models
ollama list
# Expected output:
# NAME                    ID              SIZE      MODIFIED
# gemma4:e2b              <hash>          2.4 GB    <timestamp>
# nomic-embed-text        <hash>          274 MB    <timestamp>

# 4. Test model inference (quick test)
ollama run gemma4:e2b "Hello, test response"
# Expected: Gemma4 generates text response within 5-10s

# 5. Test embedding model
ollama run nomic-embed-text "test text"
# Expected: Returns 768-dimensional vector
```

**Installation Commands (if missing):**

```bash
# Install Ollama (Windows)
# Download from: https://ollama.com/download/windows

# Pull models
ollama pull gemma4:e2b
ollama pull nomic-embed-text

# Verify VRAM usage during inference
nvidia-smi --query-gpu=memory.used --format=csv,noheader
# Expected: < 5120 MB (5GB threshold per SC-003)
```

**Troubleshooting:**
- **Ollama not responding**: Check if Ollama service is running (`services.msc` on Windows)
- **GPU not detected**: Verify NVIDIA driver and CUDA installation
- **Model pull fails**: Check internet connection and proxy settings
- **VRAM overflow**: Reduce concurrent jobs (BullMQ concurrency=1 enforced)

---

### 2. Qdrant Vector Database (Semantic Search)

**Requirements:**
- **Version**: Qdrant ≥ 1.7.0
- **Storage**: ≥ 10GB free space (for ~20,000 docs × 768-dim vectors)
- **Network**: Accessible from backend container (`http://QDRANT_HOST:6333`)
- **Collection**: `lcbp3_documents` (auto-created on first use)

**Verification Steps:**

```bash
# 1. Check Qdrant health
curl http://192.168.10.XX:6333/health
# Expected: {"status":"ok"}

# 2. Check collections (if already created)
curl http://192.168.10.XX:6333/collections
# Expected: {"result":{"collections":[...]}} or empty array

# 3. Verify Qdrant metrics (optional)
curl http://192.168.10.XX:6333/metrics
# Expected: Prometheus metrics output
```

**Installation Commands (Docker - recommended):**

```bash
# Run Qdrant container (QNAP or ASUSTOR)
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant:v1.7.0

# Or use docker-compose (add to existing compose file)
# See: specs/04-Infrastructure-OPS/04-00-docker-compose/
```

**Troubleshooting:**
- **Connection refused**: Check if Qdrant container is running (`docker ps`)
- **Port conflict**: Ensure port 6333 is not used by other services
- **Storage errors**: Verify disk space and permissions on mounted volume
- **Network issues**: Check firewall rules allow traffic on port 6333

---

### 3. Redis 7 (BullMQ Queue Backend)

**Requirements:**
- **Version**: Redis ≥ 7.0.0
- **Persistence**: AOF enabled (recommended for job durability)
- **Memory**: ≥ 2GB (for job queue storage)
- **Network**: Accessible from backend container (`redis://REDIS_HOST:6379`)

**Verification Steps:**

```bash
# 1. Check Redis version
redis-cli -h 192.168.10.XX -p 6379 INFO server | grep redis_version
# Expected: redis_version=7.x.x

# 2. Check Redis health
redis-cli -h 192.168.10.XX -p 6379 PING
# Expected: PONG

# 3. Check existing queues (if any)
redis-cli -h 192.168.10.XX -p 6379 KEYS "bull:*"
# Expected: May show existing BullMQ queues from other modules

# 4. Check memory usage
redis-cli -h 192.168.10.XX -p 6379 INFO memory | grep used_memory_human
# Expected: used_memory_human:<value> (monitor for growth)
```

**Configuration Notes:**
- Use existing Redis instance from BullMQ setup (ADR-008)
- No additional configuration needed for 2-queue setup
- Queue names: `ai-realtime` and `ai-batch` (auto-created by BullMQ)

**Troubleshooting:**
- **Connection timeout**: Check Redis service status and network connectivity
- **Memory overflow**: Monitor Redis memory usage, enable maxmemory policy if needed
- **Queue not created**: Check BullMQ configuration in `backend/src/config/bullmq.config.ts`

---

### 4. Backend Dependencies (NestJS + AI Libraries)

**Requirements:**
- **Node.js**: ≥ 18.x (LTS)
- **npm/pnpm**: Latest version
- **TypeScript**: ≥ 5.x

**Required Packages:**

```bash
# Navigate to backend directory
cd backend

# Check installed packages
npm ls @qdrant/js-client-rest
# Expected: @qdrant/js-client-rest@1.x.x

# Check other AI-related packages
npm ls bullmq ioredis
# Expected: bullmq@5.x.x, ioredis@5.x.x

# Install missing packages (if any)
npm install @qdrant/js-client-rest
npm install bullmq ioredis --save
```

**Verification Steps:**

```bash
# 1. Check package.json
cat package.json | grep -A 5 "dependencies"
# Expected: Should include @qdrant/js-client-rest, bullmq, ioredis

# 2. Verify TypeScript compilation
npm run build
# Expected: No compilation errors

# 3. Check environment variables
cat .env | grep -E "OLLAMA|QDRANT|OCR|REDIS"
# Expected: All AI-related variables set (see Environment Variables section)
```

**Troubleshooting:**
- **Package not found**: Run `npm install` to restore dependencies
- **TypeScript errors**: Check tsconfig.json and type definitions
- **Env variables missing**: Copy from `.env.example` and configure

---

### 5. PaddleOCR Sidecar (OCR Engine)

**Requirements:**
- **Python**: ≥ 3.8
- **PaddlePaddle**: ≥ 2.5.0
- **PaddleOCR**: ≥ 2.7.0
- **API Server**: HTTP endpoint on port 8765 (default)

**Verification Steps:**

```bash
# 1. Check PaddleOCR API health
curl http://localhost:8765/health
# Expected: {"status":"ok"} or similar

# 2. Test OCR on sample image
curl -X POST http://localhost:8765/ocr \
  -F "image=@sample.png" \
  -F "lang=th"
# Expected: JSON with extracted text

# 3. Check OCR character threshold setting
# (Backend env var: OCR_CHAR_THRESHOLD=100)
# This determines when to use PaddleOCR vs PyMuPDF
```

**Installation Commands (if not already set up):**

```bash
# Install PaddleOCR (Python)
pip install paddleocr paddlepaddle

# Run OCR API server (example)
python -m paddleocr.serve --port 8765
```

**Troubleshooting:**
- **API not responding**: Check if PaddleOCR server is running
- **OCR fails on Thai text**: Verify Thai language model is installed
- **Slow performance**: Consider GPU acceleration for PaddleOCR

---

### 6. Network Configuration & Firewall

**Requirements:**
- **Desk-5439 (Ollama)**: Port 11434 accessible from backend
- **Qdrant Server**: Port 6333 accessible from backend
- **Redis Server**: Port 6379 accessible from backend
- **PaddleOCR**: Port 8765 accessible from backend (if sidecar on same host)

**Verification Steps:**

```bash
# Test connectivity from backend container
# (Run these commands inside backend container or from backend host)

# 1. Test Ollama
curl http://192.168.10.XX:11434/api/tags
# Expected: JSON with model list

# 2. Test Qdrant
curl http://192.168.10.XX:6333/health
# Expected: {"status":"ok"}

# 3. Test Redis
redis-cli -h 192.168.10.XX -p 6379 PING
# Expected: PONG

# 4. Test PaddleOCR (if on separate host)
curl http://192.168.10.XX:8765/health
# Expected: {"status":"ok"}
```

**Troubleshooting:**
- **Connection timeout**: Check firewall rules on target hosts
- **DNS resolution issues**: Use IP addresses instead of hostnames
- **VPN/Network segmentation**: Ensure backend can reach AI infrastructure network

---

### 7. GPU Resource Monitoring (Critical for SC-003)

**Requirements:**
- **VRAM Limit**: ≤ 5GB peak (per SC-003)
- **Concurrency**: 1 job per queue (enforced by BullMQ)

**Verification Commands:**

```bash
# Monitor VRAM in real-time
watch -n 1 nvidia-smi --query-gpu=memory.used --format=csv,noheader

# Check GPU utilization during job execution
nvidia-smi dmon -s u

# Log VRAM usage to file (for analysis)
nvidia-smi --query-gpu=timestamp,memory.used,utilization.gpu \
  --format=csv -l 1 > gpu_usage.log
```

**Expected Behavior:**
- **ai-batch job**: VRAM peaks at ~2.5GB (gemma4:e2b Q4_K_M)
- **ai-realtime job**: VRAM peaks at ~2.5GB (same model)
- **No concurrent jobs**: ai-batch pauses when ai-realtime active (GPU protection)

**Troubleshooting:**
- **VRAM overflow (>5GB)**: Reduce model quantization or increase GPU memory
- **GPU contention**: Verify BullMQ concurrency=1 enforcement
- **Slow inference**: Check GPU utilization, consider faster model quantization

---

## Environment Variables (เพิ่มใน `backend/.env`)

```env
# AI Infrastructure
OLLAMA_HOST=http://192.168.10.XX:11434
OLLAMA_MODEL_MAIN=gemma4:e2b
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
