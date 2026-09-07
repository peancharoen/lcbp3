# API Contracts: Cancel & Hard-Delete

**Date**: 2026-09-06
**Branch**: `253-unified-doc-crud`

## Unified Response Shape

All document actions return this shape (Response Superset — backward compatible):

```typescript
interface DocumentActionResponse {
  success: boolean;
  publicId: string;
  action: 'CANCEL' | 'HARD_DELETE' | 'METADATA_PATCH';
  sideEffects: {
    searchReindexed: boolean;
    notificationsSent: number;
    workflowTerminated: boolean;
    circulationsClosed: number;
    vectorsDeleted: 'COMPLETED' | 'PENDING_RETRY' | 'SKIPPED';
    filesDeleted: number;
  };
  failedSideEffects: string[];
  auditId: string;
  // Existing fields preserved for backward compatibility
  [key: string]: unknown;
}
```

## Cancel / Soft-Cancel

### POST /correspondences/:uuid/cancel (exists — enhance response)
### POST /rfas/:uuid/cancel (NEW)
### POST /transmittals/:uuid/cancel (NEW)
### POST /drawings/:uuid/cancel (NEW — soft-delete)
### POST /circulations/:uuid/force-close (exists — enhance response)

**Request:**
```http
POST /{module}/:uuid/cancel
Idempotency-Key: <uuid>
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "reason": "Required cancel reason",
  "expectedVersion": 3
}
```

**Response 200:**
```json
{
  "success": true,
  "publicId": "019505a1-...",
  "action": "CANCEL",
  "sideEffects": {
    "searchReindexed": true,
    "notificationsSent": 5,
    "workflowTerminated": true,
    "circulationsClosed": 2,
    "vectorsDeleted": "SKIPPED",
    "filesDeleted": 0
  },
  "failedSideEffects": [],
  "auditId": "019505a3-..."
}
```

**Response 422 (Status Guard — already cancelled):**
```json
{
  "message": "Document already cancelled",
  "userMessage": "เอกสารนี้ถูกยกเลิกแล้ว ไม่สามารถยกเลิกซ้ำได้",
  "recoveryAction": "รีเฟรชหน้านี้",
  "errorCode": "DOCUMENT_ALREADY_CANCELLED"
}
```

**Response 422 (Optimistic Lock):**
```json
{
  "message": "Version mismatch",
  "userMessage": "เอกสารถูกแก้โดยผู้ใช้อื่น กรุณารีเฟรชหน้านี้",
  "recoveryAction": "รีเฟรชหน้านี้",
  "errorCode": "VERSION_CONFLICT"
}
```

**Response 403 (Permission):**
```json
{
  "message": "Permission denied",
  "userMessage": "คุณไม่มีสิทธิ์ยกเลิกเอกสารนี้ — ติดต่อผู้ดูแลระบบ",
  "recoveryAction": "ติดต่อผู้ดูแลระบบ",
  "errorCode": "PERMISSION_DENIED"
}
```

## Hard-Delete

### DELETE /correspondences/:uuid (exists — enhance response + fix permission)
### DELETE /rfas/:uuid (NEW)
### DELETE /transmittals/:uuid (NEW)
### DELETE /drawings/:uuid (NEW — permanent purge)
### DELETE /circulations/:uuid — NOT AVAILABLE (use Force Close)

**Request:**
```http
DELETE /{module}/:uuid
Idempotency-Key: <uuid>
Authorization: Bearer <jwt>
X-Confirm-Delete: true
```

**Response 200:**
```json
{
  "success": true,
  "publicId": "019505a1-...",
  "action": "HARD_DELETE",
  "sideEffects": {
    "searchReindexed": true,
    "notificationsSent": 1,
    "workflowTerminated": true,
    "circulationsClosed": 0,
    "vectorsDeleted": "COMPLETED",
    "filesDeleted": 3
  },
  "failedSideEffects": [],
  "auditId": "019505a3-...",
  "snapshot": {
    "documentNumber": "COR-2026-001",
    "status": "IN_REVIEW",
    "attachmentCount": 3,
    "vectorCount": 2
  }
}
```

**Response 200 (Vector deletion pending retry):**
```json
{
  "success": true,
  "publicId": "019505a1-...",
  "action": "HARD_DELETE",
  "sideEffects": {
    "vectorsDeleted": "PENDING_RETRY",
    "filesDeleted": 3
  },
  "failedSideEffects": ["vectorDeletion"],
  "auditId": "019505a3-..."
}
```

**Response 403 (Not Superadmin):**
```json
{
  "message": "Hard-Delete requires Superadmin",
  "userMessage": "การลบถาวรต้องการสิทธิ์ Superadmin — ติดต่อผู้ดูแลระบบ",
  "errorCode": "REQUIRES_SUPERADMIN"
}
```

## Permission Matrix

| Action | Correspondence | RFA | Transmittal | Drawing | Circulation |
|--------|---------------|-----|-------------|---------|-------------|
| Cancel | `correspondence.cancel` | `rfa.cancel` | `transmittal.cancel` | `drawing.delete` | `circulation.close` |
| Hard-Delete | `correspondence.delete` + `system.manage_all` fallback | `rfa.delete` + fallback | `transmittal.delete` + fallback | `drawing.delete` + fallback | N/A (Force Close) |
| Metadata Patch | `correspondence.edit_metadata` | `rfa.edit_metadata` | `transmittal.edit_metadata` | `drawing.edit_metadata` | `circulation.edit_routing` |
