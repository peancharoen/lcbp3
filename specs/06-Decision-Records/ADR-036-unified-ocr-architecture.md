# ADR-036: Unified AI Model Architecture — Sandbox-Production Parity for np-dms-ai and np-dms-ocr

**Status:** Proposed
**Date:** 2026-06-13
**Decision Makers:** Development Team, AI Integration Lead
**Supersedes:** — (New Architecture)
**Amends:** AI model testing and parameter management layer
**Related Documents:**
- [ADR-034: AI Model Change](./ADR-034-AI-model-change.md)
- [ADR-033: Active Model & OCR Management](./ADR-033-active-model-and-ocr-management.md)
- [ADR-029: Dynamic Prompt Management](./ADR-029-dynamic-prompt-management.md)
- [CONTEXT.md](../../../CONTEXT.md)

> **Grilling resolution (2026-06-13):** ADR นี้เป็น **enhance** ของ Profile-Only Parameter Governance ที่มีอยู่ (`AiPolicyService` + `ai_execution_profiles`) **ไม่ใช่** การสร้าง `system_settings` param store ใหม่ และ**ไม่** supersede ADR-029/033. การตัดสินที่ resolved แล้ว: (1) production setting store = `ai_execution_profiles`; (2) **draft (sandbox) store = `ai_sandbox_profiles`** (แยกต่างหาก) — admin iterate ลง draft แล้วกด **Apply** = UPSERT draft → production row + DEL cache; (3) คง **Snapshot semantics** (params แช่แข็งลง job payload ณ dispatch); (4) systemPrompt อยู่ใน `ai_prompts` (Active Prompt) เท่านั้น; (5) OCR params = row `ocr-extract` + column `canonical_model`; (6) "OCR Sandbox" = **Production Pipeline Sandbox** (รัน pipeline เดียวกับ production). ดู `CONTEXT.md` → Flagged ambiguities + Glossary (from ADR-036).

---

## Context and Problem Statement

ปัจจุบันระบบใช้งานโมเดล AI สองตัวบน Desk-5439:
- `np-dms-ai:latest` — โมเดลหลักสำหรับงานทั่วไป (แทน `typhoon2.5-np-dms` ที่ยกเลิกแล้ว)
- `np-dms-ocr:latest` — โมเดลสำหรับ OCR (แทน `typhoon-np-dms-ocr` ที่ยกเลิกแล้ว)

**ปัญหาหลัก:**
1. **ชื่อโมเดลไม่สอดคล้อง** — Repository ยังใช้ชื่อเก่า `typhoon2.5-np-dms` และ `typhoon-np-dms-ocr` แต่ Desk-5439 ใช้ `np-dms-ai` และ `np-dms-ocr`
2. **ไม่มีกลไกทดสอบและบันทึกค่า** — Admin ไม่สามารถทดสอบ parameters (temperature, system prompt, etc.) ใน sandbox แล้ว apply ไป production ได้
3. **Sandbox กับ Production ใช้ params คนละชุด** — แม้ "OCR Sandbox" (`processSandboxExtract`/`processSandboxAiExtract`) จะรันเส้น pipeline เดียวกับ production (`processMigrateDocument`: OCR → Active Prompt → Master Data → LLM) แต่ sandbox **hardcode** `{ num_ctx: 16384, num_predict: 4096 }` ส่วน production ใช้ `snapshotParams` จาก profile → ผลทดสอบไม่สะท้อน production จริง (parity gap)

> **Concept (grilling resolved):** "OCR Sandbox" จริงๆ คือ **Production Pipeline Sandbox** — sandbox ของ production pipeline ทั้งเส้น (ต่างแค่ไม่ commit DB) ไม่ใช่เครื่องมือทดสอบ OCR อย่างเดียว ดู `CONTEXT.md` glossary.

---

## Decision Drivers

- **Sandbox-Production Parity:** ผลการทดสอบ parameters ทั้ง `np-dms-ai` และ `np-dms-ocr` ใน sandbox ต้องสามารถนำไปใช้ใน production ได้ 100%
- **Unified Testing & Apply Mechanism:** กลไกเดียวกันสำหรับการทดสอบและบันทึกค่า parameters ไปใช้ใน production ทั้งสองโมเดล
- **Dynamic Parameter Control:** Admin สามารถแก้ไข parameters (temperature, system prompt, etc.) ใน sandbox แล้ว apply ไป production ได้ทันที ทั้ง `np-dms-ai` และ `np-dms-ocr`
- **Sidecar-Centric Architecture:** ทุก AI operation ผ่าน sidecar (จัดการ model lifecycle เอง) ไม่ว่าจะเป็น `np-dms-ai` หรือ `np-dms-ocr`

