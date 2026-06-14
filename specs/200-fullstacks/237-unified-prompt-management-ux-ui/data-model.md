# Data Model: Unified Prompt Management UX/UI

**Feature**: 237-unified-prompt-management-ux-ui  
**Date**: 2026-06-14  
**Purpose**: Define data entities, relationships, and validation rules

## Entities

### AiPrompt

Represents a prompt version with template, context config, and activation status.

**Table**: `ai_prompts` (extends existing ADR-029 schema)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT AUTO_INCREMENT | PRIMARY KEY | Internal ID (not exposed) |
| `public_id` | UUID | UNIQUE, NOT NULL | Public identifier (ADR-019) |
| `prompt_type` | VARCHAR(50) | NOT NULL, INDEX | Prompt type: ocr_extraction, rag_query_prompt, rag_prep_prompt, classification_prompt |
| `version_number` | INT | NOT NULL, INDEX | Version number (per prompt_type) |
| `template` | TEXT | NOT NULL | Prompt template with placeholders |
| `context_config` | JSON | NULL | Context configuration (filter, pageSize, language) |
| `is_active` | TINYINT(1) | NOT NULL, DEFAULT 0 | Active flag (1 = active) |
| `manual_note` | VARCHAR(500) | NULL | Manual annotation |
| `created_by` | INT | NOT NULL, FK → users.id | Creator user ID |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Update timestamp |

**Unique Constraint**: `(prompt_type, version_number)` - ensures version numbers are unique per type

**Validation Rules**:
- `prompt_type` must be one of: ocr_extraction, rag_query_prompt, rag_prep_prompt, classification_prompt
- `template` must contain required placeholders based on `prompt_type`:
  - ocr_extraction: {{ocr_text}}, {{master_data_context}}
  - rag_query_prompt: {{query}}, {{context}}
  - rag_prep_prompt: {{text}}
  - classification_prompt: {{document_text}}
- `context_config` JSON structure:
  ```json
  {
    "filter": {
      "projectId": "uuid|null",
      "contractId": "uuid|null"
    },
    "pageSize": 3,
    "language": "th",
    "outputLanguage": "th"
  }
  ```
- `is_active` can only be true for one version per `prompt_type` at a time

**Relationships**:
- `created_by` → `users.id` (many-to-one)

---

### AiExecutionProfile

Represents runtime parameters for AI model behavior (global per profile, not per prompt version).

**Table**: `ai_execution_profiles` (new table per ADR-036)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT AUTO_INCREMENT | PRIMARY KEY | Internal ID (not exposed) |
| `public_id` | UUID | UNIQUE, NOT NULL | Public identifier (ADR-019) |
| `profile_name` | VARCHAR(100) | NOT NULL, UNIQUE | Profile name (e.g., "default", "fast", "accurate") |
| `temperature` | DECIMAL(3,2) | NOT NULL, DEFAULT 0.7 | Temperature (0.0 - 1.0) |
| `top_p` | DECIMAL(3,2) | NOT NULL, DEFAULT 0.9 | Top-P (0.0 - 1.0) |
| `repeat_penalty` | DECIMAL(3,2) | NOT NULL, DEFAULT 1.0 | Repeat penalty (1.0 - 2.0) |
| `max_tokens` | INT | NOT NULL, DEFAULT 2048 | Max tokens (1 - 8192) |
| `ctx_size` | INT | NOT NULL, DEFAULT 4096 | Context size (1 - 16384) |
| `keep_alive` | INT | NOT NULL, DEFAULT 300 | Keep-alive seconds (0 - 3600) |
| `is_default` | TINYINT(1) | NOT NULL, DEFAULT 0 | Default profile flag |
| `created_by` | INT | NOT NULL, FK → users.id | Creator user ID |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Update timestamp |

**Validation Rules**:
- `temperature` must be between 0.0 and 1.0
- `top_p` must be between 0.0 and 1.0
- `repeat_penalty` must be between 1.0 and 2.0
- `max_tokens` must be between 1 and 8192
- `ctx_size` must be between 1 and 16384
- `keep_alive` must be between 0 and 3600
- `is_default` can only be true for one profile at a time

**Relationships**:
- `created_by` → `users.id` (many-to-one)

---

### SandboxJob

Represents a sandbox test execution (transient, stored in Redis, not in database).

**Redis Key**: `sandbox:job:{jobId}` (TTL: 1 hour)

