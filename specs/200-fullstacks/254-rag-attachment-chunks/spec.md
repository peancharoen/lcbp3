// File: specs/200-fullstacks/254-rag-attachment-chunks/spec.md
// Change Log:
// - 2026-09-09: Initial specification for RAG Attachment Chunks and generation lifecycle

# Feature Specification: RAG Attachment Chunks

**Feature Branch**: `254-rag-attachment-chunks`
**Created**: 2026-09-09
**Status**: Draft
**Category**: 200-fullstacks
**Input**: User direction: replace the ambiguous `document_chunks` concept with attachment-scoped RAG chunks and define their lifecycle, security scope, citations, and recovery behavior.

## Clarifications

### Session 2026-09-09

- Q: Should the physical table be renamed from `document_chunks`? → A: Yes, use `rag_attachment_chunks`; the inspected database currently has zero rows in `document_chunks`.
- Q: What owns an Attachment across Projects? → A: One owning Correspondence/Revision and one owning Project; cross-Project delivery is Distribution/access scope, not multi-owner document ownership.
- Q: Can receiving Projects use distributed content through RAG? → A: No; receiving Projects may view/download according to Distribution rules but RAG retrieval is limited to the owning Project.
- Q: How should content replacement work? → A: One chunk set per Attachment checksum with generation-based build-then-swap; retries create a new generation UUID.
- Q: What is the generation lifecycle? → A: `BUILDING → ACTIVE → RETIRED` or `BUILDING → FAILED`, with exactly one ACTIVE generation per Attachment.
- Q: Which model is authoritative for embeddings? → A: BGE-M3 dense+sparse, snapshotted at generation level.
- Q: How should source locations be represented? → A: Generic `TextSegment` units (`PAGE`, `SECTION`, `SHEET`, `WHOLE_DOCUMENT`) with normalized-text offsets; page numbers are not fabricated for non-page sources.
- Q: How should ZIP Attachments be ingested? → A: Securely extract supported inner files in a temporary sandbox and include an inner-file `sourceLocator` in citations.
- Q: Where does effective classification come from? → A: Document Security Policy, materialized at Attachment level; lowering classification requires Security/System Admin permission `document.classification_override`, reason, and audit.
- Q: What should happen when a Qdrant result is stale? → A: Verify ACTIVE generation in MariaDB, skip stale results, and fall back to keyword/full-text when no valid chunk remains.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Build searchable chunks from a committed Attachment (Priority: P1)

After an Attachment is committed and its SHA-256 checksum is available, the system prepares normalized text segments, creates searchable chunks, and makes them available to RAG only after the generation is complete and active.

**Why this priority**: RAG cannot provide reliable answers without a deterministic, attachment-scoped source of truth.

**Independent Test**: Commit a supported Attachment with known text and checksum, run ingestion, and verify that the resulting active generation contains ordered chunks whose citation ranges map back to the normalized source text.

**Acceptance Scenarios**:

1. **Given** a committed Attachment with a valid checksum and supported text segments, **When** ingestion completes successfully, **Then** exactly one generation becomes ACTIVE and its chunks are available for RAG retrieval.
2. **Given** an Attachment without a checksum, **When** ingestion is requested, **Then** ingestion is deferred or rejected with a recoverable validation state and no ACTIVE generation is created.
3. **Given** an Attachment whose content checksum changes, **When** re-ingestion is requested, **Then** a new generation is built without exposing the old generation to new RAG queries.
4. **Given** a checksum mismatch between the stored Attachment checksum and the worker verification, **When** ingestion runs, **Then** the generation becomes FAILED, no chunks become ACTIVE, and the failure includes a technical reason and recovery guidance.

---

### User Story 2 - Retrieve secure, citable RAG context (Priority: P1)

A user asks a RAG question within the owning Project. The system retrieves only content belonging to that owning Project, verifies that each result belongs to an ACTIVE generation, and returns citations that identify the source Attachment and text segment.

**Why this priority**: Tenant isolation and trustworthy citations are mandatory for document intelligence and compliance.

**Independent Test**: Create active chunks in two owning Projects, query each Project, retire one generation, and verify that results never cross Project boundaries or include retired content.

**Acceptance Scenarios**:

