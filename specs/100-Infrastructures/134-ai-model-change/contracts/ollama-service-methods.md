// File: specs/100-Infrastructures/134-ai-model-change/contracts/ollama-service-methods.md
// Change Log:
// - 2026-06-03: API contracts for OllamaService model management methods

# Contract: OllamaService Model Management Methods

---

## Method: unloadModel

**Signature**: `async unloadModel(modelName: string): Promise<void>`
**Location**: `backend/src/modules/ai/services/ollama.service.ts`
**Purpose**: Force unload a model from Ollama VRAM

### Ollama API Call

```http
POST http://{OLLAMA_BASE_URL}/api/generate
Content-Type: application/json

{
  "model": "{modelName}",
  "prompt": "",
  "keep_alive": 0
}
```

### Success Behavior

- HTTP 200 → model unloaded from VRAM
- Model already unloaded / not found → log warn; no-op (not fatal)

### Error Handling

| Error | Behavior |
|-------|----------|
| HTTP timeout (> 5s) | Throw `Error('Failed to unload model {modelName}: timeout')` |
| Network error | Throw `Error('Failed to unload model {modelName}: {axiosError.message}')` |
| HTTP 404 (model not found) | Log warn; resolve without throwing |

---

## Method: loadModel

**Signature**: `async loadModel(modelName: string, keepAlive?: number | string): Promise<void>`
**Location**: `backend/src/modules/ai/services/ollama.service.ts`
**Purpose**: Load / warm a model into Ollama VRAM

### Ollama API Call

```http
POST http://{OLLAMA_BASE_URL}/api/generate
Content-Type: application/json

{
  "model": "{modelName}",
  "prompt": "",
  "keep_alive": {keepAlive ?? -1}
}
```

### keepAlive Values

| Value | Behavior |
|-------|----------|
| `-1` | Model stays in VRAM indefinitely (main model) |
| `0` | Model unloads after request completes (OCR model) |
| `"5m"` | Model unloads after 5 minutes (alternative) |

### Success Behavior

- HTTP 200 → model loaded into VRAM

### Error Handling

| Error | Behavior |
|-------|----------|
| HTTP timeout (> 60s, cold start) | Throw `Error('Failed to load model {modelName}: timeout (cold start may take up to 60s)')` |
| HTTP 404 (model not found) | Throw `Error('Model {modelName} not found on Ollama. Run: ollama create {modelName} -f ./{modelName}.model.md')` |
| Network error | Throw `Error('Failed to load model {modelName}: {axiosError.message}')` |

---

## BullMQ Processor: Model Switching Contract

**Location**: `backend/src/modules/ai/processors/ai-batch.processor.ts`

### OCR Job Types Constant

```typescript
const OCR_JOB_TYPES: string[] = ['ocr-extract', 'sandbox-ocr-only'];
```

### Switching Sequence (Pseudocode)

```
processJob(job: Job):
  if job.data.jobType ∈ OCR_JOB_TYPES:
    log.log(`[ModelSwitch] Unloading ${DEFAULT_MODEL}`)
    await ollamaService.unloadModel(DEFAULT_MODEL)          // free ~2.5GB

    log.log(`[ModelSwitch] Loading ${OCR_MODEL} (keep_alive: 0)`)
    await ollamaService.loadModel(OCR_MODEL, 0)             // load ~3.2GB

    result = await runOcrJob(job)
    // OCR model auto-unloads via keep_alive: 0

    log.log(`[ModelSwitch] Reloading ${DEFAULT_MODEL} (keep_alive: -1)`)
    await ollamaService.loadModel(DEFAULT_MODEL, -1)         // restore main model

    return result
  else:
    return await runMainModelJob(job)
```

### Concurrency Constraint

- BullMQ concurrency = 1 (ป้องกัน VRAM overflow)
- ไม่มี parallel OCR + main jobs
- ถ้า job fail ระหว่าง switching → BullMQ retry จาก ต้นใหม่ทั้ง sequence

---

## Health Response Contract Update

**Endpoint**: `GET /api/ai/health`
**Location**: `backend/src/modules/ai/ai.service.ts`

### Updated Response Shape

```typescript
interface SystemHealthResponse {
  ollama: {
    status: 'HEALTHY' | 'DOWN';
    mainModel: string;   // 'typhoon2.5-np-dms:latest'
    ocrModel: string;    // 'typhoon-np-dms-ocr:latest'
    latencyMs?: number;
  };
  ocr: OcrHealthResult;
  // ... existing fields
}
```
