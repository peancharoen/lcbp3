import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for searching/filtering AS Built Drawings
 */
export class SearchAsBuiltDrawingDto {
  @ApiProperty({ description: 'Project UUID' })
  @IsUUID()
  projectUuid!: string;

  @ApiPropertyOptional({ description: 'Project ID (resolved internally)' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  projectId?: number;

  @ApiPropertyOptional({ description: 'Filter by Main Category ID' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  mainCategoryId?: number;

  @ApiPropertyOptional({ description: 'Filter by Sub Category ID' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  subCategoryId?: number;

  @ApiPropertyOptional({ description: 'Search by drawing number' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by drawing number' })
  @IsString()
  @IsOptional()
  documentNumber?: string;

  @ApiPropertyOptional({ description: 'Filter by latest revision label' })
  @IsString()
  @IsOptional()
  revision?: string;

  @ApiPropertyOptional({ description: 'Filter by creation date' })
  @IsDateString()
  @IsOptional()
  createdDate?: string;

  @ApiPropertyOptional({ enum: ['documentNumber', 'revision', 'createdAt'] })
  @IsIn(['documentNumber', 'revision', 'createdAt'])
  @IsOptional()
  sortBy?: 'documentNumber' | 'revision' | 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