1. **Given** a query from an authorized user in an owning Project, **When** matching vectors are retrieved, **Then** every accepted result has the owning Project scope and an ACTIVE generation.
2. **Given** a vector result whose generation is RETIRED, FAILED, or missing from MariaDB, **When** the result is validated, **Then** it is excluded before context is sent to the model.
3. **Given** no valid active chunks remain after validation, **When** the query completes, **Then** the system uses the approved keyword/full-text fallback and records the fallback reason.
4. **Given** a Correspondence distributed to another Project, **When** a receiving-Project user searches RAG, **Then** the distributed content is not included in RAG results; Distribution may still allow viewing or downloading according to its own access rules.
5. **Given** a valid result, **When** it is returned to the user, **Then** the citation includes Attachment identity, owner type and identity, source locator, segment information, normalized-text offsets, snippet, score, and chunk public ID, but not the internal generation UUID.

---

### User Story 3 - Maintain generation integrity during replacement and cleanup (Priority: P1)

The system replaces old RAG content safely when an Attachment changes, without leaving two active generations or creating a period where a successful replacement has no searchable content.

**Why this priority**: Re-embedding is asynchronous and failure-prone; generation integrity prevents stale answers, lost searchability, and duplicate vectors.

**Independent Test**: Start a replacement for an active Attachment while issuing concurrent ingestion requests, then verify that Redlock and database transaction controls leave exactly one ACTIVE generation and that old vectors are cleaned asynchronously.

**Acceptance Scenarios**:

1. **Given** one ACTIVE generation, **When** a new generation is built, **Then** the new chunks and vectors are prepared before the old generation is marked RETIRED.
2. **Given** concurrent ingestion requests for the same Attachment, **When** both attempt a swap, **Then** only one wins the generation transition and exactly one generation remains ACTIVE.
3. **Given** a RETIRED generation, **When** Qdrant cleanup succeeds, **Then** its MariaDB pages, chunks, and generation metadata are removed according to retention rules.
4. **Given** Qdrant cleanup fails, **When** cleanup is retried, **Then** the RETIRED generation remains recoverable and no new RAG query can use it.
5. **Given** a FAILED generation, **When** a retry is requested, **Then** the system creates a new generation UUID and preserves the previous failure metadata for the retention period.

---

### User Story 4 - Ingest page-aware and archive-based Attachments (Priority: P2)

The system preserves source locations for page-based files and securely handles archive Attachments so users can understand where a retrieved passage came from.

**Why this priority**: Construction documents may be PDF, Drawing, Office files, or ZIP archives, and citations must identify the real source unit.

**Independent Test**: Ingest a multi-page PDF and a ZIP containing supported files, then verify segment labels, source locators, chunk offsets, and security rejection of unsafe archive entries.

**Acceptance Scenarios**:

1. **Given** page-aware source text, **When** it is normalized, **Then** page/segment records preserve `PAGE`, `SECTION`, `SHEET`, or `WHOLE_DOCUMENT` semantics without inserting artificial markers into embedding content.
2. **Given** a ZIP Attachment, **When** it is ingested, **Then** supported inner files are extracted in a temporary sandbox and cited with an inner-file source locator.
3. **Given** an encrypted ZIP, path traversal entry, excessive nesting, excessive extracted size, or malware, **When** extraction is attempted, **Then** ingestion fails safely and no extracted content becomes searchable.
4. **Given** a non-page source such as a Drawing or Office document, **When** it is ingested, **Then** the citation uses its actual segment type rather than inventing a page number.

---

### User Story 5 - Apply document security classification to RAG content (Priority: P1)

Security classification is inherited from the Document Security Policy and snapshotted into the generation. Lowering a classification requires a dedicated Security/System Admin permission and full auditability.

**Why this priority**: Classification is a security boundary; RAG must not weaken document access controls.

**Independent Test**: Ingest content under each classification, attempt unauthorized downgrade and retrieval, then perform an authorized downgrade and verify audit, metadata synchronization, and retrieval behavior.

**Acceptance Scenarios**:

1. **Given** an Attachment with an effective classification, **When** a generation is created, **Then** the generation snapshot matches the effective policy.
2. **Given** a user without `document.classification_override`, **When** they attempt to lower classification, **Then** the action is rejected with a user-friendly permission error.
3. **Given** a Security/System Admin with the permission, **When** they lower classification with a reason, **Then** before/after values, reason, actor, and timestamp are audited.
4. **Given** classification metadata changes without content changes, **When** synchronization runs, **Then** MariaDB and Qdrant metadata are updated asynchronously without OCR or re-embedding.