---

## Decision Outcome

### 1. Calibration บน Profile/Prompt Store ที่มีอยู่ (enhance)

**ไม่สร้าง `AiModelService` + `system_settings` store ใหม่** — เติม write/apply path บนกลไกที่มี:

```
Draft → Apply → Production (2-layer):
  ┌──────────────────────────────────────────────┐
  │  Sandbox: admin แก้ draft → ai_sandbox_profiles │ → persisted (ไม่กระทบ production)
  │  Production Pipeline Sandbox อ่าน draft รันทดสอบ│
  └──────────────────────────────────────────────┘
              ↓ (พอใจ → กด Apply to Production)
  ┌──────────────────────────────────────────────┐
  │  applyProfile(): UPSERT ai_sandbox_profiles    │ → ai_execution_profiles row
  │                  (+ DEL redis cache)           │
  │  systemPrompt → AiPromptService.activate        │ → ai_prompts (ADR-029)
  └──────────────────────────────────────────────┘
              ↓
  ┌──────────────────────────────────────────────┐
  │  Production job → createJobPayload() snapshot  │ → params แช่แข็ง ณ dispatch (คงเดิม)
  │  → processor → sidecar (np-dms-ai / np-dms-ocr) │
  └──────────────────────────────────────────────┘
```

**SoT:** production = `ai_execution_profiles` (รวม row `ocr-extract`); draft = `ai_sandbox_profiles`; systemPrompt = `ai_prompts` — ไม่มี param store ใน `system_settings`

### 2. Data Flow — Test & Apply Pattern

**สำหรับทั้ง `np-dms-ai` และ `np-dms-ocr`:**

```
[Sandbox UI Testing]
    ↓
[เลือกโมเดล: np-dms-ai หรือ np-dms-ocr]
    ↓
[ปรับ parameters: temperature, systemPrompt, etc.]
    ↓
[ทดสอบ → ดูผลลัพธ์]
    ↓ (พอใจผล)
[กด "Apply to Production"]
    ↓
[runtime params → ai_execution_profiles (row ตาม canonical_model) + DEL redis cache]
[systemPrompt → ai_prompts (activate version, ADR-029)]
    ↓
[Production Job → createJobPayload() snapshot params ณ dispatch → ใช้ค่าที่แช่แข็ง]
```

### 3. Parameter Scope

| โมเดล | Runtime params → `ai_execution_profiles` | systemPrompt → `ai_prompts` (ADR-029) |
|-------|-------------------------------------------|----------------------------------------|
| `np-dms-ai` | temperature, topP, repeatPenalty, numCtx, maxTokens, keepAliveSeconds — ต่อ ExecutionProfile ที่ apply | Active Prompt ต่อ `prompt_type` |
| `np-dms-ocr` | temperature, topP, repeatPenalty, keepAliveSeconds (row `ocr-extract`; `numCtx`/`maxTokens` = NULL) | Active Prompt `ocr_extraction` (`{{ocr_text}}`) |

**ลบทิ้ง:** key `AI_MODEL_NP_DMS_AI_DEFAULTS` / `AI_MODEL_NP_DMS_OCR_DEFAULTS` / `OCR_PRODUCTION_DEFAULTS` — ไม่ใช้ `system_settings` เป็น param store (OCR param set อ้างอิง sidecar contract `app.py`: `temperature`/`top_p`/`repeat_penalty`/`keep_alive`)

### 4. Parameter Hierarchy (ทั้งสองโมเดล)

| Level | Source | ใช้เมื่อไหร |
|-------|--------|------------|
| **Runtime Override** | Job payload | ส่งค่าพิเศษเฉพาะ job |
| **Production Defaults** | DB (`ai_execution_profiles` row, snapshot ณ dispatch) | ค่าที่ admin apply จาก sandbox |
| **Service Defaults** | Hardcoded `AiPolicyService.defaultProfiles` / Modelfile | Fallback ถ้าไม่มี row/cache |

---

## Implementation Details

### 1. Backend — Enhance AiPolicyService (ไม่สร้าง AiModelService)

**File:** `backend/src/modules/ai/services/ai-policy.service.ts` (MODIFY)

เติม write/apply method ลงบน service เดิม (ที่มี `getProfileParameters()` read path + Redis cache อยู่แล้ว):

