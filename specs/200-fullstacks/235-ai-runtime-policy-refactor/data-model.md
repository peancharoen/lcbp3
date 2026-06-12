// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/data-model.md
// Change Log:
// - 2026-06-11: Data model for AI Runtime Policy Refactor
// - 2026-06-11: Rename ExecutionProfile — interactive/standard/quality/deep-analysis; เพิ่ม numCtx, repeatPenalty ใน RuntimePolicy
// - 2026-06-11: เพิ่ม OcrRuntimePolicy จาก np-dms-ocr.model.md (fixed parameters, keep_alive dynamic)

# Data Model: AI Runtime Policy Refactor

> หมายเหตุ: Feature นี้ไม่เพิ่ม schema DB ใหม่ (ADR-009 compliant) — เปลี่ยนเฉพาะ TypeScript interfaces, DTO shapes, และ Python data structures บน sidecar

---

## TypeScript Types (Backend)

### JobType (types)

```typescript
// File: backend/src/modules/ai/interfaces/execution-policy.interface.ts

// PublicJobType — รับจาก caller ผ่าน POST /api/ai/jobs เท่านั้น
export type PublicJobType = 'auto-fill-document' | 'migrate-document' | 'rag-query';

// InternalJobType — ใช้ภายใน AiPolicyService; ครอบคลุมทุก job type รวม internal
// sandbox-analysis — admin trigger ผ่าน OCR Sandbox โดยตรง (deep-analysis profile)
export type InternalJobType = PublicJobType | 'intent-classify' | 'tool-suggest' | 'ocr-extract' | 'sandbox-analysis';
```

> `intent-classify`, `tool-suggest`, `ocr-extract` — internal เท่านั้น; ถ้า caller ส่ง type เหล่านี้มา → HTTP 400

---

### ExecutionProfile (enum)

```typescript
// File: backend/src/modules/ai/interfaces/execution-policy.interface.ts
// ค่า default ของแต่ละ profile ดูได้ที่ docs/ai-profiles.md
// ops/admin calibrate ได้ผ่าน Admin Console และบันทึกใน DB ตาม ADR-029
export type ExecutionProfile = 'interactive' | 'standard' | 'quality' | 'deep-analysis';
```

### RuntimePolicy (interface)

```typescript
// File: backend/src/modules/ai/interfaces/execution-policy.interface.ts
export interface RuntimePolicy {
  canonicalModel: 'np-dms-ai' | 'np-dms-ocr';  // ชื่อ canonical เท่านั้น
  temperature: number;       // default: interactive=0.7, standard=0.5, quality=0.1, deep-analysis=0.3
  topP: number;              // default: interactive=0.9, standard=0.8, quality=0.95, deep-analysis=0.85
  maxTokens: number;         // default: interactive=2048, standard=4096, quality=8192, deep-analysis=8192
  numCtx: number;            // default: interactive=4096, standard=8192, quality=8192, deep-analysis=32768
  repeatPenalty: number;     // default: 1.15 ทุก profile
  keepAliveSeconds: number;  // default: interactive=300, standard=600, quality=600, deep-analysis=0
}
```

### OcrRuntimePolicy (interface)

```typescript
// File: backend/src/modules/ai/interfaces/ocr-residency.interface.ts
// Parameters จาก specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/np-dms-ocr.model.md
// ไม่ calibrate ผ่าน Admin Console — ค่า fixed ตาม Modelfile
export interface OcrRuntimePolicy {
  canonicalModel: 'np-dms-ocr';    // FROM scb10x/typhoon-ocr1.5-3b:latest
  numCtx: 8192;                     // PARAMETER num_ctx 8192
  numPredict: 4096;                 // PARAMETER num_predict 4096
  temperature: 0.1;                 // PARAMETER temperature 0.1
  topP: 0.1;                        // PARAMETER top_p 0.1
  repeatPenalty: 1.1;               // PARAMETER repeat_penalty 1.1
  keepAliveSeconds: number;         // dynamic — คำนวณจาก OcrResidencyDecision
}
```

> `np-dms-ocr` ใช้ parameters คงที่ตาม Modelfile — **มีแค่ `keep_alive` เท่านั้นที่ dynamic** ตาม VRAM headroom

### OcrResidencyDecision (interface)

```typescript
// File: backend/src/modules/ai/interfaces/ocr-residency.interface.ts
export interface OcrResidencyDecision {
  keepAliveSeconds: number;          // 0 = unload; > 0 = residency window
  vramHeadroomMb: number;            // หรือ -1 ถ้า query ล้มเหลว
  activeProfile: ExecutionProfile | null;
  reason: 'deep-analysis-active' | 'high-pressure' | 'headroom-sufficient' | 'query-failed';
}
```

### VramHeadroom (interface)

```typescript
// File: backend/src/modules/ai/interfaces/execution-policy.interface.ts
export interface VramHeadroom {
  totalMb: number;         // ค่า total VRAM (hardcoded จาก env)
  usedMb: number;          // ค่าจาก Ollama /api/ps
  availableMb: number;     // totalMb - usedMb
  querySuccess: boolean;   // false = ใช้ safe default
}
```

### AiJobPayload (BullMQ job data)

