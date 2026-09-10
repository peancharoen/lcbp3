// File: specs/200-fullstacks/254-rag-attachment-chunks/data-model.md
// Change Log:
// - 2026-09-09: Define generation, page, chunk, and vector projection entities

# Data Model: RAG Attachment Chunks

## Existing Entity Modification: attachments

Add the effective security classification used by RAG ingestion:

| Column | Type | Rules |
|---|---|---|
| `classification` | ENUM | `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`; initialized from Document Security Policy and lowered only through audited Security/System Admin override |

The Attachment remains the canonical effective source for RAG classification. Correspondence/Document policy supplies the default at Attachment creation or policy synchronization.

## 1. rag_attachment_generations

One checksum-bound ingestion attempt for one Attachment.

| Column | Type | Rules |
|---|---|---|
| `generation_uuid` | UUIDv7 | Primary key; internal lifecycle identity |
| `attachment_uuid` | UUID | FK to `attachments.uuid`; required |
| `attachment_checksum_snapshot` | CHAR(64) | Required; checksum seen at enqueue |
| `verified_content_checksum` | CHAR(64) | Required before ACTIVE; must match snapshot |
| `status` | ENUM | `BUILDING`, `ACTIVE`, `RETIRED`, `FAILED` |
| `embedding_model` | VARCHAR | BGE-M3 snapshot |
| `embedding_model_version` | VARCHAR | Model revision/config identity |
| `embedding_schema` | JSON | Dense/sparse dimensions and schema |
| `error_code` | VARCHAR | Nullable failure code |
| `error_message` | TEXT | Nullable technical/recovery detail; not exposed raw to users |
| `created_at` | DATETIME(3) | Required |
| `activated_at` | DATETIME(3) | Nullable |
| `retired_at` | DATETIME(3) | Nullable |
| `failed_at` | DATETIME(3) | Nullable |

Rules:

- Exactly one `ACTIVE` generation per Attachment.
- Retry always creates a new `generation_uuid`.
- `FAILED` metadata/error is retained for 30 days.
- `RETIRED` remains until vector cleanup succeeds.
- Generation state transitions require Redlock plus a database transaction.

## 2. rag_attachment_pages

Canonical normalized text segments for citation and re-chunking.

| Column | Type | Rules |
|---|---|---|
| `page_uuid` | UUIDv7 | Primary key |
| `generation_uuid` | UUIDv7 | FK to generation; required |
| `attachment_uuid` | UUID | FK to Attachment; required |
| `segment_type` | ENUM | `PAGE`, `SECTION`, `SHEET`, `WHOLE_DOCUMENT` |
| `segment_number` | INT | Nullable for non-numbered segments |
| `segment_label` | VARCHAR(255) | Nullable source label |
| `source_locator` | VARCHAR(1000) | Inner ZIP path or source locator |
| `normalized_text` | LONGTEXT | Canonical normalized segment text |
| `normalized_start_offset` | BIGINT | Offset in normalized source coordinate |
| `normalized_end_offset` | BIGINT | Offset in normalized source coordinate |
| `created_at` | DATETIME(3) | Required |

## 3. rag_attachment_chunks

Ordered retrieval spans copied from canonical page/segment text.

| Column | Type | Rules |
|---|---|---|
| `chunk_public_id` | UUIDv7 | Primary key and Qdrant point ID |
| `generation_uuid` | UUIDv7 | FK to generation; required |
| `attachment_uuid` | UUID | FK to `attachments.uuid`; required |
| `chunk_index` | INT | Unique within generation |
| `content` | TEXT | Normalized retrieval content |
| `source_page_uuid` | UUIDv7 | FK to page/segment |
| `segment_type` | ENUM | Same segment vocabulary as pages |
| `segment_number` | INT | Nullable |
| `segment_label` | VARCHAR(255) | Nullable |
| `source_locator` | VARCHAR(1000) | ZIP inner path or source locator |
| `start_offset` | BIGINT | Normalized source offset |
| `end_offset` | BIGINT | Normalized source offset |
| `doc_type` | VARCHAR(50) | Metadata snapshot |
| `doc_number` | VARCHAR(100) | Metadata snapshot |
| `revision` | VARCHAR(50) | Metadata snapshot |
| `owner_type` | VARCHAR(50) | Canonical domain owner type |
| `owner_public_id` | UUID | Owning entity public ID |
| `project_public_id` | UUID | Owning Project tenant key |
| `classification` | ENUM | `PUBLIC`, `INTERNAL`, `CONFIDENTIAL` |
| `created_at` | DATETIME(3) | Required |

Rules:

- Unique `(generation_uuid, chunk_index)`.
- `attachment_uuid` references physical `attachments.uuid`; API uses `attachmentPublicId`.
- No embedding vector is stored in MariaDB.
- Chunk text is copied from `rag_attachment_pages` for retrieval/full-text access.

## 4. Qdrant Vector Point

One point per `chunk_public_id` for an ACTIVE generation.

Payload:

```json
{
  "chunk_public_id": "UUIDv7",
  "generation_uuid": "UUIDv7",
  "attachment_public_id": "UUIDv7",
  "owner_type": "CORRESPONDENCE",
  "owner_public_id": "UUIDv7",
  "project_public_id": "UUIDv7",
  "doc_type": "CORR",
  "doc_number": "CORR-2026-001",
  "revision": "Rev.A",
  "classification": "INTERNAL",
  "segment_type": "PAGE",
  "segment_number": 3,
  "segment_label": "Page 3",
  "source_locator": "drawing.pdf",
  "start_offset": 120,
  "end_offset": 640
}
```

Mandatory filter: `project_public_id` for every query.

## 5. TextSegment Contract

```typescript
interface TextSegment {
  segmentType: 'PAGE' | 'SECTION' | 'SHEET' | 'WHOLE_DOCUMENT';
  segmentNumber?: number;
  segmentLabel?: string;
  sourceLocator?: string;
  text: string;
}
```

## 6. Owner Type Vocabulary

```text
CORRESPONDENCE
RFA
TRANSMITTAL
CIRCULATION
CONTRACT_DRAWING
SHOP_DRAWING
AS_BUILT_DRAWING
```

Source tables are resolved internally and are not emitted as the Qdrant owner contract.
