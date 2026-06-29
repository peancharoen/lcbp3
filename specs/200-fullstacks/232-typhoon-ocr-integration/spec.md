// File: specs/200-fullstacks/232-typhoon-ocr-integration/spec.md
// Change Log:
// - 2026-05-30: Initial specification for Typhoon OCR integration
// - 2026-05-30: Updated VRAM strategy (keep_alive=0), System Prompt (Option 2), and hyperparameters.

# Feature Specification: Typhoon OCR Integration

**Feature Branch**: `232-typhoon-ocr-integration`
**Created**: 2026-05-30
**Status**: Draft
**Category**: 200-fullstacks
**Input**: User description: "refactor ส่วนที่เกี่ยวข้อง, เพิ่ม typhoon2.1-gemma3-12b Q3_K_M ใน option AI Model Management, เพิ่ม typhoon-ocr-7b ~5-6GB VRAM (ollama) เป็น option ใน OCR Sandbox Runner, ให้ปรับปรุง ADR ที่ขัดแย้งด้วย"

## Clarifications

### Session 2026-05-30

- Q: What permission level should be required for users to select Typhoon OCR in OCR Sandbox Runner? → A: Only system administrators (system.manage_all)
- Q: What is the maximum acceptable processing time for Typhoon OCR to extract text from a single document page? → A: Under 60 seconds per page
- Q: What permission level should be required for AI administrators to add typhoon2.1-gemma3-4b to AI Model Management? → A: Only system administrators (system.manage_all)
- Q: What is the maximum number of concurrent Typhoon OCR requests the system should support? → A: 1 concurrent request (sequential processing only)
- Q: Should Typhoon OCR results be cached or stored for future reference? → A: Cache results temporarily (24 hours) in Redis but not persist permanently
- Q: What are the Typhoon OCR model hyperparameters? → A: temperature = 0.0, top_p = 0.9, repeat_penalty = 1.0, and keep_alive = 0 to unload VRAM immediately.
- Q: What is the System Prompt for Typhoon OCR? → A: `"สกัดข้อความภาษาไทยและอังกฤษทั้งหมดจากภาพนี้อย่างถูกต้อง รักษาโครงสร้างบรรทัดและการเว้นวรรคให้ใกล้เคียงต้นฉบับมากที่สุด ห้ามเพิ่มคำอธิบายใดๆ"`

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Typhoon OCR Option in OCR Sandbox (Priority: P1)

As a document processor, I want to use Typhoon OCR as an alternative to Tesseract for better Thai text extraction accuracy, so that I can achieve higher OCR accuracy (95%+) for Thai documents.

**Why this priority**: This is the primary user-facing value - improved OCR accuracy directly impacts document processing quality and reduces manual correction effort.

**Independent Test**: Can be fully tested by selecting Typhoon OCR in OCR Sandbox Runner and processing a Thai document, delivering improved text extraction accuracy compared to Tesseract.

**Acceptance Scenarios**:

1. **Given** a user has access to OCR Sandbox Runner, **When** they select "Typhoon OCR-3B" as the OCR engine option, **Then** the system should process the document using Typhoon OCR via Ollama and return extracted text.
2. **Given** a document is processed with Typhoon OCR, **When** the OCR completes, **Then** the extracted text should have accuracy comparable to or better than Tesseract (target: 95%+ for Thai text).
3. **Given** Typhoon OCR is selected, **When** the Ollama service is unavailable, **Then** the system should fall back to Tesseract OCR and display a warning message.

---

### User Story 2 - Typhoon LLM in AI Model Management (Priority: P2)

As an AI administrator, I want to add typhoon2.1-gemma3-4b as an option in AI Model Management, so that I can use this model for AI-powered document analysis tasks.

**Why this priority**: This enables model selection flexibility and allows administrators to choose between different LLM models based on performance and resource requirements.

**Independent Test**: Can be fully tested by adding typhoon2.1-gemma3-4b to the AI Model Management configuration and selecting it for a document analysis task.

**Acceptance Scenarios**:

1. **Given** an AI administrator has system.manage_all permission, **When** they add typhoon2.1-gemma3-4b to the AI model options, **Then** the model should be available for selection in AI-powered features.
2. **Given** typhoon2.1-gemma3-4b is selected, **When** a document analysis task is initiated, **Then** the system should use this model via Ollama for inference.
3. **Given** the GPU has limited VRAM, **When** typhoon2.1-gemma3-4b is loaded, **Then** the system should monitor VRAM usage and prevent concurrent model loading if VRAM would be exceeded.

---

### User Story 3 - ADR Conflict Resolution (Priority: P3)

As a system architect, I want to update ADR-023 and ADR-023A to include Typhoon OCR and Typhoon LLM models, so that the architecture documentation reflects the current AI infrastructure capabilities.

**Why this priority**: This ensures architectural decisions remain accurate and provide clear guidance for future development and compliance checks.

**Independent Test**: Can be fully tested by reviewing the updated ADRs and verifying they correctly document Typhoon model integration without conflicts.

**Acceptance Scenarios**:

