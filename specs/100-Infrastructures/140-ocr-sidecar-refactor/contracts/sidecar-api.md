# Sidecar API Contract

**Version**: 1.1
**Date**: 2026-06-20
**Service**: OCR Sidecar (Desk-5439)
**Base URL**: `http://192.168.10.100:8765` (Phase 1) / `http://sidecar:8765` (Phase 2, Docker-internal)

## Overview

The OCR sidecar provides OCR processing and embedding/reranking capabilities as a pure compute worker. This document defines the API contract between backend services and the sidecar.

**Primary Production Endpoint**: `POST /ocr-upload` (multipart file upload). The backend services (`OcrService`, `SandboxOcrEngineService`) exclusively use `/ocr-upload` to avoid shared-volume path dependencies. The `/ocr` endpoint (path-based) is a legacy endpoint for shared-volume deployments only.

## Authentication

### Phase 1 (Before ADR-041 Consolidation)

All endpoints require `X-API-Key` header:

```http
X-API-Key: {OCR_SIDECAR_API_KEY}
```

If the header is missing or invalid, returns `401 Unauthorized`.

**Fail-Fast**: The sidecar raises `RuntimeError` on startup if `OCR_SIDECAR_API_KEY` environment variable is not set. No hardcoded default exists.

### Phase 2 (After ADR-041 Consolidation)

No authentication required. Relies on Docker-internal network isolation.

## Endpoints

### POST /ocr

Extract text from PDF file using path-based access (legacy — requires shared volume mount).

**Request Headers**:
```http
Content-Type: application/json
X-API-Key: {key}  # Phase 1 only
```

**Request Body**:
```json
{
  "pdfPath": "/mnt/uploads/temp/abc123.pdf",
  "maxPages": 0,
  "engine": "auto",
  "systemPrompt": "Extract document metadata from: {{ocr_text}}...",
  "dmsTags": {
    "document_number": "RFA-2025-001",
    "document_date": "2025-01-15",
    "received_date": "2025-01-16"
  },
  "runtimeParams": {
    "temperature": 0.1,
    "top_p": 0.5,
    "repeat_penalty": 1.0,
    "max_tokens": 16000
  }
}
```

**Request Fields**:
- `pdfPath` (string, required): Absolute path to PDF file. Must be within whitelisted base path (`OCR_SIDECAR_UPLOAD_BASE`).
- `maxPages` (number, optional): Maximum pages to process. `0` = all pages. Default: `0`.
- `engine` (string, optional): Engine selection. Values: `"auto"` (fast-path + OCR fallback), `"np-dms-ocr"`. Default: `"auto"`.
- `systemPrompt` (string, optional): System prompt from Active Prompt.
- `dmsTags` (object, optional): DMS extraction tags to inject into prompt.
- `runtimeParams` (object, optional): Runtime parameters from `ai_execution_profiles`. If omitted, Ollama Modelfile defaults are used.
  - `temperature` (number, optional): Temperature (0.0 - 2.0)
  - `top_p` (number, optional): Top P (0.0 - 1.0)
  - `repeat_penalty` (number, optional): Repeat penalty (typically 1.0 - 2.0)
  - `max_tokens` (number, optional): Max tokens

> **Note**: `keep_alive` is NOT accepted in the request. The sidecar calculates `keep_alive` internally via `calculate_ocr_residency()`. Sending `keep_alive` returns `400 Bad Request`.

**Response (200 OK)**:
```json
{
  "text": "Extracted text in Markdown format...",
  "ocrUsed": true,
  "pageCount": 3,
  "charCount": 1250,
  "engineUsed": "np-dms-ocr"
}
```

**Response Fields**:
- `text` (string): Extracted text in Markdown format
- `ocrUsed` (boolean): Whether OCR was used (vs fast-path text layer)
- `pageCount` (number): Number of pages processed
- `charCount` (number): Character count of extracted text
- `engineUsed` (string): Engine that was actually used (`"fast-path"`, `"np-dms-ocr"`)

**Error Responses**:
- `400 Bad Request`: Invalid request body, `keep_alive` in request, or empty `systemPrompt`
- `401 Unauthorized`: Missing or invalid X-API-Key (Phase 1 only)
- `403 Forbidden`: Path outside whitelisted base directory
- `404 Not Found`: PDF file not found at specified path
- `422 Unprocessable Entity`: PDF file cannot be opened

