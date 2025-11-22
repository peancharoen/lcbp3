import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchShopDrawingDto {
  @IsInt()
  @Type(() => Number)
  projectId!: number; // จำเป็น: ใส่ !

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  mainCategoryId?: number; // Optional: ใส่ ?

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  subCategoryId?: number; // Optional: ใส่ ?

  @IsOptional()
  @IsString()
  search?: string; // Optional: ใส่ ?

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page: number = 1; // มีค่า Default

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  pageSize: number = 20; // มีค่า Default
}
