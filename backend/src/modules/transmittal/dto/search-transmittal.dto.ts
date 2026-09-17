// File: backend/src/modules/transmittal/dto/search-transmittal.dto.ts
// Change Log:
// - 2026-09-17: เพิ่ม server-side column filter/sort

import {
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  IsIn,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransmittalPurpose } from './create-transmittal.dto';

export class SearchTransmittalDto {
  @IsUUID('all')
  @IsOptional()
  projectUuid?: string; // ADR-019: Public UUID of the project

  /** @internal Resolved INT ID — set by controller, do NOT expose in API */
  projectId?: number;

  @IsEnum(TransmittalPurpose)
  @IsOptional()
  purpose?: TransmittalPurpose;

  @IsString()
  @IsOptional()
  search?: string; // ค้นหาจากเลขที่เอกสาร หรือ remarks

  @IsOptional() @IsString() documentNumber?: string;
  @IsOptional() @IsString() revision?: string;
  @IsOptional() @IsDateString() createdDate?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional()
  @IsIn(['documentNumber', 'revision', 'createdAt', 'status'])
  sortBy?: 'documentNumber' | 'revision' | 'createdAt' | 'status';
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
