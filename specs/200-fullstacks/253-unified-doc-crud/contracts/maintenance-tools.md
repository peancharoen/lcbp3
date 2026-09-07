# API Contracts: Maintenance Tools

**Date**: 2026-09-06
**Branch**: `253-unified-doc-crud`

## Maintenance Console Endpoints

Base path: `/api/maintenance`

All endpoints require:
- `Authorization: Bearer <jwt>`
- `Idempotency-Key` header
- Specific maintenance permission per tab

## Tab 1: Numbering Tools

**Permission**: `system.numbering_override`

### GET /maintenance/numbering/gaps

Audit sequence gaps in document numbering.

**Response 200:**
```json
{
  "gaps": [
    {
      "prefix": "COR",
      "year": 2026,
      "missingNumbers": [5, 8, 12],
      "lastIssued": 15,
      "nextAvailable": 16
    }
  ]
}
```

### POST /maintenance/numbering/override

Manually override a document number (Void & Replace).

**Request:**
```json
{
  "publicId": "019505a1-...",
  "newNumber": "COR-2026-016",
  "reason": "Sequence correction after gap audit"
}
```

**Response 200:**
```json
{
  "success": true,
  "publicId": "019505a1-...",
  "oldNumber": "COR-2026-005",
  "newNumber": "COR-2026-016",
  "auditId": "019505a3-..."
}
```

### POST /maintenance/numbering/sync-counter

Sync Redis counter with DB max value.

**Request:**
```json
{
  "prefix": "COR",
  "year": 2026
}
```

## Tab 2: Orphan Cleanup

**Permission**: `system.orphan_cleanup`

### POST /maintenance/orphan-cleanup/scan

Scan storage for orphan files (no document reference).

**Response 200:**
```json
{
  "scanId": "019505a4-...",
  "orphanFiles": [
    {
      "filePath": "/storage/2026/09/orphan-1.pdf",
      "sizeBytes": 1048576,
      "lastModified": "2026-08-15T10:00:00Z"
    }
  ],
  "totalSizeBytes": 52428800,
  "fileCount": 12
}
```

### POST /maintenance/orphan-cleanup/purge

Delete orphan files identified by scan.

**Request:**
```json
{
  "scanId": "019505a4-...",
  "confirmPurge": true
}
```

**Response 200:**
```json
{
  "success": true,
  "deletedCount": 12,
  "freedBytes": 52428800,
  "auditId": "019505a5-..."
}
```

## Tab 3: Vector Sync

**Permission**: `system.vector_sync`

### GET /maintenance/vector-sync/missing

Find documents missing from Qdrant (have content but no vector).

**Response 200:**
```json
{
  "missingDocuments": [
    {
      "documentType": "correspondence",
      "publicId": "019505a1-...",
      "documentNumber": "COR-2026-001",
      "hasAttachment": true,
      "lastModified": "2026-08-15T10:00:00Z"
    }
  ],
  "totalMissing": 5
}
```

### POST /maintenance/vector-sync/re-embed

Batch re-embed missing documents via BullMQ ai-batch queue.

**Request:**
```json
{
  "publicIds": ["019505a1-...", "019505a2-..."],
  "priority": "NORMAL"
}
```

**Response 202:**
```json
{
  "jobId": "vector-sync-job-456",
  "totalQueued": 5,
  "estimatedDurationMinutes": 10
}
```

### POST /maintenance/vector-sync/orphan-scan

Trigger Qdrant orphan scan (vectors without DB document).

**Response 200:**
```json
{
  "scanned": 1500,
  "orphansDeleted": 3,
  "auditId": "019505a5-..."
}
```

## Tab 4: Emergency Unlock

**Permission**: `system.emergency_unlock`

### GET /maintenance/emergency/locked-documents

Find documents with stuck locks or stuck workflow instances.

**Response 200:**
```json
{
  "lockedDocuments": [
    {
      "publicId": "019505a1-...",
      "documentNumber": "COR-2026-001",
      "lockType": "REDIS_REDLOCK",
      "lockedAt": "2026-09-05T14:00:00Z",
      "lockedBy": "user-123",
      "durationMinutes": 1440
    }
  ],
  "stuckWorkflows": [
    {
      "instanceId": "wf-123",
      "publicId": "019505a2-...",
      "currentStep": "REVIEW",
      "stuckSince": "2026-09-04T10:00:00Z"
    }
  ]
}
```

### POST /maintenance/emergency/force-unlock

Force release a stuck lock.

**Request:**
```json
{
  "publicId": "019505a1-...",
  "lockType": "REDIS_REDLOCK",
  "reason": "Lock stuck for 24 hours"
}
```

**Response 200:**
```json
{
  "success": true,
  "publicId": "019505a1-...",
  "lockReleased": true,
  "auditId": "019505a5-..."
}
```

### POST /maintenance/emergency/bulk-hard-purge

Bulk hard-purge documents (Superadmin only — requires both `system.emergency_unlock` AND `system.manage_all`).

**Request:**
```json
{
  "publicIds": ["019505a1-...", "019505a2-..."],
  "reason": "Emergency data purge after corruption",
  "confirmPurge": true
}
```

**Response 202 + Poll pattern (same as Bulk Cancel).**
