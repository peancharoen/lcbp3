import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer'; // <--- ✅ Import จาก class-transformer

export class SearchCorrespondenceDto {
  @IsOptional()
  @IsString()
  search?: string; // ค้นหาจาก Title หรือ Number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  typeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  projectId?: number;

  // status อาจจะซับซ้อนหน่อยเพราะอยู่ที่ Revision แต่ใส่ไว้ก่อน
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusId?: number;

  // Pagination
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}