- `getSandboxParameters(profileName)` — อ่าน draft จาก `ai_sandbox_profiles`; **ถ้าไม่มี draft → seed (clone) จาก production row** ใน `ai_execution_profiles` แล้ว return (ไม่ fallback hardcoded ก่อน)
- `saveSandboxDraft(profileName, params, userId)` — UPSERT draft ลง `ai_sandbox_profiles`
- `resetSandboxToProduction(profileName, userId)` — overwrite draft ด้วยค่า production row ปัจจุบัน
- `applyProfile(profileName, userId)` — copy draft จาก `ai_sandbox_profiles` → UPSERT `ai_execution_profiles` + `DEL ai_execution_profiles:{profile}` cache (admin only)
- `getCanonicalModelName()` / `getProfileParameters()` / `createJobPayload()` — **คงเดิม** (snapshot semantics, อ่าน production)

**File:** `backend/src/modules/ai/entities/ai-execution-profile.entity.ts` (MODIFY)

- เพิ่ม column `canonicalModel: 'np-dms-ai' | 'np-dms-ocr'`
- ทำ `numCtx`/`maxTokens` เป็น nullable (OCR ไม่ใช้)

**File:** `backend/src/modules/ai/entities/ai-sandbox-profile.entity.ts` (NEW)

- mirror columns ของ `ai_execution_profiles` — เป็น **Sandbox Draft Profile** (persisted) ที่ admin iterate ก่อน Apply
- ค่าตั้งต้น **seed จาก production row** เมื่อยังไม่มี draft (ดู `getSandboxParameters()`) — ไม่เริ่มจากค่าว่าง/hardcoded

`applyProfile(profileName, userId)` อ่าน draft จาก `ai_sandbox_profiles` → UPSERT ลง `ai_execution_profiles` + DEL cache; `SandboxOcrEngineService` ที่มีอยู่ **คงไว้** (รับ params ที่ resolve จาก draft); systemPrompt apply → `ai_prompts` ผ่าน prompt service (ADR-029) **ไม่** เก็บใน profiles

### 2. Backend — Processor Updates

**File:** `backend/src/modules/ai/processors/ai-batch.processor.ts` (MODIFY)

**คงพฤติกรรมเดิม:** processor ใช้ `payload.snapshotParams` ที่ถูกแช่แข็งไว้ตอน dispatch (ไม่ lazy-read setting ตอน process) — ส่งต่อไป sidecar

**สิ่งที่ต้องเพิ่ม:** ให้ `createJobPayload('ocr-extract')` ดึง params จาก row `ocr-extract` (canonical_model = np-dms-ocr) แทนการยืม profile `standard`

**ปิด parity gap (สำคัญ):** `processSandboxExtract` / `processSandboxAiExtract` ต้อง**เลิก hardcode** `{ num_ctx: 16384, num_predict: 4096 }` แล้วสร้าง `generateOptions` จาก **`ai_sandbox_profiles`** (Sandbox Draft Profile, schema เดียวกับ `ai_execution_profiles`) เพื่อให้ admin เห็นผลของค่าที่กำลังปรับก่อน Apply — ส่วน `processMigrateDocument` (production) อ่านจาก `ai_execution_profiles` ผ่าน snapshot เหมือนเดิม. หลัง Apply ค่าทั้งสองตารางจะตรงกัน → parity จริง

Sidecar จะรวม parameters จาก request เข้ากับ defaults ใน Modelfile

#### 2.1 Dual-Model Snapshot & OCR Param Flow (Gap 1–4 resolved)

`migrate-document`/`auto-fill-document` เป็น **dual-model job** (OCR `np-dms-ocr` + LLM `np-dms-ai`) แต่ `createJobPayload` เดิม snapshot params **ชุดเดียว** (LLM) → OCR step ไม่ได้รับ tunable params ที่ admin ปรับ. แก้ดังนี้:

