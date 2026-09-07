# API Contracts: Metadata Patch

**Date**: 2026-09-06
**Branch**: `253-unified-doc-crud`

## Metadata Patch

### PATCH /correspondences/:uuid/metadata (NEW)
### PATCH /rfas/:uuid/metadata (NEW)
### PATCH /transmittals/:uuid/metadata (NEW)
### PATCH /drawings/:uuid/metadata (NEW)
### PATCH /circulations/:uuid/routing (NEW — Circulation uses "routing" not "metadata")

**Request:**
```http
PATCH /{module}/:uuid/metadata
Idempotency-Key: <uuid>
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "expectedVersion": 3,
  "fields": {
    "subject": "Updated Subject",
    "remarks": "Updated remarks",
    "tagIds": [1, 2, 3],
    "dueDate": "2026-12-31",
    "ccRecipientOrgIds": [5, 6]
  }
}
```

**Tier 2 Fields (Status-Dependent — DRAFT/IN_REVIEW only):**
```json
{
  "expectedVersion": 3,
  "fields": {
    "body": "Updated body content",
    "transmittalItemIds": [10, 11, 12],
    "drawingVolumeId": 3,
    "drawingCategoryId": 7
  }
}
```

**Tier 3 Fields (Superadmin Force-Edit only):**
```json
{
  "expectedVersion": 3,
  "forceEdit": true,
  "fields": {
    "documentNumber": "COR-2026-001-OVERRIDE",
    "originatorOrgId": 5,
    "projectPublicId": "019505a1-..."
  }
}
```

**Response 200 (Success with diff):**
```json
{
  "success": true,
  "publicId": "019505a1-...",
  "action": "METADATA_PATCH",
  "sideEffects": {
    "searchReindexed": true,
    "notificationsSent": 3,
    "workflowTerminated": false,
    "circulationsClosed": 0,
    "vectorsDeleted": "SKIPPED",
    "filesDeleted": 0
  },
  "failedSideEffects": [],
  "auditId": "019505a3-...",
  "diff": [
    { "field": "subject", "old": "Old Subject", "new": "Updated Subject" },
    { "field": "tagIds", "old": [1, 2], "new": [1, 2, 3] }
  ]
}
```

**Response 200 (No changes — no-op):**
```json
{
  "success": true,
  "publicId": "019505a1-...",
  "action": "METADATA_PATCH",
  "sideEffects": {
    "searchReindexed": false,
    "notificationsSent": 0,
    "workflowTerminated": false,
    "circulationsClosed": 0,
    "vectorsDeleted": "SKIPPED",
    "filesDeleted": 0
  },
  "failedSideEffects": [],
  "auditId": null,
  "message": "No changes detected"
}
```

**Response 422 (Tier 3 without forceEdit):**
```json
{
  "message": "Field not editable",
  "userMessage": "ฟิลด์นี้ไม่สามารถแก้ไขได้โดยไม่มีสิทธิ์ Superadmin Force-Edit",
  "recoveryAction": "ติดต่อ Superadmin หากจำเป็นต้องแก้ไข",
  "errorCode": "FIELD_NOT_EDITABLE"
}
```

**Response 422 (Document CANCELLED):**
```json
{
  "message": "Cannot patch cancelled document",
  "userMessage": "ไม่สามารถแก้ไขเอกสารที่ยกเลิกแล้ว",
  "errorCode": "DOCUMENT_CANCELLED"
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

## Field Tier Classification

| Tier | Fields | Permission | Status Restriction |
|------|--------|------------|-------------------|
| 1 (Always) | subject, remarks, dueDate, tagIds, ccRecipientOrgIds | `*.edit_metadata` | Not CANCELLED |
| 2 (Status-Dependent) | body, transmittalItemIds, circulationRoutingIds, drawingVolumeId, drawingCategoryId | `*.edit_metadata` | DRAFT or IN_REVIEW only |
| 3 (Never) | documentNumber, originatorOrgId, projectPublicId, type, primaryAttachments | `system.manage_all` + `forceEdit: true` | Any (Superadmin emergency) |
