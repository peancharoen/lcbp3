import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for searching/filtering AS Built Drawings
 */
export class SearchAsBuiltDrawingDto {
  @ApiProperty({ description: 'Project ID' })
  @Type(() => Number)
  @IsNumber()
  projectId!: number;

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
}
