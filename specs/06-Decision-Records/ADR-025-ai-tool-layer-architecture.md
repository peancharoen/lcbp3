# ADR-025: AI Tool Layer Architecture

**Status:** Accepted
**Date:** 2026-05-19
**Decision Makers:** Development Team, System Architect, AI Integration Lead
**Related Documents:**
- [ADR-024: Intent Classification Strategy](./ADR-024-intent-classification-strategy.md)
- [ADR-023A: Unified AI Architecture — Model Revision](./ADR-023A-unified-ai-architecture.md)
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md)
- [ADR-007: Error Handling Strategy](./ADR-007-error-handling-strategy.md)
- [ADR-016: Security & Authentication](./ADR-016-security-authentication.md)
- [CONTEXT.md](../../CONTEXT.md)

> **หมายเหตุ:** ADR นี้กำหนดสถาปัตยกรรมของ AI Tool Layer — bridge ระหว่าง AI Gateway (ADR-023A) กับ business modules (RFA, Drawing, Transmittal ฯลฯ) หลังจาก Intent Classifier (ADR-024) คืน Server-side Intent แล้ว

---

## Context and Problem Statement

เมื่อ Intent Classifier (ADR-024) คืน Server-side Intent เช่น `GET_RFA`, `GET_DRAWING` แล้ว ระบบต้องการ layer ที่:

1. **Map Intent → business service call** ภายใต้ CASL authorization
2. **คืน response ที่ LLM ใช้ได้** โดยไม่ expose INT primary key (ADR-019)
3. **Handle error อย่างมีโครงสร้าง** เพื่อ AI Gateway ตัดสินใจ graceful degrade ได้
4. **Extensible** — เพิ่ม tool ใหม่โดยไม่กระทบ Gateway logic

ความท้าทาย:
- Business services มี CASL guard ที่ controller layer — Tool Layer ต้อง enforce permission เองโดยไม่ bypass
- LLM prompt token budget จำกัด — ห้ามส่ง raw entity ที่มี field ไม่จำเป็น
- Tool call อาจ fail ด้วยเหตุผลต่างกัน (permission, not found, service error) — Gateway ต้องรู้ reason เพื่อ route ถูก

---

## Decision Drivers

- **CASL enforcement ต้องครบทุก tool call** — ห้ามมี unguarded path เข้า business data
- **ADR-019 compliance** — ห้าม expose INT `id` ใน LLM context
- **Predictable error handling** — ADR-007 layered classification
- **Type safety** — TypeScript strict, ไม่มี `any`
- **Testability** — แต่ละ tool test แยกได้โดยไม่ต้องมี full Gateway

---

## Considered Options

### Option 1: LLM Function Calling (LLM เรียก tool เอง)

ให้ LLM ตัดสินใจว่าจะเรียก tool ไหน ผ่าน function calling protocol

**Cons:**
- ❌ CASL enforcement เกิดที่ LLM runtime — ไม่ controllable
- ❌ gemma4:e4b Q8_0 ไม่รองรับ function calling อย่างน่าเชื่อถือ
- ❌ Non-deterministic — LLM อาจเรียกผิด tool

### Option 2: AI Gateway เรียก Tool Layer ตรง (Server-side dispatch) ✅ (เลือก)

Intent Classifier คืน Intent → AI Gateway map กับ static registry → เรียก tool โดยตรง → inject result ใน LLM prompt

**Pros:**
- ✅ CASL check อยู่ใน server code ทั้งหมด
- ✅ Deterministic — Intent enum map กับ tool function แบบ 1:1
- ✅ Testable, type-safe

---

## Decision

**เลือก Option 2: Server-side dispatch ผ่าน Static Tool Registry**

---

## Architecture Overview

```
User Query
    │
    ▼
Intent Classifier (ADR-024)
    │ returns { intent, confidence, params }
    ▼
AI Gateway
    │
    ├─ lookup AiToolRegistryService.getHandler(intent)
    │
    ▼
AiToolRegistryService (Static Map)
    │ TOOL_REGISTRY[intent] → tool function
    ▼
Tool Function (e.g. RfaToolService.getRfa)
    │ receives (params, requestUser: RequestUser)
    │ enforce CASL internally
    │ call business service
    │ map entity → *ToolResult DTO
    ▼
ToolCallResult<T>
    { ok: true, data: T }
  | { ok: false, reason, message }
    │
    ▼
AI Gateway
    │ ok=true  → inject data ใน LLM prompt → Ollama → response
    │ ok=false → handle by reason (log, fallback, error message)
    ▼
User Response
```

