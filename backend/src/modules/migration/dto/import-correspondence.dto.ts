import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsObject,
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

  @IsNumber()
  @IsOptional()
  tempAttachmentId?: number;

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

  @IsNumber()
  @IsOptional()
  senderId?: number;

  @IsNumber()
  @IsOptional()
  receiverId?: number;

  @IsString()
  @IsOptional()
  body?: string;
}
