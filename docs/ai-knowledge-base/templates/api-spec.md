// File: docs/ai-knowledge-base/templates/api-spec.md
# API Specification: [Endpoint Name]

## 📋 Metadata
- **Version**: v1
- **Module**: [e.g. RFA]
- **Protocol**: REST (JSON)
- **Status**: Draft / Proposed

## 🚀 Endpoint
`METHOD /v1/[path]`

## 🛡️ Authentication & Authorization
- **Auth Required**: Yes/No
- **Roles**: [Admin, Consultant, etc.]
- **CASL Action**: `Action.Create / Action.Read / ...`

## 📥 Request Parameters
### Headers
- `Idempotency-Key`: UUID (Required for Write actions)
- `Authorization`: Bearer [token]

### Body (JSON)
| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | String | Yes | Name of entity |

## 📤 Response (JSON)
### Success (200/201)
```json
{
  "publicId": "...",
  "status": "success",
  "data": { ... }
}
```

### Error (400/401/403/500)
- ปฏิบัติตาม ADR-007

---
// Change Log:
// - 2026-05-14: Initial API spec template
