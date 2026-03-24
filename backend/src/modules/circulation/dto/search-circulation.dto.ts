import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchCirculationDto {
  @IsOptional()
  @IsString()
  search?: string; // ค้นหาจาก Subject หรือ No.

  @IsOptional()
  @IsUUID('all')
  correspondenceUuid?: string; // กรองตาม correspondence UUID (ADR-019)

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
