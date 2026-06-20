# Feature Specification: OCR Sidecar Refactor

**Feature Branch**: `140-ocr-sidecar-refactor`
**Created**: 2026-06-20
**Status**: Draft
**Input**: ADR-040: OCR Sidecar Refactor — Pure Compute Worker, Preserved GPU Policy, Network-Trust Boundary

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sidecar Security Hardening (Priority: P1)

System administrators need to ensure the OCR sidecar on Desk-5439 is secure from path traversal attacks and does not contain hardcoded secrets that cannot be rotated without rebuilding containers.

**Why this priority**: Security vulnerabilities (hardcoded API keys, path traversal) are critical risks that could lead to unauthorized access and data breaches.

**Independent Test**: Can be fully tested by attempting path traversal requests and verifying that hardcoded default keys are rejected when environment variables are missing, delivering immediate security validation.

**Acceptance Scenarios**:

1. **Given** the sidecar is running with a leaked API key, **When** an attacker attempts to use it, **Then** the system should allow key rotation without container rebuild
2. **Given** a malicious request with path traversal (e.g., `../../etc/passwd`), **When** the `/ocr` endpoint receives the request, **Then** the system returns 403 Forbidden
3. **Given** the sidecar starts without `OCR_SIDECAR_API_KEY` environment variable, **When** the container initializes, **Then** it fails fast with clear error message

---

### User Story 2 - GPU Resource Management (Priority: P1)

The system must prevent VRAM exhaustion on Desk-5439 (RTX 5060 Ti 16GB) by implementing adaptive OCR residency policy and CPU fallback for retrieval models, ensuring the LLM (Typhoon-2.5) has priority GPU access.

**Why this priority**: VRAM exhaustion causes complete system failure. The LLM-First GPU Ownership policy is critical for system stability.

**Independent Test**: Can be fully tested by monitoring VRAM usage during concurrent OCR and embedding operations, verifying that BGE-M3 and FlagReranker fall back to CPU when GPU is under pressure.

**Acceptance Scenarios**:

1. **Given** the GPU is under heavy load from LLM operations, **When** an OCR request comes in, **Then** the system uses `calculate_ocr_residency()` to determine appropriate `keep_alive` value
2. **Given** VRAM is nearly full, **When** embedding or reranking requests are made, **Then** BGE-M3 and FlagReranker automatically fall back to CPU
3. **Given** the sidecar loads OCR model, **When** the operation completes, **Then** the model is unloaded based on residency policy (not fixed `keep_alive=0` or `300`)

---

### User Story 3 - Parameter Governance via Active Prompt (Priority: P2)

Backend services need to control AI model parameters (temperature, top_p, repeat_penalty, max_tokens, keep_alive) from the database via `ai_execution_profiles` and `ai_prompts` tables, ensuring no hardcoded values in the sidecar.

**Why this priority**: This enables dynamic parameter tuning without container rebuilds, aligning with ADR-036 Profile-Only Parameter Governance and ADR-029/037 Active Prompt System.

**Independent Test**: Can be fully tested by modifying `ai_execution_profiles` row `ocr-extract` and verifying that the sidecar uses the new parameters on the next request.

**Acceptance Scenarios**:

1. **Given** the `ai_execution_profiles` row `ocr-extract` has `temperature=0.7`, **When** the backend sends OCR request, **Then** the sidecar passes `temperature=0.7` to Ollama
2. **Given** the Active Prompt in `ai_prompts` contains system prompt and DMS tags, **When** the backend resolves the prompt, **Then** the sidecar receives and injects these into the Ollama request
3. **Given** a parameter is missing from the job snapshot, **When** the sidecar processes the request, **Then** it uses Modfile as last-resort fallback only

---

### User Story 4 - Async I/O Performance (Priority: P2)

The sidecar must use asynchronous I/O patterns to prevent blocking the FastAPI event loop, improving throughput and reducing latency for OCR operations.

**Why this priority**: Synchronous blocking I/O reduces system throughput and can cause request timeouts under load.

