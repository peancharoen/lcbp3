# Sidecar API Contract

**Version**: 1.0  
**Date**: 2026-06-20  
**Service**: OCR Sidecar (Desk-5439)  
**Base URL**: `http://192.168.10.100:8765` (Phase 1) / `http://sidecar:8765` (Phase 2, Docker-internal)

## Overview

The OCR sidecar provides OCR processing capabilities as a pure compute worker. This document defines the API contract between backend services and the sidecar.

## Authentication

### Phase 1 (Before ADR-041 Consolidation)

All endpoints require `X-API-Key` header:

```http
X-API-Key: {OCR_SIDECAR_API_KEY}
```

If the header is missing or invalid, returns `401 Unauthorized`.

### Phase 2 (After ADR-041 Consolidation)

No authentication required. Relies on Docker-internal network isolation.

## Endpoints

### POST /ocr

Extract text from PDF file using Typhoon OCR.

**Request Headers**:
```http
Content-Type: application/json
X-API-Key: {key}  # Phase 1 only
```

**Request Body**:
```json
{
  "pdf_path": "/mnt/uploads/temp/abc123.pdf",
  "system_prompt": "Extract document metadata from: {{ocr_text}}...",
  "dms_tags": {
    "document_number": "RFA-2025-001",
    "document_date": "2025-01-15",
    "received_date": "2025-01-16"
  },
  "runtime_params": {
    "temperature": 0.7,
    "top_p": 0.9,
    "repeat_penalty": 1.1,
    "max_tokens": 4096
  },
  "page_range": {
    "start": 1,
    "end": 3
  }
}
```

**Request Fields**:
- `pdf_path` (string, required): Absolute path to PDF file. Must be within whitelisted base path (`OCR_SIDECAR_UPLOAD_BASE`).
- `system_prompt` (string, optional): System prompt from Active Prompt. Contains `{{ocr_text}}` placeholder.
- `dms_tags` (object, optional): DMS extraction tags to inject into prompt.
  - `document_number` (string, optional): Document number
  - `document_date` (string, optional): Document date
  - `received_date` (string, optional): Received date
- `runtime_params` (object, required): Runtime parameters from `ai_execution_profiles`.
  - `temperature` (number, required): Temperature (0.0 - 2.0)
  - `top_p` (number, required): Top P (0.0 - 1.0)
  - `repeat_penalty` (number, required): Repeat penalty (typically 1.0 - 2.0)
  - `max_tokens` (number, required): Max tokens
- `page_range` (object, optional): Page range for processing.
  - `start` (number, required): Start page (1-indexed)
  - `end` (number, required): End page (inclusive)

**Response (200 OK)**:
```json
{
  "text": "Extracted text in Markdown format...",
  "ocr_used": true,
  "model_used": "typhoon-np-dms-ocr:latest",
  "processing_time_ms": 1250,
  "error": null
}
```

**Response Fields**:
- `text` (string): Extracted text in Markdown format
- `ocr_used` (boolean): Whether OCR was used (vs fast-path text layer)
- `model_used` (string): Model identifier
- `processing_time_ms` (number): Processing time in milliseconds
- `error` (string, nullable): Error message if failed

**Error Responses**:
- `400 Bad Request`: Invalid request body or parameters
- `401 Unauthorized`: Missing or invalid X-API-Key (Phase 1 only)
- `403 Forbidden`: Path outside whitelisted base directory
- `500 Internal Server Error`: Internal processing error

**Path Traversal Protection**:
- PDF path is canonicalized using `os.path.abspath()` + `os.path.realpath()`
- Path must start with whitelisted base path (`OCR_SIDECAR_UPLOAD_BASE`)
- Symlinks are resolved to their targets before whitelist check
- Returns `403 Forbidden` for any path outside base directory

### GET /health

Health check endpoint for monitoring.

**Response (200 OK)**:
```json
{
  "status": "healthy",
  "timestamp": "2026-06-20T10:30:00Z",
  "version": "1.0.0"
}
```

**Response Fields**:
- `status` (string): Service status ("healthy" or "unhealthy")
- `timestamp` (string): ISO 8601 timestamp
- `version` (string): Service version

## Removed Endpoints

### POST /normalize (REMOVED)

This endpoint has been removed per ADR-040 D2. ThaiPreprocessProcessor has no consumers in the backend (verified by grep search).

## Rate Limiting

No rate limiting implemented on sidecar. Rate limiting is handled by backend services.

## Error Handling

All errors return JSON responses with consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

**Common Error Codes**:
- `INVALID_REQUEST`: Invalid request body or parameters
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Path outside whitelisted directory
- `INTERNAL_ERROR`: Internal processing error
- `OCR_FAILED`: OCR processing failed

## Examples

### Example 1: Basic OCR Request (Phase 1)

```bash
curl -X POST http://192.168.10.100:8765/ocr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "pdf_path": "/mnt/uploads/temp/document.pdf",
    "runtime_params": {
      "temperature": 0.7,
      "top_p": 0.9,
      "repeat_penalty": 1.1,
      "max_tokens": 4096
    }
  }'
```

### Example 2: OCR with System Prompt and DMS Tags (Phase 1)

```bash
curl -X POST http://192.168.10.100:8765/ocr \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "pdf_path": "/mnt/uploads/temp/document.pdf",
    "system_prompt": "Extract document metadata from: {{ocr_text}}",
    "dms_tags": {
      "document_number": "RFA-2025-001",
      "document_date": "2025-01-15"
    },
    "runtime_params": {
      "temperature": 0.7,
      "top_p": 0.9,
      "repeat_penalty": 1.1,
      "max_tokens": 4096
    }
  }'
```

### Example 3: OCR Request (Phase 2, Docker-internal)

```bash
curl -X POST http://sidecar:8765/ocr \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_path": "/mnt/uploads/temp/document.pdf",
    "runtime_params": {
      "temperature": 0.7,
      "top_p": 0.9,
      "repeat_penalty": 1.1,
      "max_tokens": 4096
    }
  }'
```

### Example 4: Path Traversal Attempt (Rejected)

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

Response: `403 Forbidden`

```json
{
  "error": "Path outside whitelisted base directory",
  "code": "FORBIDDEN",
  "timestamp": "2026-06-20T10:30:00Z"
}
```

## Version History

- **1.0** (2026-06-20): Initial version for OCR sidecar refactor
  - Added POST /ocr with parameter governance
  - Added path traversal protection
  - Removed POST /normalize endpoint
  - Documented Phase 1/Phase 2 auth migration
