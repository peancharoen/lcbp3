// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/contracts/create-ai-job.dto.md
// Change Log:
// - 2026-06-11: API contract for CreateAiJobDto
// - 2026-06-11: Option B — backend-determined policy; ลบ executionProfile ออกจาก request
// - 2026-06-11: Rename profiles — interactive/standard/quality/deep-analysis; เพิ่ม default values จาก docs/ai-profiles.md

# Contract: POST /api/ai/jobs

## Request DTO

```typescript
// PublicJobType — เปิดให้ caller ส่งมาใน API
type PublicJobType = 'auto-fill-document' | 'migrate-document' | 'rag-query';

// InternalJobType — ใช้ภายใน AiPolicyService เท่านั้น ไม่ expose ใน API
type InternalJobType = PublicJobType | 'intent-classify' | 'tool-suggest' | 'ocr-extract';

interface CreateAiJobRequest {
  type: PublicJobType;
  documentPublicId?: string;     // UUIDv7 — ADR-019
  attachmentPublicId?: string;   // UUIDv7 — ADR-019
  // [FORBIDDEN] executionProfile — HTTP 400 if present (backend กำหนดเอง)
  // [FORBIDDEN] model.key — HTTP 400 if present
  // [FORBIDDEN] temperature, top_p, maxTokens — HTTP 400 if present
}
```

> **หมายเหตุ**: ไม่มี `executionProfile` ใน request — backend กำหนด execution policy ทั้งหมดจาก `job.type` อัตโนมัติ user ทั่วไปไม่ต้องรู้จัก profile เลย
> `intent-classify`, `tool-suggest`, `ocr-extract` เป็น **internal job types** — เกิดภายใน service โดยตรง ไม่ผ่าน API

## Validation Rules

| Field | Rule |
|-------|------|
| `type` | Required; enum `'auto-fill-document' \| 'migrate-document' \| 'rag-query'` |
| `executionProfile` | **FORBIDDEN** — HTTP 400 ถ้ามีใน payload |
| `model.*` | **FORBIDDEN** — ANY model subfield → HTTP 400 |
| `temperature` | **FORBIDDEN** — HTTP 400 ถ้ามีใน payload |
| `top_p` | **FORBIDDEN** — HTTP 400 ถ้ามีใน payload |
| `maxTokens` | **FORBIDDEN** — HTTP 400 ถ้ามีใน payload |
| `documentPublicId` | Optional; UUIDv7 string (ADR-019) — ห้าม parseInt |
| `attachmentPublicId` | Optional; UUIDv7 string (ADR-019) — ห้าม parseInt |

## Job Type → Effective Profile Mapping (Backend Policy)

| `job.type` | `effectiveProfile` | `canonicalModel` | `queueName` |
|---|---|---|---|
| `auto-fill-document` | `quality` | `np-dms-ai` | `ai-batch` |
| `migrate-document` | `quality` | `np-dms-ai` | `ai-batch` |
| `rag-query` | `standard` | `np-dms-ai` | `ai-batch` |
| `intent-classify` | `interactive` | `np-dms-ai` | `ai-realtime` | *(internal only)* |
| `tool-suggest` | `interactive` | `np-dms-ai` | `ai-realtime` | *(internal only)* |
| `ocr-extract` | *(OCR residency policy)* | `np-dms-ocr` | `ai-batch` | *(internal only)* |
| `sandbox-analysis` | `deep-analysis` | `np-dms-ai` | `ai-batch` | *(admin OCR Sandbox only)* |

> Mapping นี้กำหนดใน `AiPolicyService` — ไม่ expose ให้ caller เห็น

## Profile Default Parameters (จาก `docs/ai-profiles.md`)

| Profile | `temperature` | `top_p` | `max_tokens` | `num_ctx` | `repeat_penalty` | `keep_alive` |
|---|---|---|---|---|---|---|
| `interactive` | 0.7 | 0.9 | 2048 | 4096 | 1.15 | `"5m"` |
| `standard` | 0.5 | 0.8 | 4096 | 8192 | 1.15 | `"10m"` |
| `quality` | 0.1 | 0.95 | 8192 | 8192 | 1.15 | `"10m"` |
| `deep-analysis` | 0.3 | 0.85 | 8192 | 32768 | 1.15 | `"0"` |

> ค่าเหล่านี้เป็น **default** — ops/admin calibrate ได้ผ่าน Admin Console และบันทึกใน DB ตาม ADR-029 (Dynamic Prompt Management)

## Response DTO

```typescript
type ExecutionProfile = 'interactive' | 'standard' | 'quality' | 'deep-analysis';

interface AiJobResponse {
  jobId: string;                              // BullMQ job ID
  status: 'queued' | 'completed' | 'failed';
  modelUsed: 'np-dms-ai' | 'np-dms-ocr';    // Canonical name — never runtime tag
  effectiveProfile: ExecutionProfile;         // Profile ที่ backend กำหนดจาก job.type
  queueName: 'ai-realtime' | 'ai-batch';
}
```

> `effectiveProfile` ใน response คือ **read-only informational field** สำหรับ admin/developer ดู — ไม่ใช่ input

## Error Responses

| Status | When |
|--------|------|
| 400 | `executionProfile`, `model.key`, หรือ parameter overrides มีใน payload |
| 422 | `documentPublicId` หรือ `attachmentPublicId` ไม่พบใน DB |
| 504 | CPU fallback retrieval timeout (`/embed` หรือ `/rerank`)
