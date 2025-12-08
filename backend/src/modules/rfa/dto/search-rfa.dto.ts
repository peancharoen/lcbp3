import { IsInt, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchRfaDto {
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  projectId!: number; // บังคับระบุ Project

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  rfaTypeId?: number; // กรองตามประเภท RFA

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  statusId?: number; // กรองตามสถานะ (เช่น Draft, For Approve)

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
