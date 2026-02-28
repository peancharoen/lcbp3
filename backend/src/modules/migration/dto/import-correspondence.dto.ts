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
  document_number!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  source_file_path!: string;

  @IsNumber()
  @IsOptional()
  ai_confidence?: number;

  @IsOptional()
  ai_issues?: any;

  @IsString()
  @IsNotEmpty()
  migrated_by!: string; // "SYSTEM_IMPORT"

  @IsString()
  @IsNotEmpty()
  batch_id!: string;

  @IsObject()
  @IsOptional()
  details?: Record<string, any>;
}
