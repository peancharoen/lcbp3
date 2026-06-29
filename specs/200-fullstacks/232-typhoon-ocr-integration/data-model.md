# Data Model: Typhoon OCR Integration

**Feature**: 232-typhoon-ocr-integration
**Date**: 2026-05-30
**Phase**: Phase 1 - Design & Contracts

## Entities

### OCR Engine Configuration

**Purpose**: Represents available OCR engines with their parameters and resource requirements

**Fields**:
- `engineId`: string (UUIDv7) - Unique identifier for OCR engine configuration
- `engineName`: string - Engine name (e.g., "Tesseract", "Typhoon OCR-3B")
- `engineType`: enum - Engine type (tesseract, typhoon_ocr)
- `isActive`: boolean - Whether engine is currently available
- `vramRequirementMB`: number - VRAM requirement in MB (for AI-based engines)
- `processingTimeLimitSeconds`: number - Maximum processing time per page
- `concurrentLimit`: number - Maximum concurrent requests (1 for Typhoon)
- `fallbackEngineId`: string (UUIDv7, nullable) - Fallback engine when unavailable
- `createdAt`: datetime - Configuration creation timestamp
- `updatedAt`: datetime - Configuration last update timestamp

**Relationships**:
- One-to-many: OCR Engine Configuration → OCR Processing Logs
- Many-to-one: OCR Engine Configuration → OCR Engine Configuration (fallback)

**Validation Rules**:
- `engineName` must be unique
- `vramRequirementMB` required for AI-based engines
- `concurrentLimit` must be >= 1
- `fallbackEngineId` must reference valid engine or be null

### AI Model Configuration

**Purpose**: Represents available AI models with their VRAM requirements and use cases

**Fields**:
- `modelId`: string (UUIDv7) - Unique identifier for AI model configuration
- `modelName`: string - Model name (e.g., "gemma4:e4b", "typhoon2.1-gemma3-4b")
- `modelType`: enum - Model type (llm, embedding, ocr)
- `ollamaModelName`: string - Ollama model identifier
- `vramRequirementMB`: number - VRAM requirement in MB
- `isActive`: boolean - Whether model is currently available
- `useCases`: string[] - Supported use cases (e.g., ["document_analysis", "ocr_extraction"])
- `quantization`: string (nullable) - Quantization type (e.g., "Q3_K_M")
- `createdAt`: datetime - Configuration creation timestamp
- `updatedAt`: datetime - Configuration last update timestamp

**Relationships**:
- One-to-many: AI Model Configuration → AI Audit Logs

**Validation Rules**:
- `modelName` must be unique
- `vramRequirementMB` required
- `ollamaModelName` must match Ollama registry
- `useCases` must include at least one valid use case

### VRAM Monitor State

**Purpose**: Tracks GPU VRAM usage across all loaded AI models

**Fields**:
- `monitorId`: string (UUIDv7) - Unique identifier for monitor state
- `totalVRAMMB`: number - Total GPU VRAM in MB
- `usedVRAMMB`: number - Currently used VRAM in MB
- `loadedModels`: string[] - List of loaded model IDs
- `lastUpdated`: datetime - Last update timestamp
- `thresholdPercent`: number - VRAM usage threshold (default: 90)

**Validation Rules**:
- `usedVRAMMB` must be <= `totalVRAMMB`
- `thresholdPercent` must be between 0 and 100
- `loadedModels` must reference valid AI Model Configurations

### OCR Processing Log

**Purpose**: Logs all OCR processing attempts for audit and debugging

**Fields**:
- `logId`: string (UUIDv7) - Unique identifier for log entry
- `documentPublicId`: string - Document being processed
- `engineId`: string (UUIDv7) - OCR engine used
- `processingTimeSeconds`: number - Actual processing time
- `success`: boolean - Whether processing succeeded
- `errorMessage`: string (nullable) - Error message if failed
- `fallbackUsed`: boolean - Whether fallback engine was used
- `cacheHit`: boolean - Whether result was from cache
- `timestamp`: datetime - Processing timestamp

**Relationships**:
- Many-to-one: OCR Processing Log → OCR Engine Configuration

**Validation Rules**:
- `documentPublicId` required
- `engineId` must reference valid engine
- `processingTimeSeconds` must be >= 0

### AI Audit Log (Existing - Extended)

**Purpose**: Logs all AI interactions per ADR-023/023A

**Extensions for Typhoon Integration**:
- Add `modelType` field to distinguish between LLM, OCR, and embedding models
- Add `vramUsageMB` field to track VRAM consumption per interaction
- Add `cacheHit` field to track cache utilization

## State Transitions

### OCR Engine Configuration

```
Created → Active → Inactive → Deleted
```

- **Created**: Initial state when engine configuration is added
- **Active**: Engine is available for use
- **Inactive**: Engine is temporarily unavailable (e.g., Ollama down)
- **Deleted**: Engine configuration is removed

### AI Model Configuration

```
Created → Active → Inactive → Deleted
```

- **Created**: Initial state when model configuration is added
- **Active**: Model is available for use
- **Inactive**: Model is temporarily unavailable (e.g., VRAM constraints)
- **Deleted**: Model configuration is removed

## Schema Changes

No new database tables required. Existing tables will be extended:

- `ai_prompts`: Add Typhoon OCR prompt templates
- `ai_audit_logs`: Add modelType, vramUsageMB, cacheHit fields
- New configuration tables may be added in Redis for performance (OCR Engine Configuration, AI Model Configuration)

## Data Dictionary Updates

Add entries for:
- OCR Engine Configuration
- AI Model Configuration
- VRAM Monitor State
- OCR Processing Log