**Path Traversal Protection**:
- PDF path is canonicalized using `os.path.abspath()` + `os.path.realpath()`
- Path must be within whitelisted base path (`OCR_SIDECAR_UPLOAD_BASE`) — verified via `os.path.commonpath()`
- Symlinks are resolved to their targets before whitelist check
- Returns `403 Forbidden` for any path outside base directory

---

### POST /ocr-upload

Extract text from PDF file using multipart file upload. This is the **primary production endpoint** used by backend services.

**Request Headers**:
```http
Content-Type: multipart/form-data
X-API-Key: {key}  # Phase 1 only
```

**Form Fields**:
- `file` (binary, required): PDF file content.
- `engine` (string, optional): Engine selection. Values: `"auto"`, `"np-dms-ocr"`. Default: `"auto"`.
- `maxPages` (number, optional): Maximum pages to process. `0` = all pages. Default: `0`.
- `systemPrompt` (string, optional): System prompt from Active Prompt. Max length: `MAX_SYSTEM_PROMPT_LENGTH` (default 10000 chars). Cannot be empty if provided.
- `dmsTags` (string, optional): JSON-encoded DMS extraction tags. Example: `{"document_number":"RFA-001"}`.
- `runtimeParams` (string, optional): JSON-encoded runtime parameters. Example: `{"temperature":0.1,"top_p":0.5}`.
- `temperature` (number, optional): Override for runtime parameter.
- `topP` (number, optional): Override for runtime parameter.
- `repeatPenalty` (number, optional): Override for runtime parameter.
- `maxTokens` (number, optional): Override for runtime parameter.

> **Note**: `keep_alive` form field is NOT accepted. Sending it returns `400 Bad Request`.

**Response (200 OK)**: Same as `POST /ocr`.

**Path Traversal Safety**:
This endpoint does NOT use `validate_pdf_path()` because it does not accept user-controlled file paths. File bytes are received directly and saved to a temporary file via `tempfile.NamedTemporaryFile`. The temp file is deleted in a `finally` block after processing. This design is inherently safe from path traversal attacks.

**Error Responses**:
- `400 Bad Request`: `keep_alive` in form data, empty `systemPrompt`, or `systemPrompt` exceeds max length
- `401 Unauthorized`: Missing or invalid X-API-Key (Phase 1 only)
- `422 Unprocessable Entity`: PDF file cannot be opened

---

### POST /embed

Generate BGE-M3 embeddings (Dense + Sparse) with CPU fallback based on VRAM headroom.

**Request Headers**:
```http
Content-Type: application/json
X-API-Key: {key}  # Phase 1 only
```

**Request Body**:
```json
{
  "text": "Text to embed"
}
```

**Response (200 OK)**:
```json
{
  "dense": [0.0123, -0.0456, ...],
  "sparse": {
    "indices": [101, 205, 308],
    "values": [0.5, 0.3, 0.2]
  },
  "device": "cuda"
}
```

**Response Fields**:
- `dense` (number[]): Dense embedding vector
- `sparse` (object): Sparse lexical weights
  - `indices` (number[]): Token indices
  - `values` (number[]): Token weights
- `device` (string, nullable): Device used for inference (`"cuda"` or `"cpu"`)

**CPU Fallback Logic**:
- Queries VRAM headroom from Ollama `/api/ps`
- If query fails or available VRAM < `VRAM_HEADROOM_THRESHOLD_MB` (default 3000MB), falls back to CPU
- Timeout guard: `RETRIEVAL_TIMEOUT_SECONDS` (default 30s)

**Error Responses**:
- `401 Unauthorized`: Missing or invalid X-API-Key (Phase 1 only)
- `503 Service Unavailable`: BGE-M3 model not loaded
- `504 Gateway Timeout`: Embedding generation timed out
- `500 Internal Server Error`: Embedding generation failed

---

### POST /rerank

Re-rank text chunks using BGE-Reranker-Large with CPU fallback based on VRAM headroom.

**Request Headers**:
```http
Content-Type: application/json
X-API-Key: {key}  # Phase 1 only
```

**Request Body**:
```json
{
  "query": "Search query",
  "chunks": ["Chunk 1 text", "Chunk 2 text", ...]
}
```

**Response (200 OK)**:
```json
{
  "scores": [0.95, 0.72],
  "rankedIndices": [0, 1],
  "device": "cuda"
}
```

