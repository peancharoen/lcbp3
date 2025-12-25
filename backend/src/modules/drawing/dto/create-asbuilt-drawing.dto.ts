import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new AS Built Drawing with its first revision
 */
export class CreateAsBuiltDrawingDto {
  @ApiProperty({ description: 'Project ID' })
  @IsNumber()
  @IsNotEmpty()
  projectId!: number;

  @ApiProperty({ description: 'AS Built Drawing Number (unique)' })
  @IsString()
  @IsNotEmpty()
  drawingNumber!: string;

  @ApiProperty({ description: 'Main Category ID' })
  @IsNumber()
  @IsNotEmpty()
  mainCategoryId!: number;

  @ApiProperty({ description: 'Sub Category ID' })
  @IsNumber()
  @IsNotEmpty()
  subCategoryId!: number;

  // First Revision Data
  @ApiProperty({ description: 'Drawing title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Revision label (e.g., A, B, 0)' })
  @IsString()
  @IsOptional()
  revisionLabel?: string;

  @ApiPropertyOptional({ description: 'Legacy/original drawing number' })
  @IsString()
  @IsOptional()
  legacyDrawingNumber?: string;

  @ApiPropertyOptional({ description: 'Revision date (ISO string)' })
  @IsDateString()
  @IsOptional()
  revisionDate?: string;

  @ApiPropertyOptional({ description: 'Description of the revision' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Shop Drawing Revision IDs to reference',
  })
  @IsArray()
  @IsOptional()
  shopDrawingRevisionIds?: number[];

  @ApiPropertyOptional({ description: 'Attachment IDs' })
  @IsArray()
  @IsOptional()
  attachmentIds?: number[];
}