- **Gap 4 — OCR row แยกจาก `ExecutionProfile`:** `ocr-extract` เป็น **model-defaults row** (key ด้วย `canonical_model`/`profile_name='ocr-extract'`) **ไม่ใช่** สมาชิกของ `ExecutionProfile` union (คง Canonical Profile Set = interactive/standard/quality/deep-analysis). เพิ่ม accessor `getModelDefaults('np-dms-ocr')` แยกจาก `getProfileParameters(profile)`
- **Gap 3 — snapshot 2 ชุด (backward-compat):** `AiJobPayload` คง `snapshotParams` (LLM, ไม่แตะ processor LLM path) + เพิ่ม **`ocrSnapshotParams?: OcrTyphoonOptions`** (reuse type ที่มีอยู่ = `{ temperature, topP, repeatPenalty }`). populate `ocrSnapshotParams` เมื่อ pipeline ของ job รัน OCR (`migrate-document`/`auto-fill-document`/`ocr-extract`)
- **Gap 1 — wire ไป production OCR:** `OcrDetectionInput` เพิ่ม `typhoonOptions?: OcrTyphoonOptions`; `OcrService.processWithTyphoon` append `temperature`/`topP`/`repeatPenalty` ลง form (sidecar `/ocr-upload` รับอยู่แล้ว); `processMigrateDocument` ส่ง `typhoonOptions: job.data.ocrSnapshotParams`
- **Gap 2 — keep_alive ไม่ freeze:** กฎ **quality params freeze / resource params lazy** — temperature/top_p/repeat/num_ctx/max_tokens แช่แข็ง ณ dispatch; **keep_alive มาจาก `calculateOcrResidency()` (Adaptive OCR Residency, ADR-033) ณ process time** ไม่อยู่ใน tunable set (สอดคล้อง `OcrTyphoonOptions` ที่ไม่มี keep_alive อยู่แล้ว)
- **Audit:** `snapshotParamsJson = { ...llmParams, ocr: ocrSnapshotParams }` ใน audit row เดียว (per-step error log คงเดิม)

#### 2.2 Master Data Context Parity (Gap 5 resolved)

`processSandboxExtract`/`processSandboxAiExtract` ปัจจุบันใช้ `projectPublicId='default'` → ส่ง `undefined` ไป `aiPromptsService.resolveContext` → **skip master data lookup** (`ai-batch.processor.ts:552-557, 758-762`). ส่วน `processMigrateDocument` ส่ง `projectPublicId` + `contractPublicId` จริงเสมอ (`:973-978`).

→ `{{master_data_context}}` ใน prompt **ต่างกัน** แม้ params ถูกต้อง → Production Pipeline Sandbox **ไม่สมบูรณ์**

**แก้:**
- **Step 1 (OCR-only):** ไม่ต้องเลือก project — OCR เป็นแค่ text extraction ไม่ต้องใช้ master data context
- **Step 2 (AI Extraction):** ต้องเลือก `projectPublicId` (และ `contractPublicId` optional) — เพราะต้องส่ง master data context ให้ AI สกัด metadata
- `processSandboxExtract`/`processSandboxAiExtract` ส่ง ID จริงไป `resolveContext` เสมอ — ไม่มี special case `'default'` → `undefined`
- `aiPromptsService.resolveContext` จะคืนค่า empty context (`{}`) ถ้า project/contract ไม่มี master data (production-ready behavior)

#### 2.3 Apply Guardrails (Gap 6 resolved)

Apply to Production เป็น **critical config change** (กระทบงานทั้งระบบ) ต้องมี guardrails ตาม AGENTS.md:

| Guardrail | Requirement | Implementation |
|-----------|-------------|----------------|
| **Idempotency** | `POST /api/ai/profiles/:profileName/apply` ต้อง validate `Idempotency-Key` header (mandatory per AGENTS.md) | `@Header('Idempotency-Key')` + Redis เก็บ key ที่ใช้แล้ว 5 นาที |
| **CASL Permission** | API ใหม่ต้องมี CASL guard + 4-Level RBAC | `@UseGuards(CaslGuard)` + action `ai.apply_profile` (subject: `SystemSettings`) — ใช้ permission `system.manage_ai` (admin) |
| **Param Validation** | class-validator (backend) + Zod (frontend) | DTO `ApplyProfileDto` ใช้ `@IsNumber()`, `@Min(0)`, `@Max(1)` สำหรับ temperature/topP; `@IsOptional()` สำหรับ nullable |
| **Audit Trail** | Log ใคร apply, อะไร, old→new | `ai_audit_logs` table (มีอยู่แล้ว) — เพิ่ม row `action='APPLY_PROFILE'`, `userPublicId`, `profileName`, `oldValuesJson`, `newValuesJson`, `appliedAt` |
| **Range Guard** | Temperature/topP ต้อง 0–1 | Service layer validation: `if (temp < 0 \|\| temp > 1) throw BusinessException` |

#### 2.4 Entity & Service Canonical Model (Gap 7 resolved)

`AiExecutionProfileEntity` ปัจจุบันไม่มี mapping สำหรับ `canonical_model` column (ที่จะเพิ่มใน SQL delta); `getProfileParameters` (`:125`) hardcode `canonicalModel: 'np-dms-ai'` แทนการอ่านจาก column → ถ้า row `ocr-extract` (canonical_model='np-dms-ocr') ถูกอ่านผ่าน path เดิม จะได้ค่าผิด

