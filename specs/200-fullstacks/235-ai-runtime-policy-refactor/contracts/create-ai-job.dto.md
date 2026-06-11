// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/contracts/create-ai-job.dto.md
// Change Log:
// - 2026-06-11: API contract for CreateAiJobDto

# Contract: POST /api/ai/jobs

## Request DTO

```typescript
interface CreateAiJobRequest {
  type: 'auto-fill-document' | 'migrate-document' | 'rag-query';
  documentPublicId?: string;     // UUIDv7 — ADR-019
  attachmentPublicId?: string;   // UUIDv7 — ADR-019
  executionProfile?: 'fast' | 'balanced' | 'thai-accurate' | 'large-context';
  // [FORBIDDEN] model.key — HTTP 400 if present
  // [FORBIDDEN] temperature, top_p, maxTokens — HTTP 400 if present
}
```

## Validation Rules

| Field | Rule |
|-------|------|
| `type` | Required; enum |
| `executionProfile` | Optional; enum; defaults to `balanced` |
| `large-context` | Requires admin role (CASL `ai.use_large_context`) — HTTP 403 if unauthorized |
| `model.*` | ANY model subfield → HTTP 400 |
| `temperature` | Present at root → HTTP 400 |
| `top_p` | Present at root → HTTP 400 |
| `maxTokens` | Present at root → HTTP 400 |

## Response DTO

```typescript
interface AiJobResponse {
  jobId: string;             // BullMQ job ID
  status: 'queued' | 'completed' | 'failed';
  modelUsed: 'np-dms-ai' | 'np-dms-ocr';   // Canonical name — never runtime tag
  executionProfile: ExecutionProfile;         // Effective profile (after backend override)
  queueName: 'ai-realtime' | 'ai-batch';
}
```

## Error Responses

| Status | When |
|--------|------|
| 400 | `model.key` present, or parameter overrides present, or invalid `executionProfile` |
| 403 | `large-context` by non-admin |
| 422 | `documentPublicId` not found |
| 504 | CPU fallback retrieval timeout |
