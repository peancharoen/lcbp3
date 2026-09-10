// File: specs/200-fullstacks/254-rag-attachment-chunks/research.md
// Change Log:
// - 2026-09-09: Resolve RAG Attachment Chunk architecture decisions

# Research: RAG Attachment Chunks

## Decision 1: Attachment-scoped physical naming

**Decision**: Replace the unused/empty `document_chunks` physical table with `rag_attachment_chunks`.

**Rationale**:
- The inspected database has zero rows in `document_chunks`.
- The actual source is an Attachment, not a generic document-numbering record.
- The name separates RAG storage from `document_number_*` tables.

**Alternatives considered**:
- Keep `document_chunks`: rejected because it is ambiguous and conflicts with the resolved domain language.
- Use `ai_document_chunks`: rejected because the source relationship remains unclear and the project uses RAG as the specific domain term.

## Decision 2: Generation aggregate

**Decision**: Add `rag_attachment_generations` as the lifecycle authority and keep `rag_attachment_pages` and `rag_attachment_chunks` as child data.

**Rationale**:
- A generation groups checksum, model snapshot, status, and swap operations.
- It avoids updating lifecycle fields across every chunk row.
- It supports build-then-swap and retry with a new UUID.

**Alternatives considered**:
- Store generation fields in every chunk: rejected because it creates repeated lifecycle updates.
- Store only the active generation on `attachments`: rejected because it loses failed-generation diagnostics and swap history.

## Decision 3: Generation lifecycle and concurrency

**Decision**: `BUILDING → ACTIVE → RETIRED`; `BUILDING → FAILED`, with exactly one ACTIVE generation per Attachment.

**Rationale**:
- Build-then-swap avoids a search gap during re-embedding.
- Redlock plus database transaction protects against concurrent workers.
- FAILED generations provide recoverable diagnostics; retry creates a new generation UUID.

**Alternatives considered**:
- Delete old data before building: rejected because it creates a searchable-data gap.
- Reuse FAILED generation: rejected because it weakens audit and reproducibility.

## Decision 4: Tenant and cross-Project boundary

**Decision**: Correspondence/Revision and Attachment have one owning Project. Distribution to another Project grants view/download access only; it does not grant RAG retrieval.

**Rationale**:
- Current schema has one `correspondences.project_id`.
- ADR-023A requires Qdrant filtering by one owning `project_public_id`.
- Avoids Qdrant projection duplication and cross-Project leakage.

**Alternatives considered**:
- Multi-owner Correspondence: rejected because it conflicts with the current schema and ownership model.
- Cross-Project RAG projections: rejected because receiving Projects are not allowed RAG retrieval.

## Decision 5: Embedding model

**Decision**: Snapshot BGE-M3 dense+sparse model/schema per generation.

**Rationale**:
- BGE-M3 is the current model stack in ADR-034/035/043.
- The old `nomic-embed-text` schema default is stale.
- Snapshotting makes re-embedding and operational diagnosis reproducible.

## Decision 6: Text segments and citations

**Decision**: Use generic `TextSegment` units: `PAGE`, `SECTION`, `SHEET`, `WHOLE_DOCUMENT`. Persist canonical normalized segment text in `rag_attachment_pages`; copy retrieval spans into chunks.

**Rationale**:
- Not every file type has pages.
- Normalized offsets remain stable for citation and re-chunking.
- ZIP inner files need a source locator.

**Alternatives considered**:
- Force every file into page numbers: rejected because it fabricates source locations.
- Use page markers in text: rejected because markers pollute embeddings and make offsets fragile.

## Decision 7: Classification authority

**Decision**: Effective classification is Attachment-level, initialized from Document Security Policy. Lowering it requires Security/System Admin permission `document.classification_override`, reason, and audit.

**Rationale**:
- All supported document types can have Attachments.
- Attachment-level effective classification avoids gaps for Drawings and Circulation.
- Lowering security classification is a protected boundary.

## Decision 8: Metadata-only updates

**Decision**: Update MariaDB snapshots and Qdrant payload asynchronously without re-OCR/re-embedding when content/checksum is unchanged.

**Rationale**:
- Metadata changes do not change semantic content.
- BullMQ retry preserves request responsiveness and eventual consistency.

## Decision 9: Retrieval guard and fallback

**Decision**: Qdrant is the first retrieval gate; MariaDB ACTIVE-generation validation is the final gate. Stale results are skipped. If no valid chunk remains, use keyword/full-text fallback.

**Rationale**:
- Qdrant cleanup is asynchronous.
- MariaDB is the source of truth for generation state.
- Fallback avoids failing otherwise useful queries during vector cleanup windows.

## Decision 10: ZIP handling

**Decision**: Securely extract supported inner files in temporary storage and index each inner file independently with `sourceLocator`.

**Rationale**:
- Citation must identify the actual inner file.
- Zip Slip, encrypted archives, malware, and decompression bombs must be blocked.

## Decision 11: Schema migration strategy

**Decision**: Use ADR-044 SQL delta only; do not use a TypeORM migration. The existing empty `document_chunks` table may be renamed or replaced only through an explicitly reviewed SQL delta.

**Rationale**:
- Schema strategy is SQL/delta based.
- No production data currently exists in `document_chunks`, but DDL execution still requires explicit operational authorization.
