# Research: Typhoon OCR Integration

**Feature**: 232-typhoon-ocr-integration
**Date**: 2026-05-30
**Phase**: Phase 0 - Outline & Research

## Research Findings

### Typhoon OCR Ollama Integration

**Decision**: Use Ollama HTTP API for Typhoon OCR integration via Admin Desktop (Desk-5439)

**Rationale**:
- Typhoon OCR models are available in Ollama registry (scb10x/typhoon-ocr-3b, scb10x/typhoon-ocr-7b)
- Ollama provides consistent HTTP API for model inference
- Aligns with ADR-023/023A on-premises AI requirement
- Existing Ollama infrastructure on Admin Desktop can be reused

**Alternatives Considered**:
- OpenTyphoon Cloud API: Rejected due to ADR-023 on-premises requirement
- Direct model loading in Python: Rejected due to complexity and lack of integration with existing AI infrastructure

**Implementation Details**:
- Model: scb10x/typhoon-ocr-3b (~3-4GB VRAM)
- API endpoint: `POST /api/generate` with model parameter
- Input: Image data (base64 or file upload)
- Output: Extracted text with confidence scores
- Fallback: Tesseract OCR when Ollama unavailable

### Typhoon LLM Model Integration

**Decision**: Add typhoon2.1-gemma3-4b to AI Model Management as alternative to gemma4

**Rationale**:
- Typhoon models are optimized for Thai language
- Q3_K_M quantization reduces VRAM requirements (~8-10GB vs 16GB+)
- Provides model selection flexibility for administrators
- Compatible with existing Ollama infrastructure

**Alternatives Considered**:
- Full precision typhoon2.1-gemma3-12b: Rejected due to VRAM constraints
- Other Typhoon variants: Rejected due to limited availability in Ollama

**Implementation Details**:
- Model: typhoon2.1-gemma3-4b (~4-5GB VRAM)
- Integration via existing AI service with BullMQ queues
- Requires system.manage_all permission for model selection
- VRAM monitoring to prevent concurrent model loading

### Redis Caching for OCR Results

**Decision**: Use Redis with 24-hour TTL for OCR result caching

**Rationale**:
- Avoid reprocessing same document within short timeframe
- Redis already in use for other caching needs
- 24-hour TTL balances performance with storage efficiency
- Aligns with ADR-023A RAG embedding gap coverage pattern

**Alternatives Considered**:
- Permanent database storage: Rejected due to storage growth concerns
- No caching: Rejected due to performance impact
- Longer TTL (e.g., 7 days): Rejected due to storage efficiency

**Implementation Details**:
- Cache key: `ocr:cache:{documentPublicId}:{engine}:{hash}`
- TTL: 86400 seconds (24 hours)
- Cache invalidation: Manual or on document update
- Fallback to Tesseract bypasses cache

### VRAM Monitoring

**Decision**: Implement VRAM monitoring via Ollama API and Redis state tracking

**Rationale**:
- Prevent VRAM exhaustion when loading multiple models
- Sequential processing constraint (1 concurrent request)
- 90% VRAM usage limit per success criteria
- Ollama provides model status API

**Alternatives Considered**:
- GPU monitoring tools (nvidia-smi): Rejected due to complexity and OS dependency
- No monitoring: Rejected due to risk of VRAM exhaustion

**Implementation Details**:
- Monitor via Ollama `/api/tags` endpoint for loaded models
- Track VRAM usage in Redis: `ai:vram:usage`
- Block model loading if usage > 90%
- Sequential processing enforced via BullMQ queue

### ADR Updates

**Decision**: Create ADR-032 for Typhoon OCR integration and update ADR-023/023A

**Rationale**:
- Document Typhoon models as supported on-premises AI options
- Resolve conflicts between existing ADRs and new integration
- Provide clear guidance for future development
- Maintain ADR consistency per FR-009

**Alternatives Considered**:
- Only update existing ADRs: Rejected due to scope and clarity benefits of dedicated ADR
- No ADR updates: Rejected due to documentation requirements

**Implementation Details**:
- ADR-032: Typhoon OCR integration architecture
- ADR-023: Add Typhoon models to supported AI options
- ADR-023A: Add Typhoon models as alternatives to gemma4/nomic-embed-text
- Review for conflicts with existing ADRs

## Unknowns Resolved

No NEEDS CLARIFICATION markers remained in Technical Context. All technical decisions documented above.

## Dependencies Verified

- ✅ Ollama service operational on Admin Desktop (per ADR-023/023A)
- ✅ Typhoon OCR-3B available in Ollama registry
- ✅ Typhoon2.1-gemma3-4b available in Ollama registry
- ✅ Redis infrastructure available for caching
- ✅ BullMQ infrastructure available for job queues
- ✅ CASL infrastructure available for permission checks

## Next Steps

Proceed to Phase 1: Design & Contracts
- Generate data-model.md
- Generate API contracts in contracts/
- Generate quickstart.md
- Update agent context