**Independent Test**: Can be fully tested by running concurrent OCR requests and measuring response times, verifying that async implementation handles load without blocking.

**Acceptance Scenarios**:

1. **Given** the sidecar receives multiple concurrent OCR requests, **When** processing with `httpx.AsyncClient`, **Then** requests do not block each other
2. **Given** the sidecar starts up, **When** models are loaded, **Then** loading happens via `asyncio.to_thread` to avoid blocking startup
3. **Given** the sidecar is under load, **When** measuring request latency, **Then** async implementation shows improved throughput compared to sync version

---

### User Story 5 - Network Isolation Auth (Phase 2, Post-Consolidation) (Priority: P3)

After ADR-041 server consolidation completes (single Docker host), the system should remove X-API-Key validation and rely solely on Docker-internal network isolation for authentication.

**Why this priority**: This is a future-phase improvement that simplifies the system after infrastructure consolidation. It's lower priority as it depends on ADR-041 completion.

**Independent Test**: Can be fully tested after consolidation by removing X-API-Key headers and verifying that requests from within Docker network succeed while external requests fail.

**Acceptance Scenarios**:

1. **Given** ADR-041 consolidation is complete (single Docker host), **When** backend calls sidecar without X-API-Key, **Then** the request succeeds via Docker-internal network
2. **Given** consolidation is complete, **When** external network attempts to call sidecar, **Then** the request is blocked by network isolation
3. **Given** the interim period (before consolidation), **When** backend calls sidecar, **Then** X-API-Key validation is still active

---

### Edge Cases

- What happens when the OCR sidecar receives a request for a PDF file that does not exist within the whitelisted base path? (Tested via path traversal test T007)
- How does the system handle VRAM exhaustion when both LLM and OCR models attempt to load simultaneously?
- What happens when the `ai_execution_profiles` row `ocr-extract` is missing or has invalid parameter values?
- How does the sidecar handle Ollama service unavailability or timeout during OCR processing? (Handled by FastAPI exception handling with user-friendly error messages per ADR-007)
- What happens when the Active Prompt system is unavailable during OCR request processing?
- How does the system handle concurrent requests when GPU is under extreme pressure (e.g., 95% VRAM usage)?
- What happens when path canonicalization resolves to a symlink outside the base path? (Tested via path traversal test T007 with symlink scenarios)
- How does the system behave during the transition period between Phase 1 (X-API-Key) and Phase 2 (Network Isolation)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Sidecar MUST remove hardcoded default API key and fail-fast if `OCR_SIDECAR_API_KEY` environment variable is missing
- **FR-002**: Sidecar MUST implement path canonicalization via `os.path.abspath()` + `os.path.realpath()` on all PDF path inputs
- **FR-003**: Sidecar MUST enforce base-path whitelist check on `/ocr` endpoint, rejecting paths outside `OCR_SIDECAR_UPLOAD_BASE` with 403 Forbidden
- **FR-004**: Sidecar MUST refactor `process_ocr` to use `async def` and `httpx.AsyncClient` via lifespan context manager
- **FR-005**: Sidecar MUST replace `@app.on_event("startup")` with `@asynccontextmanager` lifespan pattern
- **FR-006**: Sidecar MUST wire `calculate_ocr_residency(active_profile)` into `process_ocr` for dynamic `keep_alive` calculation
- **FR-007**: Sidecar MUST NOT accept explicit `options_override["keep_alive"]` from backend (keep_alive must be calculated lazily per ADR-036 Gap-2)
- **FR-008**: Sidecar MUST retain `vram_monitor.py` and `residency_policy.py` modules (reject deletion)
- **FR-009**: Sidecar MUST retain dynamic CPU/GPU selection for `/embed` and `/rerank` endpoints via `.to(device)` logic
- **FR-010**: Sidecar MUST remove hardcoded runtime parameters (temperature, top_p, repeat_penalty, max_tokens) and accept from backend job snapshot
- **FR-011**: Sidecar MUST receive systemPrompt and DMS extraction tags from backend and pass to Ollama in every load/generate call
- **FR-012**: Sidecar MUST remove `/normalize` endpoint (ThaiPreprocessProcessor has no consumers)
- **FR-013**: Sidecar MUST fix mutable default argument `options_override={}` in `process_with_typhoon_ocr`
- **FR-014**: Sidecar MUST load models via `asyncio.to_thread` during lifespan to avoid blocking startup
- **FR-015**: Backend MUST resolve runtime parameters from `ai_execution_profiles` row `ocr-extract` and send to sidecar
- **FR-016**: Backend MUST resolve systemPrompt and DMS tags from Active Prompt in `ai_prompts` (ADR-029/037)
- **FR-017**: Backend MUST send resolved parameters to sidecar in every OCR request
- **FR-018**: Phase 2 (post-ADR-041): Sidecar MUST remove X-API-Key validation from all endpoints
- **FR-019**: Phase 2 (post-ADR-041): Backend MUST remove X-API-Key send-side in `OcrService`
- **FR-020**: Phase 2 (post-ADR-041): Backend MUST remove X-API-Key send-side in `SandboxOcrEngineService`

