# Research: OCR Sidecar Refactor

**Date**: 2026-06-20  
**Purpose**: Document technical decisions and research findings from ADR-040

## Overview

All technical decisions for this refactor are already documented in ADR-040. This file consolidates those decisions for implementation reference.

## Security Decisions

### Hardcoded API Key Removal
- **Decision**: Remove hardcoded default API key (`lcbp3-dms-ocr-sidecar-secure-token-2026`) from `app.py`
- **Rationale**: Security vulnerability - if leaked, key cannot be rotated without rebuilding container
- **Implementation**: Fail-fast if `OCR_SIDECAR_API_KEY` environment variable is missing
- **Phase**: Phase 1 (before ADR-041 consolidation)

### Path Traversal Hardening
- **Decision**: Implement path canonicalization + base-path whitelist on `/ocr` endpoint
- **Rationale**: Prevent arbitrary file read attacks (ADR-016)
- **Implementation**:
  - Use `os.path.abspath()` + `os.path.realpath()` for canonicalization
  - Whitelist base path = `OCR_SIDECAR_UPLOAD_BASE` (CIFS mount base)
  - Reject paths outside base path → 403 Forbidden
- **Alternatives Considered**:
  - Using path validation regex only → rejected (insufficient for symlink attacks)
  - Chroot jail → rejected (overkill for this use case)

## I/O Pattern Decisions

### Async I/O Refactor
- **Decision**: Refactor `process_ocr` to `async def` and use `httpx.AsyncClient` shared via lifespan
- **Rationale**: Synchronous blocking I/O reduces throughput under load; FastAPI event loop blocked
- **Implementation**:
  - Replace `httpx.Client` with `httpx.AsyncClient`
  - Create AsyncClient in lifespan context manager
  - Load models via `asyncio.to_thread` to avoid blocking startup
- **Performance Target**: 20%+ throughput improvement under concurrent load
- **Alternatives Considered**:
  - Keep sync I/O but add more workers → rejected (still blocks event loop)
  - Use thread pool → rejected (adds complexity without solving root cause)

### Lifespan Pattern
- **Decision**: Replace `@app.on_event("startup")` with `@asynccontextmanager` lifespan
- **Rationale**: Deprecated pattern; lifespan provides better resource management and cleanup
- **Implementation**: Use FastAPI lifespan context manager for AsyncClient lifecycle

## GPU Resource Management Decisions

### Adaptive OCR Residency
- **Decision**: Wire `calculate_ocr_residency(active_profile)` into `process_ocr` for dynamic `keep_alive`
- **Rationale**: Preserve Adaptive OCR Residency policy from CONTEXT.md; avoid fixed values
- **Implementation**:
  - Import `calculate_ocr_residency` from `residency_policy.py`
  - Call function during OCR request to calculate appropriate keep_alive
  - Do NOT accept explicit `options_override["keep_alive"]` from backend
  - keep_alive is a lazy resource parameter calculated at process time (ADR-036 Gap-2)
- **Alternatives Rejected**:
  - Fixed `keep_alive=0` (Claude plan) → rejected (violates ADR-036 Gap-2)
  - Fixed `keep_alive=10m` (Qwen plan) → rejected (violates adaptive policy)

### Retain VRAM Monitor and Residency Policy
- **Decision**: Retain `vram_monitor.py` and `residency_policy.py` modules
- **Rationale**: LLM-First GPU Ownership + CPU Fallback Retrieval must be preserved
- **Alternatives Rejected**:
  - Delete these modules (Claude + Qwen plans) → rejected (violates CONTEXT.md resolved GPU policies)

### CPU Fallback for Retrieval
- **Decision**: Retain dynamic CPU/GPU selection for `/embed` and `/rerank` via `.to(device)` logic
- **Rationale**: CPU fallback required when GPU is under pressure; prevents VRAM exhaustion
- **Alternatives Rejected**:
  - Force BGE-M3 and Reranker GPU-resident → rejected (violates LLM-First policy)

## Parameter Governance Decisions

### Remove Hardcoded Runtime Parameters
- **Decision**: Remove hardcoded `temperature`, `top_p`, `repeat_penalty`, `max_tokens` from sidecar
- **Rationale**: ADR-036 Profile-Only Parameter Governance; enable dynamic tuning without rebuild
- **Implementation**:
  - Backend resolves parameters from `ai_execution_profiles` row `ocr-extract`
  - Backend sends parameters to sidecar in every request
  - Sidecar passes parameters to Ollama in every load/generate call
  - Modfile serves as last-resort fallback only
