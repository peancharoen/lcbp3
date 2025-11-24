import { IsString, IsOptional, IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  @IsString()
  @IsOptional()
  q?: string; // คำค้นหา (Query)

  @IsString()
  @IsOptional()
  type?: string; // กรองประเภท: 'rfa', 'correspondence', 'drawing'

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
