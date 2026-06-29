# Data Model: Unified AI Architecture

## Entity: `migration_review_queue`
Stores legacy document processing results waiting for human-in-the-loop validation.

**Table Structure**:
- `id` (INT, PK, Auto Increment) - Internal ID
- `public_id` (BINARY(16), UUIDv7, Unique, Indexed) - Exposed to API (ADR-019)
- `batch_id` (VARCHAR) - Groups documents from a single run
- `original_file_name` (VARCHAR) - Name of the uploaded PDF
- `extracted_metadata` (JSON) - The AI-extracted fields (title, date, categories, etc.)
- `confidence_score` (DECIMAL) - Overall AI confidence score (0.0 to 1.0)
- `status` (ENUM) - `PENDING`, `IMPORTED`, `REJECTED`
- `error_reason` (TEXT, Nullable) - Populated if status is `REJECTED`
- `version` (INT) - OptLocking via `@VersionColumn`
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Entity: `ai_audit_logs`
Development feedback logs for recording AI vs Human decisions.

**Table Structure**:
- `id` (INT, PK, Auto Increment) - Internal ID
- `public_id` (BINARY(16), UUIDv7, Unique, Indexed) - Exposed to API
- `document_public_id` (BINARY(16), Nullable) - References the document if successfully imported
- `model_name` (VARCHAR) - LLM Model used (e.g., "gemma4:9b")
- `ai_suggestion_json` (JSON) - What the AI suggested
- `human_override_json` (JSON) - What the human actually saved
- `confidence_score` (DECIMAL)
- `confirmed_by_user_id` (INT) - FK to users table
- `created_at` (TIMESTAMP)

## Entity: `Project` (Existing)
*Added Context*: The `publicId` of this table is injected natively into Qdrant payload filters as `project_public_id` for multi-tenant isolation.