**Response Fields**:
- `scores` (number[]): Relevance scores for each chunk
- `rankedIndices` (number[]): Chunk indices sorted by score (descending)
- `device` (string, nullable): Device used for inference (`"cuda"` or `"cpu"`)

**CPU Fallback Logic**: Same as `/embed`.

**Error Responses**:
- `401 Unauthorized`: Missing or invalid X-API-Key (Phase 1 only)
- `503 Service Unavailable`: Reranker model not loaded
- `504 Gateway Timeout`: Reranking timed out
- `500 Internal Server Error`: Reranking failed

---

### GET /health

Health check endpoint for monitoring.

**Response (200 OK)**:
```json
{
  "status": "ok",
  "engine": "np-dms-ocr",
  "ocrModel": "np-dms-ocr:latest",
  "ollamaUrl": "http://host.docker.internal:11434"
}
```

**Response Fields**:
- `status` (string): Service status (`"ok"`)
- `engine` (string): Canonical engine name (`"np-dms-ocr"`)
- `ocrModel` (string): Configured OCR model name from `OCR_MODEL` env var
- `ollamaUrl` (string): Ollama API URL from `OLLAMA_API_URL` env var

## Removed Endpoints

### POST /normalize (REMOVED)

This endpoint has been removed per ADR-040 D2. ThaiPreprocessProcessor has no consumers in the backend (verified by grep search).

## Rate Limiting

No rate limiting implemented on sidecar. Rate limiting is handled by backend services.

## Error Handling

All errors return FastAPI's default `HTTPException` response format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes**:
- `400`: Bad request (invalid params, `keep_alive` sent, empty/oversized `systemPrompt`)
- `401`: Unauthorized (missing or invalid `X-API-Key`)
- `403`: Forbidden (path outside whitelisted directory)
- `404`: Not found (PDF file not found on `/ocr`)
- `422`: Unprocessable entity (PDF cannot be opened)
- `503`: Service unavailable (model not loaded for `/embed` or `/rerank`)
- `504`: Gateway timeout (embedding/reranking timed out)
- `500`: Internal server error

## Examples

### Example 1: OCR Upload (Primary Production Path)

```bash
curl -X POST http://192.168.10.100:8765/ocr-upload \
  -H "X-API-Key: your-api-key" \
  -F "file=@document.pdf" \
  -F "engine=np-dms-ocr" \
  -F "systemPrompt=Extract metadata from: {{ocr_text}}" \
  -F "runtimeParams={\"temperature\":0.1,\"top_p\":0.5}"
```

### Example 2: Path-Based OCR (Legacy, Phase 1)

```bash
curl -X POST http://192.168.10.100:8765/ocr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "pdfPath": "/mnt/uploads/temp/document.pdf",
    "engine": "auto"
  }'
```

### Example 3: Embedding Request

```bash
curl -X POST http://192.168.10.100:8765/embed \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"text": "Document text to embed"}'
```

### Example 4: Reranking Request

```bash
curl -X POST http://192.168.10.100:8765/rerank \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"query": "RFA approval", "chunks": ["Chunk 1", "Chunk 2"]}'
```

### Example 5: Path Traversal Attempt (Rejected on /ocr)

```bash
curl -X POST http://192.168.10.100:8765/ocr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"pdfPath": "/mnt/uploads/temp/../../etc/passwd"}'
```

Response: `403 Forbidden`

```json
{"detail": "Path outside whitelisted base directory"}
```

> **Note**: `/ocr-upload` is inherently safe from path traversal because it accepts file bytes, not file paths.

## Version History

- **1.1** (2026-06-20): Aligned contract with actual implementation
  - Fixed field naming to camelCase (matching Pydantic models)
  - Added POST /ocr-upload endpoint (primary production path)
  - Added POST /embed endpoint (BGE-M3 embeddings)
  - Added POST /rerank endpoint (BGE-Reranker-Large)
  - Fixed GET /health response to match implementation
  - Fixed error response format to FastAPI default `{"detail": "..."}`
  - Fixed OcrResponse fields (pageCount, charCount, engineUsed)
  - Replaced page_range with maxPages in request
  - Documented path traversal safety for /ocr-upload
  - Documented keep_alive rejection
  - Marked /ocr as legacy endpoint
- **1.0** (2026-06-20): Initial version for OCR sidecar refactor
  - Added POST /ocr with parameter governance
  - Added path traversal protection
  - Removed POST /normalize endpoint
  - Documented Phase 1/Phase 2 auth migration