### Key Entities

- **OCR Sidecar (FastAPI Service)**: Pure compute worker on Desk-5439 that provides `/ocr`, `/embed`, `/rerank` endpoints. No business logic or parameter governance. Receives parameters from backend.
- **ai_execution_profiles**: Database table containing runtime parameter profiles for different AI operations (row `ocr-extract` for OCR parameters)
- **ai_prompts**: Database table containing prompt templates with versioning and activation status (ADR-029/037)
- **Backend OcrService**: Service that orchestrates OCR requests, resolves parameters from database, and sends to sidecar
- **Backend SandboxOcrEngineService**: Service for OCR sandbox testing, similar parameter resolution as OcrService

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Path traversal attacks return 403 Forbidden in 100% of test cases (verified by pytest suite)
- **SC-002**: VRAM exhaustion is prevented under load; system remains stable with LLM-First GPU Ownership policy (verified by VRAM monitoring during stress test)
- **SC-003**: OCR request throughput improves by at least 20% with async I/O implementation (measured by concurrent request benchmark)
- **SC-004**: Parameter changes in `ai_execution_profiles` take effect immediately without container rebuild (verified by runtime parameter update test)
- **SC-005**: System startup time does not increase despite async model loading (measured by container startup benchmark)
- **SC-006**: No hardcoded secrets remain in sidecar codebase (verified by code audit)
- **SC-007**: All sidecar endpoints respect network isolation after ADR-041 consolidation (verified by network access test)
- **SC-008**: CPU fallback for BGE-M3 and FlagReranker activates correctly when GPU is under pressure (verified by VRAM monitoring test)

## Assumptions

- ADR-041 server consolidation will complete before Phase 2 (X-API-Key removal) can be implemented
- Desk-5439 (192.168.10.100) will continue to host the OCR sidecar with RTX 5060 Ti 16GB GPU
- Ollama service on Desk-5439 will continue to provide Typhoon OCR model
- ThaiPreprocessProcessor has no active consumers (verified by grep search across backend codebase)
- `calculate_ocr_residency()` function exists in `residency_policy.py` and is not currently wired into `process_ocr`
- VLAN/firewall ACL provides interim network security before ADR-041 consolidation

## Dependencies

- ADR-041 Server Consolidation must complete before Phase 2 (X-API-Key removal)
- ADR-036 Profile-Only Parameter Governance must be implemented for parameter resolution
- ADR-029 Dynamic Prompt Management must be implemented for Active Prompt system
- ADR-037 Active Prompt System must be operational for system prompt injection
- Desk-5439 infrastructure must remain stable (GPU, network, Ollama service)

## Out of Scope

- 1-page-1-request horizontal scaling rework (separate future ADR)
- OpenTelemetry/Prometheus/Grafana observability (separate ticket)
- `/normalize` endpoint functionality (removed per D2; ThaiPreprocessProcessor has no consumers)