- **Alternatives Rejected**:
  - Keep hardcoded values in sidecar → rejected (violates ADR-036)
  - Create new `PromptBuilderService` → rejected (use existing Active Prompt system)

### Active Prompt Integration
- **Decision**: Backend resolves systemPrompt and DMS tags from Active Prompt in `ai_prompts`
- **Rationale**: ADR-029/037 Active Prompt System; prompt authority in database not code
- **Implementation**:
  - Backend resolves Active Prompt for `ocr_extraction` type
  - Backend extracts systemPrompt and DMS tags (`<document_number>`, `<document_date>`, `<received_date>`)
  - Backend sends systemPrompt and DMS tags to sidecar
  - Sidecar receives and injects into Ollama request in every load/generate call
- **Alternatives Rejected**:
  - Create new `PromptBuilderService` → rejected (use existing ADR-029/037 system)
  - Hardcode DMS tags in sidecar → rejected (violates ADR-036 parameter governance)

## Authentication Decisions

### Two-Phase Auth Migration
- **Decision**: Phase 1 - Remove hardcoded default key; Phase 2 - Remove X-API-Key after ADR-041
- **Rationale**: Sequenced migration; network isolation only possible after server consolidation
- **Phase 1 Implementation**:
  - Remove hardcoded default API key
  - Fail-fast if `OCR_SIDECAR_API_KEY` env missing
  - Continue validating X-API-Key on both sidecar and backend
- **Phase 2 Implementation** (after ADR-041 consolidation):
  - Remove X-API-Key validation from sidecar endpoints
  - Remove X-API-Key send-side from `OcrService`
  - Remove X-API-Key send-side from `SandboxOcrEngineService`
  - Rely on Docker-internal network isolation
- **Interim Period**: X-API-Key validation must remain active until ADR-041 cutover
- **Alternatives Considered**:
  - Remove X-API-Key immediately → rejected (cross-host topology requires defense-in-depth)
  - Keep X-API-Key permanently → rejected (adds complexity without value post-consolidation)

## Endpoint Decisions

### Remove /normalize Endpoint
- **Decision**: Remove `/normalize` endpoint from sidecar
- **Rationale**: No consumers exist (verified by grep across backend codebase); ThaiPreprocessProcessor unused
- **Verification**: Grep search found no calls to `/normalize` or `THAI_PREPROCESS_URL`
- **Impact**: None - endpoint has no consumers

### Fix Mutable Default Argument
- **Decision**: Fix mutable default argument `options_override={}` in `process_with_typhoon_ocr`
- **Rationale**: Python anti-pattern; causes unexpected behavior when defaults are mutated
- **Implementation**: Change to `options_override: dict = None` and initialize to `{}` in function body

## Dependencies

### External Dependencies
- **FastAPI 0.111.0**: Web framework (already in use)
- **httpx 0.27.0**: Async HTTP client (upgrade from sync httpx)
- **PyMuPDF 1.24.0**: PDF processing (already in use)
- **typhoon-ocr>=0.4.1**: OCR library (already in use)
- **FlagEmbedding>=1.2.0**: Embedding model (already in use)
- **pythainlp 5.0.4**: Thai NLP (already in use)

### Internal Dependencies
- **residency_policy.py**: Must retain for Adaptive OCR Residency
- **vram_monitor.py**: Must retain for VRAM monitoring
- **backend AI services**: OcrService, SandboxOcrEngineService must be updated for parameter resolution

## Testing Strategy

### Path Traversal Tests
- Test cases for various path traversal patterns (`../../etc/passwd`, symlinks, etc.)
- Expect 403 Forbidden for all malicious paths
- Use pytest for automated testing

### Residency Wiring Tests
- Unit test to verify `calculate_ocr_residency()` is called in `process_ocr`
- Verify keep_alive value is calculated dynamically, not fixed
- Test with different VRAM pressure scenarios

### Performance Tests
- Benchmark async vs sync I/O under concurrent load
- Target: 20%+ throughput improvement
- Measure response times and resource utilization

## Rollback Plan

If issues arise during deployment:
1. Revert `app.py` to previous version
2. Restore X-API-Key send-side in backend services
3. Re-pin `keep_alive` default to `0` in `process_ocr`
4. Restore hardcoded runtime params if needed for emergency fallback

## References

- ADR-040: OCR Sidecar Refactor
- ADR-036: Profile-Only Parameter Governance
- ADR-029: Dynamic Prompt Management
- ADR-037: Active Prompt System
- ADR-041: Server Consolidation (dependency for Phase 2)
- CONTEXT.md: GPU Policy (LLM-First Ownership, CPU Fallback)
