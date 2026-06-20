# Quickstart: OCR Sidecar Refactor

**Date**: 2026-06-20
**Purpose**: Deployment and testing guide for OCR sidecar refactor

## Prerequisites

- Access to Desk-5439 (192.168.10.100) with Docker
- Access to backend services (QNAP 192.168.10.8)
- Python 3.11+ for local testing (optional)
- pytest for testing (optional)

## Phase 1: Deployment (Before ADR-041 Consolidation)

### Step 1: Update Sidecar Code

1. Navigate to sidecar directory:
```bash
cd specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar
```

2. Update `app.py` with the following changes:
   - Remove hardcoded default API key
   - Fail-fast if `OCR_SIDECAR_API_KEY` env missing
   - Implement async I/O with `httpx.AsyncClient` via lifespan
   - Replace `@app.on_event("startup")` with lifespan context manager
   - Wire `calculate_ocr_residency()` into `process_ocr`
   - Implement path canonicalization + base-path whitelist on `/ocr`
   - Remove hardcoded runtime parameters
   - Receive systemPrompt and DMS tags from backend
   - Remove `/normalize` endpoint
   - Fix mutable default argument `options_override={}`
   - Load models via `asyncio.to_thread` during lifespan

3. Update `requirements.txt`:
```text
PyMuPDF==1.24.0
fastapi==0.111.0
uvicorn[standard]==0.30.1
python-multipart==0.0.9
httpx==0.27.0
FlagEmbedding>=1.2.0
typhoon-ocr>=0.4.1
```

4. Update `.env`:
```bash
# Phase 1 (before ADR-041)
OCR_SIDECAR_API_KEY=your-secure-api-key-here

# Common variables
OCR_SIDECAR_UPLOAD_BASE=/mnt/uploads
OLLAMA_API_URL=http://localhost:11434
OCR_MODEL=np-dms-ocr:latest
```

### Step 2: Update Backend Services

1. Update `backend/src/modules/ai/services/ocr.service.ts`:
   - Add parameter resolution from `ai_execution_profiles` (row `ocr-extract`)
   - Add Active Prompt resolution from `ai_prompts` (type `ocr_extraction`)
   - Extract systemPrompt and DMS tags from Active Prompt
   - Send resolved parameters to sidecar in OCR requests
   - Keep X-API-Key send-side (Phase 1)

2. Update `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts`:
   - Same parameter resolution pattern as OcrService
   - Keep X-API-Key send-side (Phase 1)

3. Update backend `.env`:
```bash
# Phase 1 (before ADR-041)
OCR_API_URL=http://192.168.10.100:8765
OCR_API_KEY=your-secure-api-key-here

# Common variables
OCR_SIDECAR_UPLOAD_BASE=/app/uploads
```

### Step 3: Rebuild and Deploy Sidecar

1. Build Docker image on Desk-5439:
```bash
cd specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar
docker-compose build
```

2. Stop existing container:
```bash
docker-compose down
```

3. Start new container:
```bash
docker-compose up -d
```

4. Verify health:
```bash
curl http://192.168.10.100:8765/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-06-20T10:30:00Z",
  "version": "1.0.0"
}
```

### Step 4: Deploy Backend Changes

1. Build backend:
```bash
cd backend
pnpm run build
```

2. Deploy backend containers (via existing deploy script or manual):
```bash
# From repo root
./scripts/deploy.sh
```

3. Verify backend health:
```bash
curl http://localhost:3001/api/ai/health
```

## Phase 2: Deployment (After ADR-041 Consolidation)

**Note**: This phase can only be executed after ADR-041 server consolidation completes (single Docker host).

### Step 1: Remove X-API-Key from Sidecar

1. Update `app.py` on sidecar:
   - Remove X-API-Key validation from all endpoints
   - Remove `OCR_SIDECAR_API_KEY` environment variable check

2. Update `.env` on sidecar:
```bash
# Remove OCR_SIDECAR_API_KEY line
# Keep common variables
OCR_SIDECAR_UPLOAD_BASE=/mnt/uploads
OLLAMA_API_URL=http://localhost:11434
TYPHOON_OCR_MODEL=typhoon-np-dms-ocr:latest
```

3. Rebuild and redeploy sidecar:
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### Step 2: Remove X-API-Key from Backend

1. Update `backend/src/modules/ai/services/ocr.service.ts`:
   - Remove X-API-Key header from sidecar requests
   - Remove `OCR_API_KEY` environment variable usage

2. Update `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts`:
   - Remove X-API-Key header from sidecar requests
   - Remove `OCR_API_KEY` environment variable usage

3. Update backend `.env`:
```bash
# Remove OCR_API_KEY line
# Keep common variables
OCR_API_URL=http://sidecar:8765  # Docker-internal URL
OCR_SIDECAR_UPLOAD_BASE=/app/uploads
```

4. Rebuild and redeploy backend:
```bash
cd backend
pnpm run build
./scripts/deploy.sh
```