---

## Tool Registry

### Static Map

```typescript
// File: backend/src/modules/ai/tool/ai-tool-registry.service.ts

type ToolHandler = (
  params: Record<string, unknown>,
  user: RequestUser,
) => Promise<ToolCallResult<unknown>>;

const TOOL_REGISTRY: Partial<Record<ServerIntent, ToolHandler>> = {
  [ServerIntent.GET_RFA]:           (p, u) => rfaToolService.getRfa(p, u),
  [ServerIntent.GET_DRAWING]:       (p, u) => drawingToolService.getDrawing(p, u),
  [ServerIntent.GET_TRANSMITTAL]:   (p, u) => transmittalToolService.getTransmittal(p, u),
  [ServerIntent.GET_CORRESPONDENCE]:(p, u) => correspondenceToolService.getCorrespondence(p, u),
  [ServerIntent.GET_CIRCULATION]:   (p, u) => circulationToolService.getCirculation(p, u),
  [ServerIntent.GET_RFA_DRAWINGS]:  (p, u) => rfaToolService.getRfaDrawings(p, u),
  [ServerIntent.SUMMARIZE_DOCUMENT]:(p, u) => documentToolService.summarize(p, u),
  [ServerIntent.LIST_OVERDUE]:      (p, u) => documentToolService.listOverdue(p, u),
};
```

Intent ที่ไม่มีใน registry (เช่น `RAG_QUERY`, `SUGGEST_*`, `FALLBACK`) → AI Gateway route ไปยัง pipeline อื่น (RAG หรือ error) โดยไม่ผ่าน Tool Layer

---

## CASL Enforcement Pattern

แต่ละ tool รับ `RequestUser` และ check permission ก่อน query:

```typescript
// File: backend/src/modules/ai/tool/rfa-tool.service.ts

async getRfa(
  params: GetRfaToolParams,
  user: RequestUser,
): Promise<ToolCallResult<RfaToolResult[]>> {
  // 1. CASL check
  const ability = this.caslFactory.createForUser(user);
  if (ability.cannot('read', 'Rfa')) {
    return { ok: false, reason: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึง RFA' };
  }

  // 2. projectPublicId scope (ADR-019, ADR-023A)
  if (!params.projectPublicId) {
    return { ok: false, reason: 'INVALID_PARAMS', message: 'ต้องระบุ projectPublicId' };
  }

  // 3. query business service
  try {
    const rfas = await this.rfaService.findByTool(params, user);
    return { ok: true, data: rfas.map(toRfaToolResult) };
  } catch (err) {
    this.logger.error('RfaToolService.getRfa failed', err);
    return { ok: false, reason: 'SERVICE_ERROR', message: 'เกิดข้อผิดพลาดในการดึงข้อมูล RFA' };
  }
}
```

---

## ToolCallResult Type

```typescript
// File: backend/src/modules/ai/tool/types/tool-call-result.type.ts

export type ToolCallReason = 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_PARAMS' | 'SERVICE_ERROR';

export type ToolCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ToolCallReason; message: string };
```

---

## LLM-Friendly ToolResult DTOs

Tool คืน `*ToolResult` DTO แทน raw entity — มีเฉพาะ fields ที่ LLM ต้องการ ไม่มี INT `id`:

```typescript
// File: backend/src/modules/ai/tool/types/rfa-tool-result.type.ts

export interface RfaToolResult {
  publicId: string;
  rfaNumber: string;
  revisionCode: string;
  statusCode: string;       // business code: "1A", "1B", "PENDING" ฯลฯ
  drawingCount: number;
  submittedAt: string | null; // ISO string
  respondedAt: string | null;
  contractPublicId: string;
}

// File: backend/src/modules/ai/tool/types/drawing-tool-result.type.ts

export interface DrawingToolResult {
  publicId: string;
  drawingCode: string;
  drawingTitle: string;
  discipline: string;
  currentRevision: string;
  latestRfaPublicId: string | null;
  latestRfaStatus: string | null;
  contractPublicId: string;
}
```

