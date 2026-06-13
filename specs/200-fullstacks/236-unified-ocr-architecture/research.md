// File: specs/200-fullstacks/236-unified-ocr-architecture/research.md
// Change Log:
// - 2026-06-13: Research decisions from ADR-036

# Research: Unified AI Model Architecture — Sandbox-Production Parity

## Overview

This document consolidates technical decisions from ADR-036 for the Unified AI Model Architecture feature. All decisions are already ratified in ADR-036; this document serves as a quick reference for implementation.

## Decisions

### D1: Calibration on Existing Profile/Prompt Stores

**Decision**: Reuse existing `ai_execution_profiles` as production parameter store and create new `ai_sandbox_profiles` as draft store. Do not create new parameter store in `system_settings`.

**Rationale**:
- Existing `ai_execution_profiles` already has the right structure (profile_name, temperature, top_p, etc.)
- Adding `canonical_model` column distinguishes np-dms-ai vs np-dms-ocr
- Avoids schema bloat and migration complexity
- Leverages existing Redis cache in AiPolicyService

**Alternatives Considered**:
- Create new `ai_model_parameters` table → Rejected: unnecessary duplication
- Use `system_settings` JSON → Rejected: loses type safety and queryability

---

### D2: Dual-Model Parameter Management

**Decision**: Store OCR parameters in dedicated row `ocr-extract` with `canonical_model='np-dms-ocr'`. Make `numCtx` and `maxTokens` nullable for OCR (not used).

**Rationale**:
- OCR has different parameter requirements than LLM (no context window, no max tokens)
- Single table with `canonical_model` column simplifies queries
- Nullable columns allow row-level variation without schema fragmentation

**Alternatives Considered**:
- Separate `ai_ocr_profiles` table → Rejected: adds join complexity
- JSON blob for model-specific params → Rejected: loses queryability

---

### D3: Snapshot Semantics

**Decision**: Parameters are frozen at job dispatch time (snapshot), not lazy-loaded during processing. `keep_alive` is excluded from snapshot (lazy-loaded per ADR-033).

**Rationale**:
- Ensures job consistency regardless of subsequent parameter changes
- Allows safe parameter tuning without affecting running jobs
- `keep_alive` is a resource parameter, not a model parameter (ADR-033)

**Alternatives Considered**:
- Lazy-load parameters during processing → Rejected: race condition risk
- Include `keep_alive` in snapshot → Rejected: violates ADR-033 residency logic

---

### D4: Dual-Model Snapshot for OCR+LLM Jobs

**Decision**: Support `ocrSnapshotParams` (OCR) and `snapshotParams` (LLM) in `AiJobPayload` for jobs that use both models.

**Rationale**:
- Migration jobs use both OCR and LLM
- Each model needs its own parameter set
- Separation allows independent tuning

**Alternatives Considered**:
- Single snapshot with union of params → Rejected: unclear which params apply to which model
- Job-level model selection → Rejected: adds complexity to processor logic

---

### D5: Master Data Context Parity in Sandbox

**Decision**: Require project selection in sandbox tests (no 'default' project). Use selected project/contract context for master data lookup.

**Rationale**:
- Eliminates parity gap where sandbox used 'default' while production used real project
- Ensures sandbox tests accurately reflect production behavior
- `{{master_data_context}}` in prompts will match production

**Alternatives Considered**:
- Keep 'default' project for sandbox → Rejected: inaccurate test results
- Auto-select first project → Rejected: hides context selection UI

---

### D6: System Prompt Integration

**Decision**: System prompts managed via ADR-029 (`ai_prompts` table), not duplicated in parameter store. Parameter interface links to Prompt Version UI.

**Rationale**:
- ADR-029 already has versioning, approval workflow, and audit trail
- Avoids duplication and maintenance burden
- Clear separation of concerns (prompts vs runtime parameters)

**Alternatives Considered**:
- Store system prompt in ai_execution_profiles → Rejected: duplicates ADR-029
- Inline system prompt in sandbox draft → Rejected: loses versioning

---

### D7: Model Name Alignment

**Decision**: Update model names from `typhoon2.5-np-dms`/`typhoon-np-dms-ocr` to `np-dms-ai`/`np-dms-ocr` across codebase.

**Rationale**:
- Canonical names are shorter and more semantic
- Aligns with ADR-034 decision
- Simplifies documentation and communication

**Alternatives Considered**:
- Keep typhoon names → Rejected: inconsistent with ADR-034
- Use generic names (main/ocr) → Rejected: loses semantic meaning

---

### D8: Security Guardrails

**Decision**: Apply endpoint requires Idempotency-Key validation, CASL permission (`system.manage_ai`), and parameter range validation (temperature/topP 0-1).

**Rationale**:
- Idempotency-Key prevents duplicate applies
- CASL enforces RBAC
- Range validation prevents invalid parameters
- Audit logging tracks all changes

**Alternatives Considered**:
- Skip Idempotency-Key → Rejected: risk of duplicate applies
- Use weaker permission → Rejected: security risk

---

### D9: Cache Invalidation

**Decision**: Invalidate Redis cache after applying parameters to production.

**Rationale**:
- Ensures new jobs use updated parameters
- Prevents stale cache issues
- Simple DEL operation on cache key

**Alternatives Considered**:
- Wait for cache TTL → Rejected: delayed effect
- No cache invalidation → Rejected: stale parameters

---

### D10: OCR Parameter Wiring to Sidecar

**Decision**: Add `typhoonOptions` to `OcrDetectionInput` and append temperature/topP/repeatPenalty to form data sent to sidecar.

**Rationale**:
- Sidecar already accepts overrides via form data
- Allows OCR model tuning without sidecar changes
- Maintains existing contract

**Alternatives Considered**:
- Modify sidecar API → Rejected: unnecessary infrastructure change
- Hardcode params in sidecar → Rejected: loses tunability

---

## Technology Stack

- **Backend**: NestJS 11, TypeORM, Redis, BullMQ
- **Frontend**: Next.js 16, TanStack Query, React Hook Form, Zod
- **Database**: MariaDB 11.8
- **Testing**: Jest (backend), Vitest + Playwright (frontend)

## Performance Targets

- Apply operation: <2s (including cache invalidation)
- Sandbox test cycle: <5s (test → apply → verify)
- Cache invalidation: <100ms

## Security Considerations

- CASL guard on apply endpoint
- Idempotency-Key validation (5-minute window)
- Parameter range validation (temperature/topP 0-1)
- Audit logging for all apply operations
- No direct DB/storage access from AI (ADR-023/023A)

## Dependencies

- ADR-029: Dynamic Prompt Management (system prompt integration)
- ADR-033: Adaptive OCR Residency (keep_alive lazy-loading)
- ADR-034: AI Model Change (canonical model names)
- Existing AiPolicyService with Redis cache
- Existing ai_audit_logs table
