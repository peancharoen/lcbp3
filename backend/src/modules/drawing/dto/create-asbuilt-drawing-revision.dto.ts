import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new revision to an existing AS Built Drawing
 */
export class CreateAsBuiltDrawingRevisionDto {
  @ApiProperty({ description: 'Revision label (e.g., A, B, 1)' })
  @IsString()
  @IsNotEmpty()
  revisionLabel!: string;

  @ApiProperty({ description: 'Drawing title for this revision' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Legacy/original drawing number' })
  @IsString()
  @IsOptional()
  legacyDrawingNumber?: string;

  @ApiPropertyOptional({ description: 'Revision date (ISO string)' })
  @IsDateString()
  @IsOptional()
  revisionDate?: string;

  @ApiPropertyOptional({ description: 'Description of changes' })
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