**แก้:**
- Entity เพิ่ม `@Column({ name: 'canonical_model', length: 20 }) canonicalModel!: string;`
- `getProfileParameters` เปลี่ยนเป็นอ่าน `dbProfile.canonicalModel` จาก column แทน hardcode (หรือ default เป็น `'np-dms-ai'` ถ้า column null)
- สร้าง accessor ใหม่ `getModelDefaults(canonicalModel: 'np-dms-ai' | 'np-dms-ocr')` ที่ query ตาม `canonical_model` column โดยตรง (สำหรับ model-defaults row ไม่ผ่าน ExecutionProfile)

**API signature:**
```typescript
@Post(':profileName/apply')
@UseGuards(CaslGuard)
async applyProfile(
  @Param('profileName') profileName: string,
  @Body() dto: ApplyProfileDto, // optional: { reason?: string }
  @Headers('Idempotency-Key') idempotencyKey: string,
  @CurrentUser() user: RequestWithUser,
): Promise<ApplyResultDto>
```

### 3. Backend — API Endpoints

**File:** `backend/src/modules/ai/controllers/ai.controller.ts` (ADD)

เพิ่ม endpoints สำหรับการทดสอบและบันทึกค่า parameters:

- `GET /api/ai/sandbox-profiles/:profileName` — ดึง draft; **ถ้าไม่มี → seed จาก production row** แล้ว return
- `PUT /api/ai/sandbox-profiles/:profileName` — บันทึก draft ลง `ai_sandbox_profiles` (admin only)
- `POST /api/ai/sandbox-profiles/:profileName/reset` — reset draft = ค่า production row ปัจจุบัน
- `POST /api/ai/profiles/:profileName/apply` — **Apply to Production**: UPSERT draft → `ai_execution_profiles` + DEL cache (admin only, CASL-guarded)
- `GET /api/ai/profiles/:profileName` — ดึงค่า production defaults ปัจจุบัน (read-only panel)

systemPrompt apply → ใช้ endpoint ของ ADR-029 (`ai_prompts`) ที่มีอยู่ — **ไม่** สร้าง prompt endpoint ซ้ำ

**คงไว้:** API submit job ยังปฏิเสธ (400) ถ้า caller แนบ `executionProfile`/`model`/`temperature` (Profile-Only Parameter Governance)

### 4. Backend — Service Wiring (ไม่ consolidate/ลบ)

**Keep:** `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts` — ยังใช้รับ ephemeral OCR override (temperature/topP/repeatPenalty) ไป sidecar; ไม่ลบ

**Modify:** `backend/src/modules/ai/ai.module.ts`
- ไม่ลบ provider เดิม; AiPolicyService มีอยู่แล้ว

**Modify:** `backend/src/modules/ai/controllers/ai-sandbox.controller.ts`
- เพิ่ม apply endpoint ที่เรียก `AiPolicyService.applyProfile()` (CASL admin) — ไม่ inject service ใหม่

### 5. Sidecar — Dynamic Params (คง endpoint เดิม)

**File:** `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py` (MODIFY ถ้าจำเป็น)

sidecar รับ override อยู่แล้ว (`/ocr`, `/ocr-upload` → `temperature`/`top_p`/`repeat_penalty`/`keep_alive`) — ไม่ต้องสร้าง `/generate` ใหม่
- ถ้า np-dms-ai ต้องการ dynamic params เพิ่มเติม → ขยาย contract ของ endpoint ที่มี ไม่สร้างใหม่
- model lifecycle (unload/load) ตาม ADR-033 Adaptive OCR Residency **คงเดิม**

### 6. Frontend — Admin AI Console

**File:** `frontend/lib/services/admin-ai.service.ts` (ADD)

เพิ่ม functions สำหรับการทดสอบและบันทึกค่า parameters:
- `testModel(modelName, options)` — ทดสอบโมเดลด้วย parameters ที่กำหนด
- `saveModelDefaults(modelName, params)` — บันทึกค่า parameters ไปใช้ใน production
- `getModelDefaults(modelName)` — ดึงค่า parameters ปัจจุบันที่ใช้ใน production

**File:** `frontend/components/admin/ai/ModelTestingPanel.tsx` (NEW) หรือปรับ `OcrSandboxPromptManager.tsx`

สร้าง UI สำหรับทดสอบและบันทึกค่า parameters รองรับทั้งสองโมเดล:
- **Model Selector** — Dropdown เลือก `np-dms-ai` หรือ `np-dms-ocr`
- **Model Parameters** — Inputs สำหรับ temperature, topP, repeatPenalty
- **System Prompt** — Textarea สำหรับแก้ไข system prompt
- **Test Area** — พื้นที่ทดสอบ input และดูผลลัพธ์
- **Current Production Defaults** — Read-only panel แสดงค่าที่ใช้ใน production
- **Apply to Production** — Button สำหรับบันทึกค่าปัจจุบันไป production

