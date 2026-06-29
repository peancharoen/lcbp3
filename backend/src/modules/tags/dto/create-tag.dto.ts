// File: src/modules/tags/dto/create-tag.dto.ts
// Change Log:
// - 2026-05-22: เริ่มต้นสร้าง CreateTagDto สำหรับรับข้อมูลการสร้างแท็กตาม ADR-028

import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO สำหรับการร้องขอสร้างแท็กใหม่
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
  @Length(1, 100)
  tagName!: string;

  @ApiPropertyOptional({
    description: 'รหัสสีของแท็ก',
    example: '#ff0000',
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  colorCode?: string;

  @ApiPropertyOptional({
    description: 'คำอธิบายเพิ่มเติมเกี่ยวกับแท็ก',
    example: 'แท็กสำหรับคัดกรองเอกสารประเภทโครงสร้าง',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
