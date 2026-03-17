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
  document_number!: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  original_subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  ai_summary?: string;

  @IsNumber()
  @IsOptional()
  project_id?: number;

  @IsNumber()
  @IsOptional()
  sender_org_id?: number;

  @IsNumber()
  @IsOptional()
  receiver_org_id?: number;

  @IsString()
  @IsOptional()
  issued_date?: string;

  @IsString()
  @IsOptional()
  received_date?: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsArray()
  @IsOptional()
  extracted_tags?: Record<string, string>[];

  @IsOptional()
  details?: Record<string, unknown>;

  @IsNumber()
  @IsOptional()
  temp_attachment_id?: number;

  @IsBoolean()
  @IsOptional()
  is_valid?: boolean;

  @IsNumber()
  @IsOptional()
  confidence?: number;

  @IsArray()
  @IsOptional()
  ai_issues?: any[];
}
