import { IsString, IsOptional, IsEnum } from 'class-validator';
import { MigrationErrorType } from '../entities/migration-error.entity';

export class CreateMigrationErrorDto {
  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  documentNumber?: string;

  @IsString()
  @IsOptional()
  @IsEnum(MigrationErrorType)
  errorType?: MigrationErrorType;

  @IsString()
  @IsOptional()
  errorMessage?: string;

  @IsString()
  @IsOptional()
  rawAiResponse?: string;
}