## Testing

### Unit Tests (Sidecar)

1. Navigate to sidecar tests directory:
```bash
cd specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/tests
```

2. Run path traversal tests:
```bash
pytest test_path_traversal.py -v
```

Expected output: All tests pass, path traversal attempts return 403

3. Run residency wiring tests:
```bash
pytest test_residency_wiring.py -v
```

Expected output: All tests pass, `calculate_ocr_residency()` is called correctly

### Integration Tests (Backend)

1. Run backend AI service tests:
```bash
cd backend
pnpm test ai/ocr.service.spec.ts
pnpm test ai/sandbox-ocr-engine.service.spec.ts
```

2. Verify parameter resolution from database:
   - Check that `ai_execution_profiles` row `ocr-extract` exists
   - Check that `ai_prompts` has active row for `ocr_extraction` type
   - Verify parameters are correctly resolved and sent to sidecar

### Manual Testing

1. Test path traversal protection:
```bash
curl -X POST http://192.168.10.100:8765/ocr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "pdf_path": "/mnt/uploads/temp/../../etc/passwd",
    "runtime_params": {
      "temperature": 0.7,
      "top_p": 0.9,
      "repeat_penalty": 1.1,
      "max_tokens": 4096
    }
  }'
```

Expected: `403 Forbidden`

2. Test valid OCR request:
```bash
curl -X POST http://192.168.10.100:8765/ocr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "pdf_path": "/mnt/uploads/temp/test.pdf",
    "runtime_params": {
      "temperature": 0.7,
      "top_p": 0.9,
      "repeat_penalty": 1.1,
      "max_tokens": 4096
    }
  }'
```

Expected: `200 OK` with extracted text

3. Test parameter governance:
   - Modify `ai_execution_profiles` row `ocr-extract` parameters
   - Run OCR request
   - Verify new parameters are used (check sidecar logs)

4. Test Active Prompt integration:
   - Modify active prompt in `ai_prompts` for `ocr_extraction`
   - Run OCR request
   - Verify new system prompt is used

## Performance Testing

1. Benchmark async vs sync I/O:
```bash
# Use Apache Bench or similar tool
ab -n 1000 -c 10 -p ocr_request.json -T application/json \
  http://192.168.10.100:8765/ocr
```

Expected: 20%+ throughput improvement with async I/O

2. Monitor VRAM usage:
```bash
# On Desk-5439, monitor GPU usage during OCR operations
nvidia-smi -l 1
```

Expected: VRAM usage stays within limits, no exhaustion

## Monitoring

### Health Checks

- Sidecar health: `GET http://192.168.10.100:8765/health`
- Backend AI health: `GET http://localhost:3001/api/ai/health`

### Logs

- Sidecar logs: `docker-compose logs -f ocr-sidecar`
- Backend logs: Check backend application logs

### Metrics

- Monitor OCR request latency
- Monitor VRAM usage on Desk-5439
- Monitor error rates (403 for path traversal, 500 for internal errors)

## Rollback

If issues arise during deployment:

### Rollback Sidecar

1. Revert `app.py` to previous version
2. Restore previous `.env` file
3. Rebuild and redeploy:
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### Rollback Backend

1. Revert service changes in `ocr.service.ts` and `sandbox-ocr-engine.service.ts`
2. Restore previous `.env` file
3. Rebuild and redeploy:
```bash
cd backend
pnpm run build
./scripts/deploy.sh
```

### Emergency Rollback

If immediate rollback is needed:
1. Revert `keep_alive` to fixed value `0` in `process_ocr`
2. Restore hardcoded runtime parameters
3. Restore X-API-Key validation
4. Rebuild and redeploy

## Troubleshooting

### Sidecar fails to start

1. Check environment variables are set correctly
2. Check `OCR_SIDECAR_API_KEY` is provided (Phase 1)
3. Check Docker logs: `docker-compose logs ocr-sidecar`
4. Verify Ollama is running on Desk-5439

### Path traversal returns 200 instead of 403

1. Verify `OCR_SIDECAR_UPLOAD_BASE` is set correctly
2. Check path canonicalization logic in `app.py`
3. Test with absolute paths to verify whitelist check

### Parameters not being used

1. Check `ai_execution_profiles` row `ocr-extract` exists
2. Check backend service parameter resolution logic
3. Check sidecar receives parameters in request body
4. Check sidecar passes parameters to Ollama

### VRAM exhaustion

1. Check `calculate_ocr_residency()` is being called
2. Check `vram_monitor.py` and `residency_policy.py` are present
3. Verify CPU fallback is working for `/embed` and `/rerank`
4. Monitor GPU usage with `nvidia-smi`

## References

- ADR-040: OCR Sidecar Refactor
- ADR-036: Profile-Only Parameter Governance
- ADR-029: Dynamic Prompt Management
- ADR-037: Active Prompt System
- ADR-041: Server Consolidation (dependency for Phase 2)
- [Sidecar API Contract](./contracts/sidecar-api.md)
