// File: src/modules/master/dto/create-tag.dto.ts

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({ example: 'URGENT', description: 'ชื่อ Tag' })
  @IsString()
  @IsNotEmpty()
  tag_name: string;

  @ApiProperty({
    example: 'เอกสารด่วนต้องดำเนินการทันที',
    description: 'คำอธิบาย',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
