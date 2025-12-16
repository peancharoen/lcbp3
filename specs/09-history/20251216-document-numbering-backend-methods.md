# 20251216-document-numbering-backend-methods.md

> **Date**: 2025-12-16
> **Type**: Feature Implementation
> **Status**: ✅ Completed

## Summary

Implemented missing backend methods for Document Numbering module and fixed frontend admin panel issues.

---

## Backend Changes

### New Service Methods (`document-numbering.service.ts`)

| Method                     | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `voidAndReplace(dto)`      | Void a number and optionally generate replacement |
| `cancelNumber(dto)`        | Mark a number as cancelled in audit log           |
| `getSequences(projectId?)` | Get all counter sequences                         |
| `previewNumber(ctx)`       | Preview number without incrementing counter       |

### New Controller Endpoints (`document-numbering.controller.ts`)

| Endpoint                        | Method | Permission            |
| ------------------------------- | ------ | --------------------- |
| `/document-numbering/sequences` | GET    | `correspondence.read` |
| `/document-numbering/preview`   | POST   | `correspondence.read` |

### New DTO

- `dto/preview-number.dto.ts` - Request DTO for preview endpoint

---

## Frontend Fixes

### API Response Handling

Fixed wrapped response `{ data: [...] }` issue:
- `components/numbering/sequence-viewer.tsx`
- `app/(admin)/admin/numbering/page.tsx`

### Template Editor (`components/numbering/template-editor.tsx`)

- Made Document Type **optional** (`correspondence_type_id` can be `null`)
- Added "Default (All Types)" option to dropdown
- Fixed validation to allow save without type selection

---

## Database

Added missing table `document_number_formats` to schema.

---

## Specs Updated

- `specs/03-implementation/document-numbering.md` → v1.7.0 (status: implemented)

---

## Files Modified

```
backend/src/modules/document-numbering/
├── document-numbering.service.ts
├── document-numbering.controller.ts
├── dto/preview-number.dto.ts (NEW)
└── ...

backend/src/modules/circulation/
└── circulation.service.ts (fixed generateNextNumber usage)

frontend/lib/api/
└── numbering.ts

frontend/components/numbering/
├── sequence-viewer.tsx
└── template-editor.tsx

frontend/app/(admin)/admin/numbering/
└── page.tsx

specs/03-implementation/
└── document-numbering.md
```
