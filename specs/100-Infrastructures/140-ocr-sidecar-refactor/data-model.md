# Data Model: OCR Sidecar Refactor

**Date**: 2026-06-20  
**Purpose**: Define data contracts and entity relationships for OCR sidecar refactor

## Overview

The OCR sidecar is a pure compute worker with no database access (ADR-023/023A boundary). All data persistence and business logic remain in backend services. This document defines the data contracts between backend and sidecar.

## Entities

### OCR Request (Backend → Sidecar)

```typescript
interface OcrRequest {
  pdfPath: string;           // Absolute path to PDF file (whitelisted)
  systemPrompt?: string;     // System prompt from Active Prompt
  dmsTags?: {                // DMS extraction tags from Active Prompt
    documentNumber?: string;
    documentDate?: string;
    receivedDate?: string;
  };
  runtimeParams: {           // Runtime parameters from ai_execution_profiles
    temperature: number;
    top_p: number;
    repeat_penalty: number;
    max_tokens: number;
  };
  pageRange?: {              // Page range for processing
    start: number;
    end: number;
  };
}
```

### OCR Response (Sidecar → Backend)

```typescript
interface OcrResponse {
  text: string;              // Extracted text (Markdown format)
  ocrUsed: boolean;          // Whether OCR was used (vs fast-path text layer)
  modelUsed: string;         // Model identifier (e.g., "typhoon-np-dms-ocr")
  processingTimeMs: number;  // Processing time in milliseconds
  error?: string;            // Error message if failed
}
```

### AI Execution Profile (Database)

```sql
-- Existing table (no schema changes)
CREATE TABLE ai_execution_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  profile_name VARCHAR(100) UNIQUE NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  parameters JSON NOT NULL,  -- { temperature, top_p, repeat_penalty, max_tokens, keep_alive }
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Row for OCR extraction:
-- profile_name = 'ocr-extract'
-- parameters = { temperature: 0.7, top_p: 0.9, repeat_penalty: 1.1, max_tokens: 4096 }
```

### Active Prompt (Database)

```sql
-- Existing table (no schema changes per ADR-029/037)
CREATE TABLE ai_prompts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id UUID,
  prompt_type VARCHAR(50) NOT NULL,  -- 'ocr_extraction'
  template TEXT NOT NULL,           -- System prompt template with {{ocr_text}} placeholder
  context_config JSON,               -- DMS tags configuration
  version INT NOT NULL,
  is_active TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY (prompt_type, version)
);

-- Active prompt for OCR extraction:
-- prompt_type = 'ocr_extraction'
-- template = "Extract document metadata from: {{ocr_text}}..."
-- context_config = { dmsTags: { documentNumber: true, documentDate: true, receivedDate: true } }
```

## Data Flow

### Phase 1: OCR Request Flow (Before ADR-041)

```
Backend OcrService
  ↓
1. Resolve parameters from ai_execution_profiles (row 'ocr-extract')
2. Resolve Active Prompt from ai_prompts (type 'ocr_extraction')
3. Extract systemPrompt and DMS tags from Active Prompt
4. Build OcrRequest with parameters, systemPrompt, DMS tags
5. Send POST /ocr with X-API-Key header to sidecar
  ↓
Sidecar (app.py)
  ↓
1. Validate X-API-Key
2. Canonicalize pdfPath and check whitelist
3. Extract systemPrompt and DMS tags from request
4. Call calculate_ocr_residency(active_profile) for keep_alive
5. Process OCR with Ollama (inject systemPrompt + DMS tags)
6. Return OcrResponse
  ↓
Backend OcrService
  ↓
1. Parse OcrResponse
2. Return extracted text to caller
```

### Phase 2: OCR Request Flow (After ADR-041)

```
Backend OcrService
  ↓
1. Resolve parameters from ai_execution_profiles (row 'ocr-extract')
2. Resolve Active Prompt from ai_prompts (type 'ocr_extraction')
3. Extract systemPrompt and DMS tags from Active Prompt
4. Build OcrRequest with parameters, systemPrompt, DMS tags
5. Send POST /ocr (NO X-API-Key header) to sidecar
  ↓
Sidecar (app.py)
  ↓
1. NO X-API-Key validation (network isolation only)
2. Canonicalize pdfPath and check whitelist
3. Extract systemPrompt and DMS tags from request
4. Call calculate_ocr_residency(active_profile) for keep_alive
5. Process OCR with Ollama (inject systemPrompt + DMS tags)
6. Return OcrResponse
  ↓
Backend OcrService
  ↓
1. Parse OcrResponse
2. Return extracted text to caller
```

## Backend Service Changes

### OcrService Parameter Resolution

