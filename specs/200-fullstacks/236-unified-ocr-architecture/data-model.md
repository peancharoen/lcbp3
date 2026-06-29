// File: specs/200-fullstacks/236-unified-ocr-architecture/data-model.md
// Change Log:
// - 2026-06-13: Data model for Unified AI Model Architecture — Sandbox-Production Parity (ADR-036)

# Data Model: Unified AI Model Architecture — Sandbox-Production Parity

> ADR-009 compliant — all schema changes via SQL delta, no TypeORM migrations.
> Delta file: `specs/03-Data-and-Storage/deltas/2026-06-13-extend-ai-execution-profiles-ocr.sql`

---

## DB Schema Extensions

### ai_execution_profiles (extended)

```sql
-- Delta: 2026-06-13-extend-ai-execution-profiles-ocr.sql
ALTER TABLE ai_execution_profiles
  ADD COLUMN canonical_model VARCHAR(50) NOT NULL DEFAULT 'np-dms-ai' COMMENT 'np-dms-ai | np-dms-ocr',
  MODIFY COLUMN num_ctx      INT NULL COMMENT 'NULL for OCR model (not used)',
  MODIFY COLUMN max_tokens   INT NULL COMMENT 'NULL for OCR model (not used)';

-- Seed ocr-extract row
INSERT INTO ai_execution_profiles
  (profile_name, canonical_model, temperature, top_p, max_tokens, num_ctx, repeat_penalty, keep_alive_seconds, is_active)
VALUES
  ('ocr-extract', 'np-dms-ocr', 0.1, 0.1, NULL, NULL, 1.1, 0, 1)
ON DUPLICATE KEY UPDATE canonical_model = canonical_model;

-- Update existing rows with canonical name
UPDATE ai_execution_profiles SET canonical_model = 'np-dms-ai'
WHERE profile_name IN ('interactive', 'standard', 'quality', 'deep-analysis');
```

### ai_sandbox_profiles (new table)

```sql
-- Delta: 2026-06-13-extend-ai-execution-profiles-ocr.sql
CREATE TABLE IF NOT EXISTS ai_sandbox_profiles (
  id                INT PRIMARY KEY AUTO_INCREMENT,
  profile_name      VARCHAR(50)    NOT NULL,
  canonical_model   VARCHAR(50)    NOT NULL DEFAULT 'np-dms-ai',  -- 'np-dms-ai' | 'np-dms-ocr'
  temperature       DECIMAL(4,3)   NOT NULL,
  top_p             DECIMAL(4,3)   NOT NULL,
  max_tokens        INT            NULL,    -- NULL for np-dms-ocr
  num_ctx           INT            NULL,    -- NULL for np-dms-ocr
  repeat_penalty    DECIMAL(5,3)   NOT NULL,
  keep_alive_seconds INT           NOT NULL DEFAULT 0,
  updated_by        INT            NULL,
  updated_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sandbox_profile_name (profile_name)
);
```

> - Mirrors `ai_execution_profiles` structure exactly
> - Used as admin draft store — does **not** affect production jobs until "Apply to Production"
> - Auto-seeded from production row when draft is absent (`getSandboxParameters`)

### ai_audit_logs (extended — action type)

```sql
-- No schema change needed — action column already VARCHAR(50)
-- New action value: 'APPLY_PROFILE'
-- Metadata JSON extended with:
--   { profileName, canonicalModel, oldValues: {...}, newValues: {...} }
```

---

## TypeScript Types (Backend)

### AiExecutionProfile (entity, modified)

```typescript
// File: backend/src/modules/ai/entities/ai-execution-profile.entity.ts
// MODIFY: +canonicalModel column; numCtx/maxTokens nullable
@Entity('ai_execution_profiles')
export class AiExecutionProfile {
  @PrimaryGeneratedColumn() id: number;

  @Column({ name: 'profile_name', unique: true }) profileName: string;

  @Column({ name: 'canonical_model', default: 'np-dms-ai' })
  canonicalModel: 'np-dms-ai' | 'np-dms-ocr';

  @Column({ type: 'decimal', precision: 4, scale: 3 }) temperature: number;

  @Column({ name: 'top_p', type: 'decimal', precision: 4, scale: 3 }) topP: number;

  @Column({ name: 'max_tokens', type: 'int', nullable: true })
  maxTokens: number | null;  // NULL for np-dms-ocr

  @Column({ name: 'num_ctx', type: 'int', nullable: true })
  numCtx: number | null;     // NULL for np-dms-ocr

  @Column({ name: 'repeat_penalty', type: 'decimal', precision: 5, scale: 3 })
  repeatPenalty: number;

  @Column({ name: 'keep_alive_seconds' }) keepAliveSeconds: number;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 }) isActive: boolean;
}
```

### AiSandboxProfile (entity, new)

