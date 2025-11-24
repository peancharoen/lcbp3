import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchCirculationDto {
  @IsOptional()
  @IsString()
  search?: string; // ค้นหาจาก Subject หรือ No.

  @IsOptional()
  @IsString()
  status?: string; // OPEN, COMPLETED

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit: number = 20;
}
