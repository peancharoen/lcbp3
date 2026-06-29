# API Contracts: Typhoon OCR Integration

**Feature**: 232-typhoon-ocr-integration
**Date**: 2026-05-30
**Phase**: Phase 1 - Design & Contracts

## OCR Engine Selection API

### GET /api/ocr-engines

**Description**: List available OCR engines with their status and parameters

**Permission**: `system.manage_all` required

**Response**:
```json
{
  "data": [
    {
      "id": "019505a1-7c3e-7000-8000-abc123def456",
      "engineName": "Tesseract",
      "engineType": "tesseract",
      "isActive": true,
      "vramRequirementMB": 0,
      "processingTimeLimitSeconds": 30,
      "concurrentLimit": 5,
      "fallbackEngineId": null
    },
    {
      "id": "019505a1-7c3e-7000-8000-xyz789uvw012",
      "engineName": "Typhoon OCR-3B",
      "engineType": "typhoon_ocr",
      "isActive": true,
      "vramRequirementMB": 3500,
      "processingTimeLimitSeconds": 60,
      "concurrentLimit": 1,
      "fallbackEngineId": "019505a1-7c3e-7000-8000-abc123def456"
    }
  ]
}
```

### POST /api/ocr-engines/:engineId/select

**Description**: Select OCR engine for document processing

**Permission**: `system.manage_all` required

**Request Body**:
```json
{
  "documentPublicId": "019505a1-7c3e-7000-8000-doc123uuid456"
}
```

**Response**:
```json
{
  "data": {
    "engineId": "019505a1-7c3e-7000-8000-xyz789uvw012",
    "engineName": "Typhoon OCR-3B",
    "documentPublicId": "019505a1-7c3e-7000-8000-doc123uuid456",
    "status": "processing",
    "estimatedTimeSeconds": 60
  }
}
```

**Error Responses**:
- `403 Forbidden`: User lacks system.manage_all permission
- `404 Not Found`: Engine or document not found
- `503 Service Unavailable`: Ollama service unavailable, fallback to Tesseract

## AI Model Management API

### GET /api/ai-models

**Description**: List available AI models with their status and parameters

**Permission**: `system.manage_all` required

**Response**:
```json
{
  "data": [
    {
      "id": "019505a1-7c3e-7000-8000-model1uuid",
      "modelName": "gemma4:e4b",
      "modelType": "llm",
      "ollamaModelName": "gemma4:e4b",
      "vramRequirementMB": 4500,
      "isActive": true,
      "useCases": ["document_analysis", "rag"],
      "quantization": "Q8_0"
    },
    {
      "id": "019505a1-7c3e-7000-8000-model2uuid",
      "modelName": "typhoon2.1-gemma3-4b",
      "modelType": "llm",
      "ollamaModelName": "typhoon2.1-gemma3-4b",
      "vramRequirementMB": 4500,
      "isActive": true,
      "useCases": ["document_analysis", "ocr_extraction"],
      "quantization": "Q4_0"
    }
  ]
}
```

### POST /api/ai-models

**Description**: Add new AI model configuration

**Permission**: `system.manage_all` required

**Request Body**:
```json
{
  "modelName": "typhoon2.1-gemma3-4b",
  "modelType": "llm",
  "ollamaModelName": "typhoon2.1-gemma3-4b",
  "vramRequirementMB": 4500,
  "useCases": ["document_analysis", "ocr_extraction"],
  "quantization": "Q4_0"
}
```

**Response**:
```json
{
  "data": {
    "id": "019505a1-7c3e-7000-8000-model2uuid",
    "modelName": "typhoon2.1-gemma3-4b",
    "modelType": "llm",
    "ollamaModelName": "typhoon2.1-gemma3-4b",
    "vramRequirementMB": 4500,
    "isActive": true,
    "useCases": ["document_analysis", "ocr_extraction"],
    "quantization": "Q4_0",
    "createdAt": "2026-05-30T12:00:00Z"
  }
}
```

**Error Responses**:
- `403 Forbidden`: User lacks system.manage_all permission
- `400 Bad Request`: Invalid model parameters or VRAM would exceed limit
- `503 Service Unavailable`: Ollama service unavailable

### PATCH /api/ai-models/:modelId/activate

**Description**: Activate or deactivate AI model

**Permission**: `system.manage_all` required

**Request Body**:
```json
{
  "isActive": true
}
```

**Response**:
```json
{
  "data": {
    "id": "019505a1-7c3e-7000-8000-model2uuid",
    "isActive": true,
    "updatedAt": "2026-05-30T12:00:00Z"
  }
}
```

## VRAM Monitoring API

### GET /api/ai/vram/status

**Description**: Get current VRAM usage and loaded models

**Permission**: `system.manage_all` required

**Response**:
```json
{
  "data": {
    "totalVRAMMB": 8192,
    "usedVRAMMB": 4500,
    "usagePercent": 55,
    "thresholdPercent": 90,
    "loadedModels": [
      {
        "modelId": "019505a1-7c3e-7000-8000-model1uuid",
        "modelName": "gemma4:e4b",
        "vramUsageMB": 4500
      }
    ],
    "canLoadModel": true,
    "lastUpdated": "2026-05-30T12:00:00Z"
  }
}
```

## OCR Processing API (Extended)

### POST /api/ocr/process

**Description**: Process document with selected OCR engine

**Permission**: `system.manage_all` required

**Request Body**:
```json
{
  "documentPublicId": "019505a1-7c3e-7000-8000-doc123uuid456",
  "engineId": "019505a1-7c3e-7000-8000-xyz789uvw012",
  "useCache": true
}
```

**Response**:
```json
{
  "data": {
    "documentPublicId": "019505a1-7c3e-7000-8000-doc123uuid456",
    "engineId": "019505a1-7c3e-7000-8000-xyz789uvw012",
    "engineName": "Typhoon OCR-3B",
    "status": "completed",
    "text": "Extracted text content...",
    "processingTimeSeconds": 45,
    "cacheHit": false,
    "fallbackUsed": false,
    "confidence": 0.95
  }
}
```

**Error Responses**:
- `403 Forbidden`: User lacks system.manage_all permission
- `404 Not Found`: Document or engine not found
- `503 Service Unavailable`: Ollama service unavailable, fallback to Tesseract
- `504 Gateway Timeout`: Processing exceeded time limit

## Common Response Patterns

### Success Response
```json
{
  "data": { ... }
}
```

### Error Response
```json
{
  "error": {
    "message": "User-friendly error message",
    "userMessage": "เกิดข้อผิดพลาดในการประมวลผล OCR",
    "recoveryAction": "กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ",
    "errorCode": "OCR_PROCESSING_FAILED",
    "statusCode": 503
  }
}
```

## Rate Limiting

All AI-related endpoints are protected by `ThrottlerGuard` per ADR-016:
- OCR endpoints: 10 requests per minute
- AI Model Management: 5 requests per minute
- VRAM Monitoring: 20 requests per minute

## Idempotency

All POST/PUT/PATCH endpoints require `Idempotency-Key` header per ADR-016:
```
Idempotency-Key: <UUID>
```
