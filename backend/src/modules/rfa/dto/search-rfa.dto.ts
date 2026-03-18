import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchRfaDto {
  @IsUUID('all')
  projectUuid!: string; // ADR-019: Public UUID of the project

  /** @internal Resolved INT ID — set by controller, do NOT expose in API */
  projectId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  rfaTypeId?: number; // กรองตามประเภท RFA

  @IsOptional()
  @IsString()
  statusCode?: string; // กรองตามสถานะโดยใช้ status code เช่น 'DFT', 'FAP'

  @IsOptional()
  @IsString()
  revisionStatus?: string; // 'CURRENT' | 'OLD' | 'ALL' — default 'CURRENT'

  @IsOptional()
  @IsString()
  search?: string; // ค้นหาจาก เลขที่เอกสาร หรือ หัวข้อเรื่อง

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit: number = 20;
}
