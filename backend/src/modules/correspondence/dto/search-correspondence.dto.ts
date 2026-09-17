// File: backend/src/modules/correspondence/dto/search-correspondence.dto.ts
// Change Log:
// - 2026-09-17: เพิ่ม server-side document list filters และ allow-listed sorting

import {
  IsOptional,
  IsString,
  IsInt,
  IsIn,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchCorrespondenceDto {
  @ApiPropertyOptional({
    description: 'Search term (Title or Document Number)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Document Type ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  typeId?: number;

  @ApiPropertyOptional({ description: 'Filter by Project ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  @ApiPropertyOptional({ description: 'Filter by Status ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusId?: number;

  @ApiPropertyOptional({
    description:
      'Filter by Status code (e.g. DRAFT, IN_REVIEW, APPROVED, CANCELLED)',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Revision Filter: CURRENT (default), ALL, OLD',
  })
  @IsOptional()
  @IsString()
  revisionStatus?: 'CURRENT' | 'ALL' | 'OLD';

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  revision?: string;

  @IsOptional()
  @IsDateString()
  createdDate?: string;

  @IsOptional()
  @IsIn(['documentNumber', 'revision', 'createdAt', 'status'])
  sortBy?: 'documentNumber' | 'revision' | 'createdAt' | 'status';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Page number (default 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page (default 10)',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}