**Structure**:
```json
{
  "jobId": "uuid",
  "jobType": "ocr|ai-extract|rag-prep",
  "status": "pending|processing|completed|failed",
  "result": {
    "ocrText": "string|null",
    "extractedMetadata": "object|null",
    "ragChunks": "array|null",
    "ragVectors": "array|null",
    "error": "string|null"
  },
  "createdAt": "timestamp",
  "completedAt": "timestamp|null"
}
```

**Validation Rules**:
- `jobType` must be one of: ocr, ai-extract, rag-prep
- `status` transitions: pending → processing → completed/failed
- `result` structure depends on `jobType`:
  - ocr: { ocrText, error }
  - ai-extract: { extractedMetadata, error }
  - rag-prep: { ragChunks, ragVectors, error }

**Relationships**: None (transient data)

---

## Entity Relationships

```
users (1) ──────── (∞) ai_prompts
  │
  └── (1) ──────── (∞) ai_execution_profiles

ai_prompts (independent from ai_execution_profiles)
  - Runtime parameters are global (ai_execution_profiles)
  - Context config is per version (ai_prompts.context_config)
```

---

## Indexes

### ai_prompts
- `idx_prompt_type_version`: `(prompt_type, version_number)` - UNIQUE
- `idx_prompt_type_active`: `(prompt_type, is_active)` - for finding active version
- `idx_public_id`: `(public_id)` - UNIQUE

### ai_execution_profiles
- `idx_profile_name`: `(profile_name)` - UNIQUE
- `idx_is_default`: `(is_default)` - for finding default profile
- `idx_public_id`: `(public_id)` - UNIQUE

---

## Database Schema Changes (ADR-009)

### New Table: ai_execution_profiles

```sql
CREATE TABLE ai_execution_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id UUID NOT NULL,
  profile_name VARCHAR(100) NOT NULL UNIQUE,
  temperature DECIMAL(3,2) NOT NULL DEFAULT 0.7,
  top_p DECIMAL(3,2) NOT NULL DEFAULT 0.9,
  repeat_penalty DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  max_tokens INT NOT NULL DEFAULT 2048,
  ctx_size INT NOT NULL DEFAULT 4096,
  keep_alive INT NOT NULL DEFAULT 300,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE,
  UNIQUE KEY uk_public_id (public_id),
  KEY idx_is_default (is_default),
  CONSTRAINT fk_execution_profile_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Seed Data: ai_execution_profiles

```sql
INSERT INTO ai_execution_profiles (public_id, profile_name, temperature, top_p, repeat_penalty, max_tokens, ctx_size, keep_alive, is_default, created_by)
VALUES 
  (UUID(), 'default', 0.7, 0.9, 1.0, 2048, 4096, 300, 1, 1),
  (UUID(), 'fast', 0.5, 0.8, 1.0, 1024, 2048, 0, 0, 1),
  (UUID(), 'accurate', 0.8, 0.95, 1.1, 4096, 8192, 600, 0, 1);
```

### Seed Data: ai_prompts (additional types)

```sql
-- RAG Query Prompt
INSERT INTO ai_prompts (public_id, prompt_type, version_number, template, context_config, is_active, created_by)
VALUES (
  UUID(),
  'rag_query_prompt',
  1,
  'Answer the following question based on the provided context:\n\nQuestion: {{query}}\n\nContext: {{context}}\n\nAnswer:',
  '{"filter": null, "language": "th"}',
  1,
  1
);

-- RAG Prep Prompt
INSERT INTO ai_prompts (public_id, prompt_type, version_number, template, context_config, is_active, created_by)
VALUES (
  UUID(),
  'rag_prep_prompt',
  1,
  'Split the following text into semantic chunks for RAG indexing:\n\nText: {{text}}\n\nOutput JSON array of chunks with "text" and "summary" fields.',
  '{"filter": null, "language": "th"}',
  1,
  1
);

-- Classification Prompt
INSERT INTO ai_prompts (public_id, prompt_type, version_number, template, context_config, is_active, created_by)
VALUES (
  UUID(),
  'classification_prompt',
  1,
  'Classify the following document into one of these categories: Correspondence, RFA, Transmittal, Circulation, Shop Drawing, Contract Drawing\n\nDocument: {{document_text}}\n\nOutput JSON with "category" and "confidence" fields.',
  '{"filter": null, "language": "th"}',
  1,
  1
);
```