### 7. Database — Extend ai_execution_profiles (ไม่ใช้ system_settings)

**Delta (ADR-009, edit SQL directly):** `specs/03-Data-and-Storage/deltas/2026-06-13-extend-ai-execution-profiles-ocr.sql`

```sql
-- ADR-036: ขยาย ai_execution_profiles → รองรับ np-dms-ocr (canonical_model) + OCR row
ALTER TABLE ai_execution_profiles
  ADD COLUMN canonical_model VARCHAR(20) NOT NULL DEFAULT 'np-dms-ai' AFTER profile_name;

-- OCR ไม่ใช้ num_ctx/max_tokens → ทำเป็น nullable
ALTER TABLE ai_execution_profiles MODIFY COLUMN num_ctx INT NULL;
ALTER TABLE ai_execution_profiles MODIFY COLUMN max_tokens INT NULL;

-- seed row OCR (params ตาม sidecar contract: temperature/top_p/repeat_penalty/keep_alive)
INSERT INTO ai_execution_profiles
  (profile_name, canonical_model, temperature, top_p, max_tokens, num_ctx, repeat_penalty, keep_alive_seconds, is_active)
VALUES
  ('ocr-extract', 'np-dms-ocr', 0.100, 0.100, NULL, NULL, 1.100, 0, 1)
ON DUPLICATE KEY UPDATE canonical_model = VALUES(canonical_model);

-- draft (sandbox) store — mirror columns ของ production; admin iterate ก่อน Apply
CREATE TABLE ai_sandbox_profiles (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  profile_name       VARCHAR(50)  NOT NULL UNIQUE,
  canonical_model    VARCHAR(20)  NOT NULL DEFAULT 'np-dms-ai',
  temperature        DECIMAL(4,3) NOT NULL,
  top_p              DECIMAL(4,3) NOT NULL,
  max_tokens         INT          NULL,
  num_ctx            INT          NULL,
  repeat_penalty     DECIMAL(5,3) NOT NULL,
  keep_alive_seconds INT          NOT NULL,
  updated_by         INT          NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**ไม่มี** INSERT ลง `system_settings` สำหรับ parameter — systemPrompt จัดการผ่าน `ai_prompts` (ADR-029)

---

## Migration Plan

### Phase 1: Backend Enhance (ไม่มี breaking change)

1. รัน delta `2026-06-13-extend-ai-execution-profiles-ocr.sql` — เพิ่ม `canonical_model` + row `ocr-extract`
2. แก้ `ai-execution-profile.entity.ts` — เพิ่ม `canonicalModel`, ทำ `numCtx`/`maxTokens` nullable
3. เติม `AiPolicyService.applyProfile()` — write + invalidate cache
4. แก้ `createJobPayload('ocr-extract')` — ดึงจาก row `ocr-extract` (snapshot คงเดิม)
5. เพิ่ม apply/test/get endpoints ใน controller (CASL admin)

### Phase 2: Sidecar (ถ้าจำเป็น)

1. คง `/ocr`, `/ocr-upload` ที่รับ override อยู่แล้ว — ขยาย contract เฉพาะถ้า np-dms-ai ต้องการ
2. model lifecycle ตาม ADR-033 คงเดิม

### Phase 3: Frontend Update

1. เพิ่ม API functions ใน `admin-ai.service.ts` — apply/test/get profile
2. ปรับ `OcrSandboxPromptManager.tsx` หรือเพิ่ม panel — รองรับ apply runtime params (np-dms-ai + ocr-extract)
3. systemPrompt ใช้ Prompt Version UI เดิม (ADR-029)

### Phase 4: Data

1. row `ocr-extract` seed ผ่าน delta (Phase 1); ค่า np-dms-ai profiles เดิมไม่ต้อง migrate
2. ถ้าไม่มี row/cache → fallback `AiPolicyService.defaultProfiles`

---

## Rollback Strategy

หากพบปัญหา:

1. **Immediate:** Revert commit — กลับไปใช้การเรียก Ollama โดยตรง (แต่จะสูญเสียความสามารถในการปรับ parameters แบบ dynamic)
2. **Sidecar:** Rollback `app.py` ไป version เดิมที่ไม่รองรับ dynamic parameters
3. **Database:** rollback delta — ลบ column `canonical_model` + row `ocr-extract` (rollback SQL คู่กัน); ค่า np-dms-ai profiles เดิมไม่กระทบ

---

## Impact on Related ADRs

| ADR | Section | Impact |
|-----|---------|--------|
| **ADR-034** | Model Stack | **ต้องแก้** — canonical names `np-dms-ai`/`np-dms-ocr` (runtime tag เป็น ops detail ใน Modelfile/ENV) |
| **ADR-033** | Adaptive OCR Residency | **คงเดิม** — ไม่แตะ residency/model lifecycle; ADR-036 เติมแค่ write/apply path |
| **ADR-032** | Typhoon OCR Integration | **คงเดิม** — sidecar contract เดิม (`/ocr`, `/ocr-upload`) |
| **ADR-029** | Dynamic Prompt Management | **คงเดิม** — systemPrompt apply ผ่าน `ai_prompts` (Active Prompt) ที่มีอยู่ |
| **Profile-Only Governance** | `AiPolicyService` + `ai_execution_profiles` | **enhance** — เติม write path, ไม่ supersede |

---

## Glossary Updates (CONTEXT.md)

บันทึกแล้วใน `CONTEXT.md` → **Glossary Updates (from ADR-036)** + **Flagged ambiguities**:

| Term | Definition |
|------|------------|
| **Apply to Production** | admin บันทึกค่าที่ทดสอบใน sandbox → runtime params ลง `ai_execution_profiles` (+invalidate Redis), systemPrompt ลง `ai_prompts`; มีผลกับงานใหม่เท่านั้น (snapshot) |
| **Sandbox Parameter Override** | ค่า ephemeral จาก testing ที่ไม่ persist จนกว่าจะกด Apply |
| **Tunable Production Defaults** | row ใน `ai_execution_profiles` (รวม `ocr-extract`) — ไม่ใช่ store แยกใน `system_settings` |

---

## Files to Modify

| File | Change Type |
|------|-------------|
| `backend/src/modules/ai/services/ai-policy.service.ts` | MODIFY (เพิ่ม `applyProfile()`) |
| `backend/src/modules/ai/entities/ai-execution-profile.entity.ts` | MODIFY (+`canonicalModel`, nullable numCtx/maxTokens) |
| `backend/src/modules/ai/entities/ai-sandbox-profile.entity.ts` | NEW (draft store) |
| `backend/src/modules/ai/interfaces/execution-policy.interface.ts` | MODIFY (+`ocrSnapshotParams?` ใน AiJobPayload — **ไม่** เพิ่ม `ocr-extract` ใน ExecutionProfile) |
| `backend/src/modules/ai/services/ocr.service.ts` | MODIFY (+`typhoonOptions` ใน OcrDetectionInput; processWithTyphoon ส่ง temp/topP/repeat) |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | MODIFY (createJobPayload OCR snapshot; processMigrateDocument ส่ง typhoonOptions; sandbox อ่าน draft) |
| `backend/src/modules/ai/controllers/ai.controller.ts` | MODIFY (apply/test/get endpoints, CASL admin, **Gap 6:** Idempotency-Key validation) |
| `backend/src/modules/ai/dto/apply-profile.dto.ts` | NEW (**Gap 6:** class-validator `@Min(0) @Max(1)` สำหรับ params) |
| `backend/src/modules/ai/dto/apply-result.dto.ts` | NEW (return applied profile + audit log id) |
| `backend/src/modules/ai/controllers/ai-sandbox.controller.ts` | MODIFY |
| `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts` | **KEEP** (ephemeral override) |
| `backend/src/modules/ai/services/ollama.service.ts` | MODIFY (ENV/Modelfile tag เท่านั้น — runtime detail) |
| `frontend/lib/services/admin-ai.service.ts` | MODIFY |
| `frontend/components/admin/ai/OcrSandboxPromptManager.tsx` | MODIFY (เพิ่ม apply runtime params; **Gap 5:** Step 1 (OCR) ไม่ต้องเลือก project; Step 2 (AI Extract) ต้องเลือก project/contract — ไม่อนุญาต 'default') |
| `specs/03-Data-and-Storage/deltas/2026-06-13-extend-ai-execution-profiles-ocr.sql` (+rollback) | NEW |
| `CONTEXT.md` | MODIFY (Glossary + Flagged ambiguities — **done**) |
| `specs/06-Decision-Records/ADR-034-AI-model-change.md` | MODIFY (canonical names) |
| `AGENTS.md` | MODIFY (canonical names) |

---

---

## Required Naming Alignment (Mandatory Before Implementation)

> **หมายเหตุ (grilling):** การเปลี่ยนชื่อในส่วนนี้คือการ sync **runtime tag** (Ollama model name บน Desk-5439 + ENV `OLLAMA_MODEL_MAIN`/`OLLAMA_MODEL_OCR`) ให้ตรงกับ **Canonical Model Identity** (`np-dms-ai`/`np-dms-ocr`) ตาม **Single-Name Canonical Model Policy** — ไม่ใช่การสร้าง canonical mapping ใหม่ เพราะ `AiPolicyService.getCanonicalModelName()` map tag → canonical อยู่แล้ว (รองรับทั้ง tag เก่า/ใหม่). Mock ใน test ที่ใช้ `typhoon2.5-np-dms:latest` เป็น runtime tag ของ `/api/ps` ไม่จำเป็นต้องแก้ (mapper รองรับอยู่).

ชื่อ model บน Desk-5439 (Ollama) ได้เปลี่ยนเป็น canonical names ใหม่แล้ว ต้องอัปเดต repository ให้สอดคล้อง:

### Model Names (New Canonical)

| Role | Old Name | New Name (Desk-5439) | Status |
|------|----------|----------------------|--------|
| Main AI | `typhoon2.5-np-dms:latest` | `np-dms-ai:latest` | **ต้องแก้** |
| OCR | `typhoon-np-dms-ocr:latest` | `np-dms-ocr:latest` | **ต้องแก้** |
| Embedding | `nomic-embed-text` | (ไม่เปลี่ยน) | OK |

### Files ที่ต้องแก้ไขชื่อ Model

#### Backend (Code)
| File | Line | แก้จาก | เป็น |
|------|------|--------|------|
| `backend/src/modules/ai/services/ollama.service.ts` | 58 | `'typhoon2.5-np-dms:latest'` | `'np-dms-ai:latest'` |
| `backend/src/modules/ai/services/ollama.service.ts` | 62 | `'typhoon-np-dms-ocr:latest'` | `'np-dms-ocr:latest'` |
| `backend/src/modules/ai/services/ocr.service.ts` | 86 | `engineName: 'typhoon-np-dms-ocr:latest'` | `engineName: 'np-dms-ocr:latest'` |
| `backend/src/modules/ai/services/ai-settings.service.ts` | (ค้นหา) | `typhoon2.5-np-dms` | `np-dms-ai` |
| `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` | 70 | `'typhoon2.5-np-dms:latest'` | `'np-dms-ai:latest'` |
| `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` | 70 | `'typhoon-np-dms-ocr:latest'` | `'np-dms-ocr:latest'` |

#### Frontend
| File | แก้จาก | เป็น |
|------|--------|------|
| `frontend/components/admin/ai/OcrSandboxPromptManager.tsx` | `typhoon-np-dms-ocr` | `np-dms-ocr` |
| `frontend/app/(admin)/admin/ai/page.tsx` | `typhoon2.5-np-dms` | `np-dms-ai` |

#### Sidecar (OCR)
| File | แก้จาก | เป็น |
|------|--------|------|
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py` | `typhoon-np-dms-ocr` | `np-dms-ocr` |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/docker-compose.yml` | `typhoon-np-dms-ocr` | `np-dms-ocr` |

#### Documentation
| File | แก้จาก | เป็น |
|------|--------|------|
| `specs/06-Decision-Records/ADR-034-AI-model-change.md` | `typhoon2.5-np-dms` | `np-dms-ai` |
| `specs/06-Decision-Records/ADR-034-AI-model-change.md` | `typhoon-np-dms-ocr` | `np-dms-ocr` |
| `AGENTS.md` | `typhoon2.5-np-dms` | `np-dms-ai` |
| `AGENTS.md` | `typhoon-np-dms-ocr` | `np-dms-ocr` |

### Migration Steps (Naming Alignment)

1. **Desk-5439:** สร้างโมเดลใหม่ (ถ้ายังไม่มี)
   ```bash
   # สร้างจาก Modelfile ที่มีอยู่
   ollama create np-dms-ai -f ./np-dms-ai.model.md
   ollama create np-dms-ocr -f ./np-dms-ocr.model.md

   # ลบโมเดลเก่า (optional — รอ deploy สำเร็จก่อน)
   ollama rm typhoon2.5-np-dms typhoon-np-dms-ocr
   ```

2. **Repository:** แก้ไขทุกไฟล์ที่ระบุในตารางด้านบน

3. **Deploy:** ทดสอบว่า API เรียกโมเดลใหม่ได้

4. **Cleanup:** ลบโมเดลเก่าบน Desk-5439 (หลัง verify สำเร็จ)

---

**สำหรับ Implementation:** ดูไฟล์ใน `specs/200-fullstacks/236-unified-ocr-architecture/` (สร้างเมื่อเริ่ม implement)
