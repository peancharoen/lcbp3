// File: backend/src/modules/migration/dto/import-correspondence.dto.ts
// Change Log:
// - 2026-08-23: ใช้ disciplineId (INT) โดยตรง ลบ disciplinePublicId ที่ขัดกับโครงสร้างตาราง

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
  category!: string;

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

  @IsString()
  @IsNotEmpty()
  batchId!: string;

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

  /** ข้อความ OCR 3 หน้าแรกสำหรับบันทึกลง Attachment และ trigger RAG (ADR-042/047) */
  @IsString()
  @IsOptional()
  ocrText?: string;
}
