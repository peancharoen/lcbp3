# API Contracts: Bulk Operations

**Date**: 2026-09-06
**Branch**: `253-unified-doc-crud`

## Bulk Cancel

### POST /correspondences/bulk-cancel (exists — enhance response)
### POST /rfas/bulk-cancel (NEW)
### POST /transmittals/bulk-cancel (NEW)
### POST /drawings/bulk-delete (NEW — soft-delete bulk)
### POST /circulations/bulk-force-close (NEW)

**Request:**
```http
POST /{module}/bulk-cancel
Idempotency-Key: <uuid>
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "publicIds": [
    "019505a1-...",
    "019505a2-...",
    "019505a3-..."
  ],
  "reason": "Bulk cancel reason",
  "maxItems": 100
}
```

**Response 202 (Accepted — async processing):**
```json
{
  "bulkId": "019505a4-7c3e-7000-8000-abc123def456",
  "jobId": "bulk-cancel-job-123",
  "status": "PROCESSING",
  "total": 3,
  "estimatedDurationSeconds": 15
}
```

**Poll Job Status:**
```http
GET /{module}/bulk-cancel/:jobId/status
Authorization: Bearer <jwt>
```

**Response 200 (In Progress):**
```json
{
  "bulkId": "019505a4-...",
  "jobId": "bulk-cancel-job-123",
  "status": "PROCESSING",
  "progress": {
    "total": 3,
    "processed": 2,
    "succeeded": 2,
    "failed": 0
  }
}
```

**Response 200 (Completed):**
```json
{
  "bulkId": "019505a4-...",
  "jobId": "bulk-cancel-job-123",
  "status": "COMPLETED",
  "result": {
    "total": 3,
    "succeeded": [
      { "publicId": "019505a1-...", "auditId": "019505a5-..." },
      { "publicId": "019505a2-...", "auditId": "019505a6-..." }
    ],
    "failed": [
      {
        "publicId": "019505a3-...",
        "reason": "Document already cancelled",
        "errorCode": "DOCUMENT_ALREADY_CANCELLED"
      }
    ]
  }
}
```

**Response 422 (Max items exceeded):**
```json
{
  "message": "Max 100 items per bulk operation",
  "userMessage": "เลือกได้สูงสุด 100 รายการต่อการดำเนินการเป็นชุด",
  "errorCode": "BULK_MAX_EXCEEDED"
}
```

**Response 422 (Ineligible items):**
```json
{
  "message": "Some items are not eligible",
  "userMessage": "เลือกได้เฉพาะเอกสารที่ยังไม่ถูกยกเลิก",
  "ineligibleItems": [
    { "publicId": "019505a3-...", "reason": "Already CANCELLED" }
  ],
  "errorCode": "BULK_INELIGIBLE_ITEMS"
}
```

## Bulk Tag

### POST /documents/bulk-tag (NEW — cross-type via document.bulk_tag permission)

**Request:**
```http
POST /documents/bulk-tag
Idempotency-Key: <uuid>
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "items": [
    { "documentType": "correspondence", "publicId": "019505a1-..." },
    { "documentType": "correspondence", "publicId": "019505a2-..." }
  ],
  "tagIds": [1, 2, 3],
  "mode": "ADD"
}
```

**Response 202 + Poll pattern same as Bulk Cancel.**

## Bulk Export

### POST /documents/bulk-export (NEW — metadata only, no file attachments)

**Request:**
```http
POST /documents/bulk-export
Idempotency-Key: <uuid>
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "items": [
    { "documentType": "correspondence", "publicId": "019505a1-..." }
  ],
  "format": "CSV",
  "fields": ["documentNumber", "subject", "status", "createdAt", "originator"]
}
```

**Response 202 + Poll pattern. Final result returns download URL.**

**CSV Schema for Bulk Export (metadata only):**

Headers (configurable via `fields` array, default all):
- `documentNumber` (string)
- `documentType` (string)
- `subject` (string)
- `status` (string)
- `createdAt` (ISO 8601)
- `originator` (organization name)
- `project` (project name)
- `tags` (comma-separated)
- `remarks` (string)
- `dueDate` (ISO 8601, nullable)

**Response 200 (Completed):**
```json
{
  "bulkId": "019505a4-...",
  "status": "COMPLETED",
  "downloadUrl": "/api/exports/019505a4-...",
  "expiresAt": "2026-09-06T23:00:00Z",
  "recordCount": 50
}
```