1. **Given** ADR-023 and ADR-023A exist, **When** they are updated to include Typhoon models, **Then** the ADRs should clearly specify Typhoon OCR and Typhoon LLM as supported on-premises AI options.
2. **Given** ADR-023A is updated, **When** it describes the 2-model stack, **Then** it should include Typhoon models as alternatives to gemma4 and nomic-embed-text where applicable.
3. **Given** ADR conflicts are identified, **When** they are resolved, **Then** all ADRs should be consistent with each other and with the actual implementation.

---

### Edge Cases

- What happens when Ollama service is down or unresponsive?
- How does system handle VRAM exhaustion when multiple AI models are loaded? (Solved by sequential loading and Ollama `keep_alive = 0` configuration).
- What happens when Typhoon OCR model fails to load or crashes during processing?
- How does system handle concurrent OCR requests when Typhoon OCR is selected?
- What happens when user selects Typhoon OCR but the model is not installed in Ollama?
- How does system handle fallback to Tesseract when Typhoon OCR fails?
- What happens when GPU VRAM is insufficient for Typhoon OCR-3B (3-4GB)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide Typhoon OCR-3B as an option in OCR Sandbox Runner alongside Tesseract OCR.
- **FR-002**: System MUST allow users with system.manage_all permission to select between Tesseract OCR and Typhoon OCR for document text extraction.
- **FR-003**: System MUST integrate Typhoon OCR via Ollama service on Admin Desktop (on-premises only, per ADR-023/023A) with CASL Guard for all AI-related endpoints per ADR-016.
- **FR-004**: System MUST fall back to Tesseract OCR when Typhoon OCR is unavailable or fails, with appropriate user notification.
- **FR-005**: System MUST allow users with system.manage_all permission to add typhoon2.1-gemma3-4b as an option in AI Model Management configuration with CASL Guard per ADR-016.
- **FR-006**: System MUST allow AI administrators with system.manage_all permission to select typhoon2.1-gemma3-4b for AI-powered document analysis tasks with CASL Guard per ADR-016.
- **FR-007**: System MUST monitor GPU VRAM usage and prevent concurrent model loading if VRAM would be exceeded.
- **FR-011**: System MUST process Typhoon OCR requests sequentially (1 concurrent request) to manage VRAM and model loading constraints.
- **FR-012**: System MUST cache Typhoon OCR results temporarily (24 hours in Redis: `ocr:cache:{documentPublicId}:{engine}:{hash}`) to avoid reprocessing the same document. Cache invalidation occurs automatically on document update or manually via admin API.
- **FR-008**: System MUST update ADR-023 and ADR-023A to document Typhoon OCR and Typhoon LLM as supported on-premises AI options.
- **FR-009**: System MUST ensure ADR consistency - no conflicts between ADR-023, ADR-023A, and ADR-032 regarding Typhoon model integration.
- **FR-010**: System MUST log all Typhoon OCR and Typhoon LLM interactions in ai_audit_logs per ADR-023/023A requirements.

### Key Entities

- **OCR Engine Configuration**: Represents the available OCR engines (Tesseract, Typhoon OCR) with their parameters and resource requirements.
- **AI Model Configuration**: Represents the available AI models (gemma4, typhoon2.1-gemma3-4b, nomic-embed-text) with their VRAM requirements and use cases.
- **VRAM Monitor**: Tracks GPU VRAM usage across all loaded AI models to prevent resource exhaustion.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Typhoon OCR achieves 95%+ accuracy for Thai text extraction compared to Tesseract's 90% baseline (measured at character-level accuracy).
- **SC-002**: Typhoon OCR processes a single document page within 60 seconds (per-page timing).
- **SC-003**: System successfully falls back to Tesseract OCR within 5 seconds when Typhoon OCR is unavailable.
- **SC-004**: GPU VRAM usage never exceeds 90% of available VRAM when multiple AI models are loaded.
- **SC-005**: AI administrators can successfully add and select typhoon2.1-gemma3-4b in AI Model Management within 2 minutes.
- **SC-006**: ADR-023 and ADR-023A are updated and reviewed with no conflicts identified within 1 business day.
- **SC-007**: All Typhoon OCR and Typhoon LLM interactions are logged in ai_audit_logs with 100% coverage.

## Assumptions

- Admin Desktop (Desk-5439) has sufficient GPU VRAM (8GB+) to support Typhoon OCR-3B (~3-4GB) and other AI models sequentially.
- Ollama service is already installed and running on Admin Desktop per ADR-023/023A.
- Typhoon OCR-3B and typhoon2.1-gemma3-4b models are available in Ollama registry and can be pulled.
- Current Tesseract OCR implementation (90% accuracy) is acceptable as a fallback option.
- OCR Sandbox Runner and AI Model Management components exist and can be refactored to support additional options.
- OCR sidecar uses Python 3.11 for Typhoon OCR integration.

## Dependencies

- ADR-023/023A must be updated to include Typhoon models before implementation begins.
- Ollama service on Admin Desktop must be operational and accessible.
- Typhoon OCR-3B and typhoon2.1-gemma3-4b models must be available in Ollama.
- Existing OCR Sandbox Runner component must be refactored to support multiple OCR engines.
- Existing AI Model Management component must be refactored to support additional LLM models.
- VRAM monitoring capability must be implemented or enhanced.
