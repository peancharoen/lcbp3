// File: src/modules/tags/dto/create-tag.dto.ts
// Change Log:
// - 2026-05-22: เริ่มต้นสร้าง CreateTagDto สำหรับรับข้อมูลการสร้างแท็กตาม ADR-028
// - 2026-08-18: เปลี่ยน colorCode validation จาก @IsString/@Length เป็น @IsIn(TAG_COLOR_KEYS) (ADR-046)

import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TAG_COLOR_KEYS,
  type TagColorKey,
} from '../../master/constants/tag-colors';

/**
 * DTO สำหรับการร้องขอสร้างแท็กใหม่ (n8n / tag-manager path: /api/tags)
 *
 * `colorCode` ต้องเป็น palette key ที่อยู่ใน `TAG_COLOR_KEYS` (ADR-046)
 * ค่าที่ไม่ระบุจะถูก service แปลงเป็น `'default'`
 */
export class CreateTagDto {
  @ApiPropertyOptional({
    description: 'UUID ของโครงการ (หากไม่มีจะเป็น Global Tag)',
    example: '019505a1-7c3e-7000-8000-abc123def456',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({
    description:
      'ชื่อแท็ก (จะถูกจัดเก็บเป็นตัวพิมพ์เล็กและตัดช่องว่างส่วนเกิน)',
    example: 'structural',
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  tagName!: string;

  @ApiPropertyOptional({
    description:
      'Palette key (ADR-046) — default/slate/red/orange/amber/yellow/green/teal/blue/indigo/violet/purple/pink/rose',
    example: 'red',
    enum: TAG_COLOR_KEYS,
  })
  @IsIn(TAG_COLOR_KEYS, {
    message: 'colorCode ต้องเป็น palette key ที่กำหนด (ADR-046)',
  })
  @IsOptional()
  colorCode?: TagColorKey;

  @ApiPropertyOptional({
    description: 'คำอธิบายเพิ่มเติมเกี่ยวกับแท็ก',
    example: 'แท็กสำหรับคัดกรองเอกสารประเภทโครงสร้าง',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
