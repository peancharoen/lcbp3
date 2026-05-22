// File: specs/200-fullstacks/228-migration-arch-refactor/contracts/ai-jobs-api.md
// Change Log:
// - 2026-05-22: API contracts for migration AI jobs (POST /api/ai/jobs, GET /api/ai/jobs/:jobId)

# API Contract: AI Jobs (Migration)

## POST /api/ai/jobs

**Purpose**: Submit AI processing job — n8n ใช้สำหรับ Migration Phase  
**Auth**: Bearer token (migration_bot, TTL ≤ 7 วัน) | JWT (Admin/Superadmin)  
**Guard**: `JwtAuthGuard` + `CaslAbilityGuard` (action: `ai.submit_job`)

### Request

```http
POST /api/ai/jobs
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: <uuid>
```

```json
{
  "type": "migrate-document",
  "payload": {
    "tempAttachmentId": "019505a1-7c3e-7000-8000-abc123def456",
    "documentNumber": "LCP-GEN-COR-001-001",
    "title": "หนังสือแจ้งงาน โครงสร้าง Zone A",
    "existingTags": [
      { "publicId": "019...", "tagName": "Structural" }
    ],
    "systemCategories": ["Correspondence", "Drawing", "Report"],
    "batchId": "migration_20260522"
  }
}
```

### Response 202 Accepted

```json
{
  "data": {
    "jobId": "019505a1-7c3e-7000-8000-111222333444",
    "status": "queued",
    "estimatedWaitSeconds": 30,
    "pollUrl": "/api/ai/jobs/019505a1-7c3e-7000-8000-111222333444"
  }
}
```

### Response 409 Conflict (Idempotency)

```json
{
  "error": {
    "code": "JOB_ALREADY_EXISTS",
    "userMessage": "งานนี้ถูกส่งแล้ว",
    "existingJobId": "019505a1-..."
  }
}
```

### Response 422 Unprocessable

```json
{
  "error": {
    "code": "INVALID_JOB_TYPE",
    "userMessage": "ประเภทงานไม่ถูกต้อง"
  }
}
```

---

## GET /api/ai/jobs/:jobId

**Purpose**: Poll job status + retrieve result  
**Auth**: Bearer token (migration_bot) | JWT (Admin/Superadmin)

### Response 200 — Queued/Processing

```json
{
  "data": {
    "jobId": "019505a1-...",
    "status": "processing",
    "type": "migrate-document",
    "createdAt": "2026-05-22T06:01:00.000Z"
  }
}
```

### Response 200 — Completed

```json
{
  "data": {
    "jobId": "019505a1-...",
    "status": "completed",
    "type": "migrate-document",
    "result": {
      "isValid": true,
      "confidence": 0.92,
      "category": "Correspondence",
      "summary": "หนังสือแจ้งงานโครงสร้าง Zone A จากผู้รับเหมา...",
      "suggestedTags": [
        { "name": "Structural", "description": "งานโครงสร้าง", "isNew": false, "confidence": 0.95 },
        { "name": "Zone-A", "description": "Zone A พื้นที่", "isNew": true, "confidence": 0.88 }
      ],
      "detectedIssues": [],
      "ocrMethod": "fast-path",
      "processingTimeMs": 3200
    },
    "completedAt": "2026-05-22T06:01:35.000Z"
  }
}
```

### Response 200 — Failed

```json
{
  "data": {
    "jobId": "019505a1-...",
    "status": "failed",
    "error": {
      "code": "OCR_FAILED",
      "message": "ไม่สามารถอ่านไฟล์ PDF ได้"
    },
    "failedAt": "2026-05-22T06:01:45.000Z"
  }
}
```

### Response 404 Not Found

```json
{
  "error": {
    "code": "JOB_NOT_FOUND",
    "userMessage": "ไม่พบงานที่ระบุ"
  }
}
```

---

## POST /api/ai/migration/review

**Purpose**: Commit approved migration record to production  
**Auth**: JWT (DOCUMENT_CONTROLLER | ADMIN | SUPERADMIN)  
**Guard**: `JwtAuthGuard` + `CaslAbilityGuard` (action: `migration.commit`)

### Request

```http
POST /api/ai/migration/review
Authorization: Bearer <jwt>
Content-Type: application/json
Idempotency-Key: <uuid>
```

```json
{
  "reviewQueueId": 123,
  "action": "approve",
  "overrideTags": [
    { "tagName": "Structural", "isNew": false },
    { "tagName": "Zone-A", "isNew": true }
  ]
}
```

### Response 201 Created

```json
{
  "data": {
    "correspondencePublicId": "019505a1-...",
    "documentNumber": "LCP-GEN-COR-001-001",
    "tagsCreated": 1,
    "tagsLinked": 2,
    "importTransactionId": 456
  }
}
```
