# Phase 1 Data Model: 4-Layer Excel Data Review Pipeline

**Feature Branch**: `feature/252-excel-data-review-pipeline`  
**Date**: 2026-09-05  
**Spec**: [spec.md](./spec.md) | **ADR**: [ADR-052](../../06-Decision-Records/ADR-052-excel-data-review-pipeline.md)

---

## 🗄️ Entities & Data Structures

### 1. ReviewSession (Redis In-Memory Key-Value)

- **Redis Key**: `import_review:session:<reviewSessionPublicId>`
- **TTL**: 86400 วินาที (24 ชั่วโมง)
- **JSON Payload**:
  ```typescript
  export interface ReviewSessionData {
    reviewSessionPublicId: string;       // UUIDv7 string (API visible)
    projectPublicId: string;             // UUIDv7 string ของโครงการ
    targetMode: 'MIGRATION_STAGING' | 'DIRECT_IMPORT';
    uploadedBy: string;                  // User publicId
    totalRows: number;
    passCount: number;
    warnCount: number;
    blockCount: number;
    aiSuggestCount: number;
    originalFileName: string;
    originalFilePath: string;            // Absolute path in private stash
    annotatedFilePath: string;           // Absolute path of generated .xlsx
    selectedAiProvider: 'LOCAL_OLLAMA' | 'GEMINI' | 'CLAUDE';
    status: 'READY' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
    createdAt: string;                   // ISO date string
    expiresAt: string;                   // ISO date string (+24h)
  }
  ```

### 2. ReviewFinding (Structured Finding Object)

- ใช้ส่งผ่านระหว่าง Layer 1, Layer 2, Layer 3 และใช้เรนเดอร์ใน Annotated Excel
  ```typescript
  export type FindingLevel = 'BLOCK' | 'WARN' | 'AI_SUGGEST';

  export interface ReviewFinding {
    row: number;                         // 1-based row index in Excel
    column: string;                      // Column letter e.g. "B" or "Document Number"
    level: FindingLevel;
    message: string;                     // Human-readable message in Thai
    originalValue: unknown;
    suggestedValue?: unknown;            // Value proposed by system or AI
    confidence?: number;                 // 0.00 - 1.00 (from AI)
  }
  ```

### 3. ExcelRowDto (Standardized Ingest Row)

- ตัวแทนแถวข้อมูลหลังจากผ่าน `ExcelRowBuilder`:
  ```typescript
  export interface ExcelCorrespondenceRow {
    rowIndex: number;
    documentNumber: string;
    subject: string;
    correspondenceTypeCode?: string;
    disciplineCode?: string;
    revisionNumber: string;              // Default '0'
    issuedDate?: Date;
    receivedDate?: Date;
    senderOrgRaw?: string;
    senderOrgId?: number;                // Resolved from DB Map
    receiverOrgRaw?: string;
    receiverOrgId?: number;              // Resolved from DB Map
    fileName?: string;
    resolvedPdfPath?: string;
    remarks?: string;
    findings: ReviewFinding[];
  }
  ```

### 4. ImportTransaction (Existing MariaDB Entity)

- **ตาราง**: `import_transactions` (มีอยู่เดิมตาม ADR-028/044 ไม่มีการแก้ DDL)
- ใช้บันทึกประวัติถาวรเมื่อการ Confirm สำเร็จ:
  - `batch_id`: รหัส Batch นำเข้า
  - `source_type`: `'EXCEL'`
  - `total_count`: จำนวนแถวทั้งหมด
  - `success_count`: จำนวนแถวที่นำเข้าสำเร็จ
  - `error_count`: จำนวนแถวที่พบข้อผิดพลาด
  - `created_by`: ผู้ดำเนินการ