**กฎ:**
- ❌ ห้ามมี `id: number` ในทุก ToolResult type
- ❌ ห้ามมี TypeORM entity relation objects
- ✅ ใช้ `publicId` + business codes เท่านั้น
- ✅ Date fields เป็น ISO string (ไม่ใช่ Date object)

---

## LLM Prompt Integration (v1)

v1 ใช้ Tool result inject ใน prompt ตรง — ไม่ผสม RAG chunks (Phase 4):

```
[System]
คุณเป็น AI ผู้ช่วยระบบจัดการเอกสารก่อสร้าง NAP-DMS
ตอบโดยใช้ข้อมูลใน Context เท่านั้น ห้ามคาดเดา

[Context — Tool Result]
{{TOOL_RESULT_JSON}}

[User]
{{USER_QUERY}}
```

- `{{TOOL_RESULT_JSON}}` = `JSON.stringify(toolResult.data)` (compact, ไม่มี indent)
- Token budget สำหรับ tool result: สูงสุด **500 tokens**
- ถ้าผล tool เกิน 500 tokens → truncate ด้วย `slice(0, N)` + append `"... (แสดงผลบางส่วน)"`

---

## Error Handling by Reason

AI Gateway handle `ok=false` ตาม reason:

| reason | action |
|--------|--------|
| `FORBIDDEN` | คืน error message ให้ user + บันทึก audit log (security event) |
| `NOT_FOUND` | คืน "ไม่พบข้อมูล" + แนะนำให้ตรวจสอบ parameter |
| `INVALID_PARAMS` | คืน error พร้อมบอก field ที่ขาด |
| `SERVICE_ERROR` | log error + คืน "ขณะนี้ระบบไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่" |

---

## Module Structure

```
backend/src/modules/ai/
├── tool/
│   ├── ai-tool-registry.service.ts   ← static map + dispatch
│   ├── rfa-tool.service.ts
│   ├── drawing-tool.service.ts
│   ├── transmittal-tool.service.ts
│   ├── correspondence-tool.service.ts
│   ├── circulation-tool.service.ts
│   ├── document-tool.service.ts
│   └── types/
│       ├── tool-call-result.type.ts
│       ├── rfa-tool-result.type.ts
│       ├── drawing-tool-result.type.ts
│       └── ...
```

---

## Audit & Observability

ทุก tool call บันทึกใน `ai_audit_logs`:

```json
{
  "action": "tool_call",
  "intent": "GET_RFA",
  "params": { "projectPublicId": "...", "limit": 5 },
  "result": "ok" | "forbidden" | "not_found" | "service_error",
  "latencyMs": 45,
  "projectPublicId": "...",
  "userPublicId": "..."
}
```

---

## Consequences

### Positive
- CASL enforcement อยู่ใน server code ทั้งหมด — ไม่มี unguarded path
- ADR-019 compliance — INT id ไม่เคยปรากฏใน LLM context
- Static registry อ่านง่าย, type-safe, test แยก tool ได้
- Result wrapper ทำให้ Gateway handle error ได้อย่างมีโครงสร้าง

### Negative
- Tool ใหม่ต้องเพิ่ม entry ใน static registry (code deploy) — ต่างจาก Intent Pattern ที่ admin แก้ได้ runtime
- `*ToolResult` DTO เพิ่ม maintenance surface (แต่ต้องมีเพื่อ ADR-019)

### Risks
- Tool result เกิน token budget → truncation อาจทำให้ LLM ตอบไม่ครบ → mitigate ด้วย pagination parameter ใน tool params (limit default = 5)
- CASL factory ใน tool service อาจ duplicate กับ controller layer → mitigate ด้วย shared `CaslAbilityFactory` injection

---

## Out of Scope (Phase 4)

- **Hybrid RAG + Tool** — ผสม RAG chunks กับ tool result ใน prompt เดียว (CONTEXT.md Phase 4)
- **Streaming tool response** — v1 คืนครั้งเดียว
- **Tool chaining** — tool เรียก tool อื่น (ไม่รองรับ v1)

---

## Migration Notes (ADR-009)

- ไม่มี schema เพิ่มใน ADR-025 — ใช้ตาราง `ai_audit_logs` ที่มีอยู่แล้ว
- สร้าง NestJS module `AiToolModule` แยกจาก `AiModule` หลัก และ import เข้า `AiModule`