```typescript
// File: backend/src/modules/ai/entities/ai-sandbox-profile.entity.ts
// NEW: draft store for sandbox parameter testing
@Entity('ai_sandbox_profiles')
export class AiSandboxProfile {
  @PrimaryGeneratedColumn() id: number;

  @Column({ name: 'profile_name', unique: true }) profileName: string;

  @Column({ name: 'canonical_model', default: 'np-dms-ai' })
  canonicalModel: 'np-dms-ai' | 'np-dms-ocr';

  @Column({ type: 'decimal', precision: 4, scale: 3 }) temperature: number;

  @Column({ name: 'top_p', type: 'decimal', precision: 4, scale: 3 }) topP: number;

  @Column({ name: 'max_tokens', type: 'int', nullable: true })
  maxTokens: number | null;

  @Column({ name: 'num_ctx', type: 'int', nullable: true })
  numCtx: number | null;

  @Column({ name: 'repeat_penalty', type: 'decimal', precision: 5, scale: 3 })
  repeatPenalty: number;

  @Column({ name: 'keep_alive_seconds', default: 0 }) keepAliveSeconds: number;
}
```

### AiJobPayload (interface, modified)

```typescript
// File: backend/src/modules/ai/interfaces/execution-policy.interface.ts
// MODIFY: +ocrSnapshotParams for dual-model jobs
export interface SnapshotParams {
  temperature: number;
  topP: number;
  maxTokens: number | null;  // null for OCR
  numCtx: number | null;     // null for OCR
  repeatPenalty: number;
  // keep_alive excluded — lazy-loaded per ADR-033
}

export interface AiJobPayload {
  jobType: InternalJobType;
  documentPublicId?: string;
  attachmentPublicId?: string;
  effectiveProfile: string;
  canonicalModel: 'np-dms-ai' | 'np-dms-ocr';
  snapshotParams: SnapshotParams;           // LLM params (np-dms-ai)
  ocrSnapshotParams?: SnapshotParams;       // OCR params (np-dms-ocr); present for dual-model jobs
}
```

> - `snapshotParams` frozen at dispatch time — worker uses directly, no DB/Redis re-read
> - `ocrSnapshotParams` present for `migrate-document` jobs using both models
> - `keepAliveSeconds` excluded from snapshot (lazy-loaded per ADR-033)

### ApplyProfileDto (DTO, new)

```typescript
// File: backend/src/modules/ai/dto/apply-profile.dto.ts
export class ApplyProfileDto {
  @IsString()
  @IsNotEmpty()
  profileName: string;

  @IsIn(['np-dms-ai', 'np-dms-ocr'])
  canonicalModel: 'np-dms-ai' | 'np-dms-ocr';

  @IsNumber()
  @Min(0) @Max(1)
  temperature: number;

  @IsNumber()
  @Min(0) @Max(1)
  topP: number;

  @IsNumber()
  @Min(1) @Max(2)
  repeatPenalty: number;

  @IsNumber()
  @Min(0)
  keepAliveSeconds: number;

  @IsOptional() @IsInt() @Min(512)
  numCtx?: number | null;    // omit for np-dms-ocr

  @IsOptional() @IsInt() @Min(256)
  maxTokens?: number | null; // omit for np-dms-ocr
}
```

### ApplyResultDto (DTO, new)

```typescript
// File: backend/src/modules/ai/dto/apply-result.dto.ts
export class ApplyResultDto {
  profileName: string;
  canonicalModel: 'np-dms-ai' | 'np-dms-ocr';
  appliedAt: string;       // ISO8601
  appliedBy: string;       // user publicId
  oldValues: SnapshotParams;
  newValues: SnapshotParams;
  cacheInvalidated: boolean;
}
```

---

## Service Methods Summary

### AiPolicyService (extended)

| Method | Description |
|--------|-------------|
| `getSandboxParameters(profileName)` | Get sandbox draft; auto-seed from production if absent |
| `saveSandboxDraft(profileName, params)` | UPSERT to `ai_sandbox_profiles` |
| `resetSandboxToProduction(profileName)` | Overwrite sandbox draft with current production values |
| `applyProfile(profileName, idempotencyKey, user)` | Copy sandbox draft → production; DEL Redis cache; audit log |
| `getProfileParameters(profileName)` | Read from `ai_execution_profiles` with Redis cache TTL 60s |
| `getModelDefaults(canonicalModel)` | Query `ai_execution_profiles` by `canonical_model` column |

### Redis Cache Keys

| Key | TTL | Invalidated by |
|-----|-----|----------------|
| `ai:profile:{profileName}` | 60s | `applyProfile()` |
| `ai:idempotency:apply:{key}` | 5min | Automatic expiry |

---

## Endpoint Summary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ai/sandbox-profiles/:profileName` | Get sandbox draft (auto-seed if absent) |
| `PUT` | `/api/ai/sandbox-profiles/:profileName` | Save sandbox draft |
| `POST` | `/api/ai/sandbox-profiles/:profileName/reset` | Reset sandbox draft to production values |
| `POST` | `/api/ai/profiles/:profileName/apply` | Apply sandbox → production (requires `Idempotency-Key`, CASL `system.manage_ai`) |
| `GET` | `/api/ai/profiles/:profileName` | Get production defaults (read-only) |
