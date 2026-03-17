import { IsString, IsOptional, IsEnum } from 'class-validator';
import { MigrationErrorType } from '../entities/migration-error.entity';

export class CreateMigrationErrorDto {
  @IsString()
  @IsOptional()
  batch_id?: string;

  @IsString()
  @IsOptional()
  document_number?: string;

  @IsString()
  @IsOptional()
  @IsEnum(MigrationErrorType)
  error_type?: MigrationErrorType;

  @IsString()
  @IsOptional()
  error_message?: string;

  @IsString()
  @IsOptional()
  raw_ai_response?: string;
}
