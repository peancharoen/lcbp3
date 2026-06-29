import { IsString, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  @IsString()
  @IsOptional()
  q?: string; // คำค้นหา (Query)

  @IsString()
  @IsOptional()
  type?: string; // กรองประเภท: 'rfa', 'correspondence', 'drawing'

  @IsString()
  @IsOptional()
  status?: string; // กรองสถานะ: 'DRAFT', 'SUBOWN', 'CLBOWN', 'CANCELLED', ...

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  projectId?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  page: number = 1;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  limit: number = 20;
}
