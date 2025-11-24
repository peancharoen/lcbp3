// File: src/modules/master/dto/search-tag.dto.ts

import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchTagDto {
  @ApiPropertyOptional({ description: 'คำค้นหา (ชื่อ Tag หรือ คำอธิบาย)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'หมายเลขหน้า (เริ่มต้น 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'จำนวนรายการต่อหน้า', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
