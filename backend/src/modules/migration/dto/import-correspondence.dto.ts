// File: backend/src/modules/migration/dto/import-correspondence.dto.ts
// Change Log:
// - 2026-08-23: ใช้ disciplineId (INT) โดยตรง ลบ disciplinePublicId ที่ขัดกับโครงสร้างตาราง
// - 2026-08-25: เพิ่ม remarks field สำหรับนำเข้า Excel column "หมายเหตุ" → correspondence_revisions.remarks
// - 2026-08-25: เพิ่ม aiSummary field — AI สรุปหลัง OCR extract → correspondence_revisions.body (D159)
// - 2026-08-26: batchId เป็น @IsOptional() — commitBatch เซ็ต batchId หลัง DTO validation (Bugfix)

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
  IsUUID,
} from 'class-validator';

export class ImportCorrespondenceDto {
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  correspondenceType!: string;

  @IsString()
  @IsOptional()
  sourceFilePath?: string;

  /** @deprecated ใช้ tempAttachmentIds แทน — retained for backward compatibility (R4) */
  @IsNumber()
  @IsOptional()
  tempAttachmentId?: number;

  /** รายการ internal attachment IDs หลายไฟล์ (FR-001, FR-002) */
  @IsArray()
  @IsOptional()
  tempAttachmentIds?: number[];

  /** รายการ source file paths สำหรับ import หลายไฟล์ */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sourceFilePaths?: string[];

  @IsNumber()
  @IsOptional()
  aiConfidence?: number;

  @IsOptional()
  aiIssues?: Record<string, unknown>[];

  @IsString()
  @IsNotEmpty()
  migratedBy!: string; // "SYSTEM_IMPORT"

  /**
   * batchId — required สำหรับ direct import endpoint
   * แต่ optional สำหรับ commitBatch (backend เซ็ต batchId หลัง DTO validation)
   * และ approveQueueItem (frontend ส่ง batchId มาเอง)
   */
  @IsString()
  @IsOptional()
  batchId?: string;

  @IsObject()
  @IsOptional()
  details?: Record<string, unknown>;

  @IsNumber()
  @IsNotEmpty()
  projectId!: number;

  @IsString()
  @IsOptional()
  issuedDate?: string;

  @IsString()
  @IsOptional()
  receivedDate?: string;

  @IsString()
  @IsOptional()
  documentDate?: string;

  /** Discipline internal ID (INT) — disciplines อยู่ใน ADR-019 Excluded Tables (Master/Lookup) */
  @IsNumber()
  @IsOptional()
  disciplineId?: number;

  @IsNumber()
  @IsOptional()
  senderId?: number;

  /** ADR-019: UUID publicId สำหรับ sender organization */
  @IsUUID()
  @IsOptional()
  senderPublicId?: string;

  @IsNumber()
  @IsOptional()
  receiverId?: number;

  /** ADR-019: UUID publicId สำหรับ receiver organization */
  @IsUUID()
  @IsOptional()
  receiverPublicId?: string;

  @IsString()
  @IsOptional()
  body?: string;

  /**
   * AI สรุปหลังจาก OCR extract (processLegacyAiEnrichment) —
   * ใช้เป็น fallback สำหรับ correspondence_revisions.body เมื่อ reviewer ไม่ได้ส่ง body มาเอง (D159)
   * ความสำคัญ: body (reviewer override) > aiSummary (AI สรุป) > undefined
   * ไม่ใช้ ocrText เป็น body เพราะ OCR ดิบเป็นข้อมูลดิบ ไม่ใช่เนื้อหาสรุป
   */
  @IsString()
  @IsOptional()
  aiSummary?: string;

  /** หมายเหตุจาก Excel (column "remarks") — นำเข้าสู่ correspondence_revisions.remarks */
  @IsString()
  @IsOptional()
  remarks?: string;

  /**
   * ข้อความ OCR ดิบ 3 หน้าแรก — เก็บใน attachments.ocr_text และใช้เป็น cachedOcrText สำหรับ RAG (ADR-042/047)
   * ไม่ใช้สำหรับ correspondence_revisions.body (D159)
   */
  @IsString()
  @IsOptional()
  ocrText?: string;
}