## Edge Cases

- Attachment has no checksum or checksum verification fails.
- Attachment is temporary, expired, deleted, or not linked to an owning document.
- Attachment is linked to multiple Revisions within its owning Project.
- Two ingestion jobs race for the same Attachment.
- Qdrant upsert succeeds but MariaDB activation fails, or vice versa.
- Qdrant cleanup fails after a generation becomes RETIRED.
- A vector exists without a matching active MariaDB chunk.
- A MariaDB chunk exists without a Qdrant point.
- A ZIP contains path traversal, symlinks, encrypted entries, unsupported files, malware, or decompression bombs.
- Normalization changes text length and must preserve normalized offsets.
- A document has no page concept.
- A receiving Project has Distribution access but must not retrieve the content through RAG.
- Classification is downgraded by an authorized Security/System Admin.
- A user requests a citation after the source generation has been retired.

## Requirements _(mandatory)_

### Functional Requirements

#### Attachment and Generation

- **FR-001**: System MUST use `rag_attachment_generations` as the lifecycle authority for Attachment RAG ingestion.
- **FR-002**: System MUST require a verified SHA-256 checksum before creating an ACTIVE generation.
- **FR-003**: System MUST store both the Attachment checksum snapshot and the worker-verified content checksum for each generation.
- **FR-004**: System MUST mark checksum-mismatch generations as FAILED and MUST NOT activate them.
- **FR-005**: System MUST use UUIDv7 `generation_uuid` and UUIDv7 `chunk_public_id` identifiers.
- **FR-006**: System MUST allow exactly one ACTIVE generation per Attachment.
- **FR-007**: System MUST use BUILDING → ACTIVE → RETIRED or BUILDING → FAILED lifecycle transitions.
- **FR-008**: System MUST create a new generation UUID for every retry of a FAILED generation.
- **FR-009**: System MUST build and index a replacement generation before retiring the current ACTIVE generation.
- **FR-010**: System MUST use distributed locking and a database transaction to serialize generation swaps.

#### Pages and Chunks

- **FR-011**: System MUST store normalized source segments in `rag_attachment_pages` linked to `generation_uuid`.
- **FR-012**: System MUST support segment types `PAGE`, `SECTION`, `SHEET`, and `WHOLE_DOCUMENT`.
- **FR-013**: System MUST store RAG chunks in `rag_attachment_chunks` linked to `attachment_uuid` and `generation_uuid`.
- **FR-014**: System MUST use `chunk_index` to preserve chunk ordering within a generation.
- **FR-015**: System MUST store normalized `content`, page/segment identity, `start_offset`, and `end_offset` for every chunk.
- **FR-016**: System MUST use the owning Project's `project_public_id` as the mandatory RAG tenant scope.
- **FR-017**: System MUST snapshot `doc_type`, `doc_number`, `revision`, and effective classification into the generation/chunk metadata required for retrieval and citation.
- **FR-018**: System MUST update metadata snapshots and Qdrant payload asynchronously without re-embedding when content/checksum is unchanged.
- **FR-019**: System MUST preserve the Attachment's physical identifier as `attachment_uuid` in SQL and map it to `attachmentPublicId` in application code.
- **FR-020**: System MUST enforce a foreign key from `attachment_uuid` to `attachments.uuid` with cascade behavior for relational cleanup.

#### Embedding and Vector Store

- **FR-021**: System MUST snapshot BGE-M3 model identity and dense/sparse embedding schema per generation.
- **FR-022**: System MUST create one Qdrant vector point per `chunk_public_id` for the ACTIVE generation.
- **FR-023**: Qdrant payload MUST include `chunk_public_id`, `generation_uuid`, `attachment_public_id`, `owner_type`, `owner_public_id`, `project_public_id`, metadata snapshot, and source citation fields.
- **FR-024**: Qdrant payload MUST use domain owner types: `CORRESPONDENCE`, `RFA`, `TRANSMITTAL`, `CIRCULATION`, `CONTRACT_DRAWING`, `SHOP_DRAWING`, and `AS_BUILT_DRAWING`.
- **FR-025**: Qdrant payload MUST NOT use generic `document_public_id` or MariaDB source table names as the primary owner contract.
- **FR-026**: All Qdrant searches MUST filter by the owning `project_public_id`.
- **FR-027**: Receiving Projects MUST NOT retrieve distributed content through RAG.
- **FR-028**: System MUST delete RETIRED Qdrant points asynchronously and retain RETIRED MariaDB data until vector cleanup succeeds.
- **FR-029**: System MUST retain FAILED generation error metadata for 30 days and then clean it up through a scheduled process.

