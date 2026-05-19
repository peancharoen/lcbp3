# Intent Classification API Playbook

## Overview

ระบบ Intent Classification ใช้ Hybrid Strategy: Pattern Matching (keyword/regex) → LLM Fallback (Ollama) → FALLBACK intent

## API Endpoints

### Classification

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/ai/intent/classify` | JWT | 30/min | จำแนก Intent จาก query |

**Request:**
```json
{
  "query": "สรุปเอกสารนี้ให้หน่อย",
  "projectPublicId": "019505a1-...",
  "userPublicId": "019505a1-...",
  "currentDocumentId": "019505a1-..."
}
```

**Response:**
```json
{
  "intentCode": "SUMMARIZE_DOCUMENT",
  "confidence": 1.0,
  "method": "pattern",
  "latencyMs": 3
}
```

### Admin — Intent Definitions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/ai/intent-definitions` | JWT + RBAC | รายการ Intent Definitions |
| GET | `/admin/ai/intent-definitions/:intentCode` | JWT + RBAC | Intent ตาม code |
| POST | `/admin/ai/intent-definitions` | JWT + RBAC | สร้าง Intent ใหม่ |
| PATCH | `/admin/ai/intent-definitions/:intentCode` | JWT + RBAC | อัปเดต Intent |

**Query Parameters (GET all):**
- `category`: `read` | `suggest` | `utility`
- `isActive`: `true` | `false`

### Admin — Intent Patterns

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/ai/intent-definitions/:code/patterns` | JWT + RBAC | Patterns ของ Intent |
| POST | `/admin/ai/intent-definitions/:code/patterns` | JWT + RBAC | สร้าง Pattern |
| GET | `/admin/ai/intent-patterns/:publicId` | JWT + RBAC | Pattern ตาม UUID |
| PATCH | `/admin/ai/intent-patterns/:publicId` | JWT + RBAC | อัปเดต Pattern |
| DELETE | `/admin/ai/intent-patterns/:publicId` | JWT + RBAC | Soft delete |

---

## Classification Methods

| Method | Description | Confidence | Latency |
|--------|-------------|------------|---------|
| `pattern` | Keyword/regex match | 1.0 | < 10ms |
| `llm_fallback` | Ollama LLM classification | 0.4-1.0 | < 2000ms |
| `semaphore_overflow` | LLM queue full | 0 | < 10ms |
| `llm_error` | LLM unavailable/timeout | 0 | < 5000ms |

---

## 12 Standard Intents (v1)

| Intent Code | Category | Description (TH) |
|-------------|----------|-------------------|
| RAG_QUERY | read | ถามคำถามธรรมชาติ ตอบจาก vector + doc context |
| GET_RFA | read | ดึง RFA ตาม filter |
| GET_DRAWING | read | ดึง Drawing revision |
| GET_TRANSMITTAL | read | ดึง Transmittal |
| GET_CORRESPONDENCE | read | ดึง Correspondence ทั่วไป |
| GET_CIRCULATION | read | ดึง Circulation |
| GET_RFA_DRAWINGS | read | ดึง Drawings ที่ผูกกับ RFA |
| SUMMARIZE_DOCUMENT | read | สรุปเอกสารที่เปิดอยู่ |
| LIST_OVERDUE | read | รายการ cross-entity ที่เกินกำหนด |
| SUGGEST_METADATA | suggest | แนะนำ metadata สำหรับเอกสาร |
| SUGGEST_ACTION | suggest | แจ้งเตือนว่าควรทำอะไรต่อ |
| FALLBACK | utility | ไม่เข้า intent ไหน / ไม่เกี่ยวกับระบบ |

---

## Cache Strategy

- **Key**: `ai:intent:patterns:active`
- **TTL**: 300 seconds
- **Invalidation**: Auto on admin CRUD (create/update/delete pattern)
- **Fallback**: DB query if Redis unavailable

---

## Semaphore (LLM Concurrency Control)

- **Max concurrent**: 3 (configurable via `INTENT_LLM_MAX_CONCURRENT`)
- **Behavior on full**: Return `FALLBACK` with method `semaphore_overflow`
- **Pattern**: Promise-based queue with idempotent release

---

## Configuration (Environment Variables)

```env
# Ollama
OLLAMA_BASE_URL=http://192.168.10.5:11434
OLLAMA_MODEL=gemma4:e4b

# Intent Classification
INTENT_LLM_MAX_CONCURRENT=3
INTENT_LLM_TIMEOUT_MS=5000
INTENT_CACHE_TTL_SECONDS=300
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| All queries return FALLBACK | Redis empty + LLM down | Check Redis + Ollama status |
| High latency (> 2s) | LLM overloaded | Increase semaphore or add patterns |
| Pattern not matching | Cache stale | Wait TTL (5min) or restart |
| 429 Too Many Requests | Rate limit exceeded | Wait 60s or reduce frequency |

---

## Related

- ADR-024: Intent Classification Strategy
- ADR-023A: Unified AI Architecture (Model Revision)
- Feature spec: `specs/200-fullstacks/224-intent-classification/spec.md`
