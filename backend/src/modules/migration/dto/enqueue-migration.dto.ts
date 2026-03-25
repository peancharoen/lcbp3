import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class EnqueueMigrationDto {
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  originalSubject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  aiSummary?: string;

  @IsNumber()
  @IsOptional()
  projectId?: number;

  @IsNumber()
  @IsOptional()
  senderOrgId?: number;

  @IsNumber()
  @IsOptional()
  receiverOrgId?: number;

  @IsString()
  @IsOptional()
  issuedDate?: string;

  @IsString()
  @IsOptional()
  receivedDate?: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsArray()
  @IsOptional()
  extractedTags?: Record<string, string>[];

  @IsOptional()
  details?: Record<string, unknown>;

  @IsNumber()
  @IsOptional()
  tempAttachmentId?: number;

  @IsBoolean()
  @IsOptional()
  isValid?: boolean;

  @IsNumber()
  @IsOptional()
  confidence?: number;

  @IsArray()
  @IsOptional()
  aiIssues?: Record<string, unknown>[];
}