#### Retrieval and Citation

- **FR-030**: System MUST verify every Qdrant result against an ACTIVE MariaDB generation before sending it to the LLM.
- **FR-031**: System MUST skip missing, RETIRED, or FAILED chunk results.
- **FR-032**: System MUST fall back to approved keyword/full-text retrieval when no valid ACTIVE chunk remains.
- **FR-033**: System MUST return user-safe citations containing Attachment identity, owner identity, source locator, segment information, normalized offsets, snippet, score, and `chunkPublicId`.
- **FR-034**: System MUST NOT expose `generation_uuid` to frontend/API consumers.

#### Text Segments and ZIP

- **FR-035**: OCR/text extraction MUST return generic `TextSegment` units with a segment type, optional number/label, and normalized text.
- **FR-036**: System MUST use `attachments.ocr_text` as the persisted OCR input where available and MUST preserve page/segment boundaries for RAG preparation.
- **FR-037**: ZIP ingestion MUST extract supported inner files in a temporary sandbox.
- **FR-038**: ZIP ingestion MUST reject traversal entries, encrypted archives, malware, excessive nesting, excessive file count, and excessive expanded size.
- **FR-039**: ZIP citations MUST include an inner-file `sourceLocator`.

#### Security Classification

- **FR-040**: Attachment classification MUST derive from Document Security Policy rather than arbitrary chunk input.
- **FR-041**: Correspondence/Document policy MUST provide the default classification, while Attachment stores the effective classification used by RAG.
- **FR-042**: Lowering classification MUST require `document.classification_override` and Security/System Admin authority.
- **FR-043**: Classification changes MUST record actor, reason, before, after, and timestamp in the audit trail.
- **FR-044**: Classification changes MUST update MariaDB and Qdrant metadata asynchronously with retry and MUST NOT trigger re-embedding when content is unchanged.

### Key Entities

- **RAG Attachment Generation**: A checksum-bound ingestion attempt for one Attachment with BUILDING, ACTIVE, RETIRED, or FAILED lifecycle.
- **RAG Attachment Page**: Normalized source segment belonging to one generation and used as the canonical citation/rechunk source.
- **RAG Attachment Chunk**: An ordered normalized text span belonging to one generation and one Attachment.
- **Text Segment**: A PAGE, SECTION, SHEET, or WHOLE_DOCUMENT source unit with normalized text and locator metadata.
- **Vector Point**: A Qdrant point linked to one chunk public ID and scoped to the owning Project.
- **RAG Citation**: User-safe source metadata that points to an Attachment, owner document, source segment, and normalized text range.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of newly indexed chunks belong to exactly one Attachment and one generation.
- **SC-002**: 100% of ACTIVE generations have a verified checksum and exactly one owning Project scope.
- **SC-003**: 0 RAG responses include chunks whose generation is RETIRED, FAILED, missing, or outside the owning Project scope.
- **SC-004**: At least 99% of successful indexed chunks return a citation with Attachment identity and source segment information.
- **SC-005**: Concurrent ingestion of the same Attachment results in exactly one ACTIVE generation in all tested race scenarios.
- **SC-006**: Metadata-only updates reach MariaDB and Qdrant without re-running OCR or embedding in 100% of tested cases.
- **SC-007**: Failed Qdrant cleanup is retried automatically, and no RETIRED generation is deleted from MariaDB before cleanup success.
- **SC-008**: ZIP security tests reject all traversal, encrypted, malware, and decompression-limit fixtures.
- **SC-009**: Receiving-Project RAG queries return zero chunks from distributed-only content.
- **SC-010**: Authorized classification overrides produce complete before/after audit records in 100% of tested cases.