```typescript
// backend/src/modules/ai/services/ocr.service.ts

async extractMetadata(documentId: string): Promise<AIMetadata> {
  // 1. Resolve runtime parameters from ai_execution_profiles
  const profile = await this.aiProfilesService.getActiveProfile('ocr-extract');
  const runtimeParams = profile.parameters; // { temperature, top_p, repeat_penalty, max_tokens }

  // 2. Resolve Active Prompt
  const activePrompt = await this.aiPromptsService.getActivePrompt('ocr_extraction');
  const systemPrompt = activePrompt.template;
  const dmsTags = activePrompt.context_config?.dmsTags || {};

  // 3. Build request
  const ocrRequest: OcrRequest = {
    pdfPath: document.filePath,
    systemPrompt,
    dmsTags,
    runtimeParams,
  };

  // 4. Send to sidecar (with X-API-Key in Phase 1)
  const response = await this.httpClient.post(
    `${this.ocrApiUrl}/ocr`,
    ocrRequest,
    { headers: { 'X-API-Key': this.ocrApiKey } } // Phase 1 only
  );

  return response.data;
}
```

### SandboxOcrEngineService Parameter Resolution

```typescript
// backend/src/modules/ai/services/sandbox-ocr-engine.service.ts

async processSandboxOcr(request: SandboxOcrRequest): Promise<SandboxOcrResult> {
  // Same parameter resolution pattern as OcrService
  const profile = await this.aiProfilesService.getActiveProfile('ocr-extract');
  const activePrompt = await this.aiPromptsService.getActivePrompt('ocr_extraction');

  const ocrRequest: OcrRequest = {
    pdfPath: request.pdfPath,
    systemPrompt: activePrompt.template,
    dmsTags: activePrompt.context_config?.dmsTags || {},
    runtimeParams: profile.parameters,
  };

  const response = await this.httpClient.post(
    `${this.ocrApiUrl}/ocr`,
    ocrRequest,
    { headers: { 'X-API-Key': this.ocrApiKey } } // Phase 1 only
  );

  return response.data;
}
```

## Sidecar API Changes

### POST /ocr Request Body

```python
# specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py

from pydantic import BaseModel

class OcrRequest(BaseModel):
    pdf_path: str
    system_prompt: Optional[str] = None
    dms_tags: Optional[Dict[str, str]] = None
    runtime_params: RuntimeParams
    page_range: Optional[PageRange] = None

class RuntimeParams(BaseModel):
    temperature: float
    top_p: float
    repeat_penalty: float
    max_tokens: int

class PageRange(BaseModel):
    start: int
    end: int
```

### POST /ocr Response Body

```python
class OcrResponse(BaseModel):
    text: str
    ocr_used: bool
    model_used: str
    processing_time_ms: float
    error: Optional[str] = None
```

## Environment Variables

### Sidecar Environment Variables

```bash
# specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/.env

# Phase 1 (before ADR-041)
OCR_SIDECAR_API_KEY=required_value  # Fail-fast if missing

# Phase 2 (after ADR-041) - remove OCR_SIDECAR_API_KEY

# Common variables
OCR_SIDECAR_UPLOAD_BASE=/mnt/uploads  # CIFS mount base path
OLLAMA_API_URL=http://localhost:11434
TYPHOON_OCR_MODEL=typhoon-np-dms-ocr:latest
```

### Backend Environment Variables

```bash
# backend/.env

# Phase 1 (before ADR-041)
OCR_API_URL=http://192.168.10.100:8765
OCR_API_KEY=required_value  # Send-side X-API-Key

# Phase 2 (after ADR-041) - remove OCR_API_KEY

# Common variables
OCR_SIDECAR_UPLOAD_BASE=/app/uploads  # Backend view of uploads
```

## Validation Rules

### Path Canonicalization (Sidecar)

```python
def validate_pdf_path(pdf_path: str, base_path: str) -> str:
    """Canonicalize and whitelist PDF path"""
    # 1. Canonicalize path
    canonical = os.path.abspath(os.path.realpath(pdf_path))
    
    # 2. Check whitelist
    if not canonical.startswith(base_path):
        raise HTTPException(
            status_code=403,
            detail="Path outside whitelisted base directory"
        )
    
    return canonical
```

### Parameter Validation (Backend)

```typescript
// Validate runtime parameters from ai_execution_profiles
function validateRuntimeParams(params: any): RuntimeParams {
  if (!params.temperature || params.temperature < 0 || params.temperature > 2) {
    throw new BusinessException('Invalid temperature value');
  }
  if (!params.top_p || params.top_p < 0 || params.top_p > 1) {
    throw new BusinessException('Invalid top_p value');
  }
  // ... similar validation for other params
  return params;
}
```

## No Schema Changes

This refactor does not require database schema changes:
- `ai_execution_profiles` table already exists (ADR-036)
- `ai_prompts` table already exists (ADR-029/037)
- No new tables or columns needed
- Per ADR-009: No TypeORM migrations (edit SQL directly if needed, but not needed here)
