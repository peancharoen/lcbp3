// File: backend/src/modules/circulation/dto/search-circulation.dto.ts
// Change Log:
// - 2026-09-17: เพิ่ม server-side column filter/sort

import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchCirculationDto {
  @IsOptional()
  @IsString()
  search?: string; // ค้นหาจาก Subject หรือ No.

  @IsOptional()
  @IsUUID('all')
  correspondencePublicId?: string; // กรองตาม correspondence publicId (ADR-019)

  @IsOptional()
  @IsString()
  status?: string; // OPEN, COMPLETED

  @IsOptional() @IsString() documentNumber?: string;
  @IsOptional() @IsDateString() createdDate?: string;
  @IsOptional()
  @IsIn(['documentNumber', 'createdAt', 'status'])
  sortBy?: 'documentNumber' | 'createdAt' | 'status';
  @IsOptional() @IsIn(['ASC', 'DESC']) sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit: number = 20;
}
