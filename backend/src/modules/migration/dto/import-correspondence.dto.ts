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

  @IsNumber()
  @IsOptional()
  disciplineId?: number;

  /** Discipline ID (INT — disciplines table ไม่มี UUID publicId) */
  @IsString()
  @IsOptional()
  disciplinePublicId?: string;

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
}
