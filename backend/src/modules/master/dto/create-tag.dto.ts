// File: backend/src/modules/master/dto/create-tag.dto.ts
// Change Log:
// - 2026-08-18: เปลี่ยน colorCode validation จาก @IsString เป็น @IsIn(TAG_COLOR_KEYS) (ADR-046)

import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TAG_COLOR_KEYS, type TagColorKey } from '../constants/tag-colors';

/**
 * DTO สำหรับการสร้าง/แก้ไข Tag (admin path: /api/master/tags)
 *
 * `colorCode` ต้องเป็น palette key ที่อยู่ใน `TAG_COLOR_KEYS` (ADR-046)
 * ค่าที่ไม่ระบุจะถูก service แปลงเป็น `'default'`
 */
export class CreateTagDto {
  @ApiProperty({ example: 'URGENT', description: 'ชื่อ Tag' })
  @IsString()
  @IsNotEmpty()
  tagName!: string;

  @ApiProperty({ example: 'คำอธิบาย', description: 'คำอธิบาย' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'red',
    description:
      'Palette key (ADR-046) — default/slate/red/orange/amber/yellow/green/teal/blue/indigo/violet/purple/pink/rose',
    required: false,
    enum: TAG_COLOR_KEYS,
  })
  @IsIn(TAG_COLOR_KEYS, {
    message: 'colorCode ต้องเป็น palette key ที่กำหนด (ADR-046)',
  })
  @IsOptional()
  colorCode?: TagColorKey;

  @ApiProperty({
    example: 1,
    description: 'Project ID or UUID',
    required: false,
  })
  @IsOptional()
  projectId?: number | string;
}
