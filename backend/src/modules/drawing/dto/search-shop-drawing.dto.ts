import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchShopDrawingDto {
  @IsUUID()
  projectUuid!: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  projectId?: number;

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
  limit: number = 20; // มีค่า Default
}