```typescript
// File: backend/src/modules/ai/interfaces/execution-policy.interface.ts
// BullMQ job payload — parameters ถูก snapshot ณ เวลา dispatch (FR-A09)
// worker ใช้ค่าจาก payload โดยตรง ไม่อ่าน DB/Redis อีกรอบ
export interface AiJobPayload {
  jobType: InternalJobType;
  documentPublicId?: string;
  attachmentPublicId?: string;
  // snapshot ณ เวลา dispatch โดย AiPolicyService
  effectiveProfile: ExecutionProfile;
  canonicalModel: 'np-dms-ai' | 'np-dms-ocr';
  snapshotParams: {
    temperature: number;
    topP: number;
    maxTokens: number;
    numCtx: number;
    repeatPenalty: number;
    keepAliveSeconds: number;
  };
}
```

> `snapshotParams` ทำให้ทุก job predictable — แม้ admin calibrate ค่าใหม่ระหว่าง job queue อยู่ ค่าเดิมที่ snapshot ไว้จะถูกใช้; audit log บันทึก `snapshotParams` ด้วยเพื่อ traceability

---

### CreateAiJobDto (updated)

```typescript
// File: backend/src/modules/ai/dto/create-ai-job.dto.ts
// [CHANGE] ลบ executionProfile, model fields ออกทั้งหมด — backend กำหนดจาก job.type
export class CreateAiJobDto {
  @IsEnum(['auto-fill-document', 'migrate-document', 'rag-query'])
  type: PublicJobType;

  @IsOptional()
  @IsUUID('all')
  documentPublicId?: string;

  @IsOptional()
  @IsUUID('all')
  attachmentPublicId?: string;

  // [REMOVED] executionProfile — backend กำหนดอัตโนมัติจาก job.type (Option B)
  // [REMOVED] model: { key, parameters } — ไม่อนุญาตแล้ว
}
```

---

## DB Schema Extensions

### ai_execution_profiles (new table)

```sql
-- Delta: specs/03-Data-and-Storage/deltas/2026-06-11-create-ai-execution-profiles.sql
CREATE TABLE ai_execution_profiles (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  profile_name     VARCHAR(50) NOT NULL UNIQUE,  -- 'interactive'|'standard'|'quality'|'deep-analysis'
  temperature      DECIMAL(4,3) NOT NULL,
  top_p            DECIMAL(4,3) NOT NULL,
  max_tokens       INT NOT NULL,
  num_ctx          INT NOT NULL,
  repeat_penalty   DECIMAL(5,3) NOT NULL,
  keep_alive_seconds INT NOT NULL,               -- 0 = unload immediately
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  updated_by       INT NULL,                     -- NULL = seed default
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

> - ค่า default seed จาก `docs/ai-profiles.md` ผ่าน delta SQL
> - Admin calibrate ผ่าน Admin Console → `UPDATE ai_execution_profiles SET ... WHERE profile_name = ?`
> - `AiPolicyService` อ่านค่าจาก table นี้ (Redis cache TTL 60s ตาม ADR-029 pattern)
> - `ON DUPLICATE KEY UPDATE profile_name = profile_name` — ป้องกัน overwrite ค่าที่ admin calibrate ไว้

### ai_audit_logs (extended columns)

```sql
-- Delta: specs/03-Data-and-Storage/deltas/2026-06-11-extend-ai-audit-logs-runtime-policy.sql
ALTER TABLE ai_audit_logs
  ADD COLUMN effective_profile   VARCHAR(50) NULL  -- 'interactive'|'standard'|'quality'|'deep-analysis'
  ADD COLUMN canonical_model     VARCHAR(50) NULL  -- 'np-dms-ai' | 'np-dms-ocr'
  ADD COLUMN snapshot_params_json JSON NULL;       -- { temperature, topP, maxTokens, numCtx, repeatPenalty, keepAliveSeconds }
```

> - `effective_profile` + `canonical_model` แทน legacy `ai_model` / `model_name` ที่มีชื่อ runtime tag
> - `snapshot_params_json` บันทึก parameters จริงที่ใช้ใน Ollama call (FR-A09) — ทำให้ audit traceability สมบูรณ์
> - columns เดิม (`ai_model`, `model_name`) ยังคงอยู่ (backward compat) — Feature-235 เขียน columns ใหม่เพิ่มเติม

---

## Python Types (OCR Sidecar)

### VramHeadroom (dataclass)

```python
# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/services/vram_monitor.py
@dataclass
class VramHeadroom:
    total_mb: float
    used_mb: float
    available_mb: float
    query_success: bool
```

### OcrResidencyPolicy (dataclass)

```python
# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/services/residency_policy.py
@dataclass
class OcrResidencyDecision:
    keep_alive_seconds: int   # 0 = unload
    vram_headroom_mb: float
    reason: str               # 'large-context-active' | 'high-pressure' | 'headroom-sufficient' | 'query-failed'
```

### EmbedRequest (updated)

```python
# ไม่มี model selection field — backend policy กำหนด model ทั้งหมด
class EmbedRequest(BaseModel):
    texts: List[str]
    # [NO model field] — device selection เป็น internal logic ของ sidecar
```

---

## ai_audit_logs — เพิ่ม Fields (ไม่เปลี่ยน schema, เปลี่ยน payload JSON)

```text
ai_audit_logs.metadata (JSON column ที่มีอยู่แล้ว) จะเพิ่ม fields:
  - modelUsed: "np-dms-ai" | "np-dms-ocr"  (canonical name เสมอ)
  - executionProfile: ExecutionProfile
  - ocrResidencyDecision: OcrResidencyDecision (สำหรับ OCR jobs)
  - retrievalDevice: "gpu" | "cpu"           (สำหรับ RAG jobs)
  - vramHeadroomMb: number                   (ขณะ job เริ่มรัน)
```

> ใช้ JSON column ที่มีอยู่ — ไม่ต้อง ALTER TABLE (ADR-009 compliant)
