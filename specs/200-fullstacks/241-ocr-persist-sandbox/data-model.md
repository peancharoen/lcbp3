// File: specs/200-fullstacks/241-ocr-persist-sandbox/data-model.md
// Change Log:
// - 2026-07-27: Phase 1 data model for OCR Text Persistence & Sandbox Project

# Phase 1 Data Model: OCR Text Persistence & Sandbox Project

## 1. `attachments` (MODIFY)

| Column | Type | Nullable | Description |
|--------|------|----------|--------------|
| `ocr_text` | LONGTEXT | YES | OCR text ที่สกัดได้ ก่อนทำ semantic chunking/embedding (ADR-042) — เขียนโดย OCR-extract-persist job เท่านั้น |

**Validation rules**: ไม่มี format validation (raw extracted text) — ความยาวขั้นต่ำ 50 ตัวอักษรถูกเช็คที่ processor layer (ไม่ persist ถ้าสั้นเกินไป ตามพฤติกรรมเดิม)

**Relationships**: ไม่เปลี่ยนแปลง — ยังคง FK ผ่าน `correspondence_revision_attachments` ตามเดิม

**State transitions**: `ocr_text` เปลี่ยนจาก `NULL` → มีค่า ครั้งเดียวต่อการประมวลผล 1 รอบ (ไม่มี versioning — ถ้า revision ใหม่แนบไฟล์ใหม่ จะมี attachment row ใหม่พร้อม `ocr_text` เป็น NULL รอประมวลผล)

## 2. `projects` (MODIFY)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|--------------|
| `is_sandbox` | TINYINT(1) | NO | 0 | Flag ระบุว่าเป็นโครงการทดสอบ (ADR-042) — ถูกกรองออกจากรายการโครงการปกติเสมอ |

**Validation rules**: ตั้งค่าได้ผ่าน seed SQL เท่านั้น ไม่เปิด endpoint ให้ตั้งค่าผ่าน API (ป้องกันการสร้าง sandbox project เพิ่มโดยไม่ตั้งใจ)

**Seed data**: 1 แถวคงที่ — `project_code = 'SANDBOX'`, `project_name = 'AI Sandbox Testing (Internal)'`, `is_sandbox = 1`, `is_active = 1`

## 3. `RagPrepareJobPayload` (MODIFY — BullMQ payload, ไม่ใช่ DB table)

```typescript
export interface RagPrepareJobPayload {
  documentPublicId: string;
  projectPublicId: string;
  correspondenceNumber: string;
  docType: string;
  statusCode: string;
  revisionNumber: number;
  subject: string;
  documentDate?: string;
  cachedOcrText?: string;
  attachmentPath?: string;
  attachmentPublicId?: string; // NEW — ใช้เป็น WHERE key แทน attachmentPath
}
```

## 4. Job Type — `embed-document` (ไม่แก้ schema, แค่วิธีเรียก)

Payload เดิม (`ai-batch.processor.ts:412-451`) ไม่เปลี่ยน — `processRagPrepare` (บทบาทใหม่) จะเรียก `AiQueueService.enqueueEmbedDocument()` แทนการเรียก `EmbeddingService.embedDocument()` ตรง โดยส่ง `extractedText` = ocr text ที่เพิ่ง persist

```typescript
// jobId ใหม่ — แยก prefix จาก rag-prepare:... เพื่อไม่ชนกันใน batchQueue เดียวกัน
jobId: `embed-document:${documentPublicId}:${revisionNumber}`
```

## Entity Relationship Summary

```
Correspondence 1───N CorrespondenceRevision 1───N CorrespondenceRevisionAttachment N───1 Attachment
                                                                                          │
                                                                                          └─ ocr_text (NEW)

Project (is_sandbox: NEW) 1───N Correspondence
```
