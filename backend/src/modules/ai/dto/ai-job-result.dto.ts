// File: src/modules/ai/dto/ai-job-result.dto.ts
// Change Log:
// - 2026-05-22: สร้าง AiJobResultDto สำหรับจัดรูปแบบและตรวจสอบผลลัพธ์ของงาน AI (ADR-028)

import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * แท็กที่ AI แนะนำจากการวิเคราะห์เอกสาร
 */
export class SuggestedTagDto {
  @ApiProperty({ description: 'ชื่อแท็กที่แนะนำ' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'คำอธิบายเกี่ยวกับแท็ก' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'ระบุว่าเป็นแท็กใหม่ในระบบหรือไม่' })
  @IsBoolean()
  isNew!: boolean;

  @ApiProperty({ description: 'ระดับความมั่นใจของ AI ต่อแท็กนี้ (0.0–1.0)' })
  @IsNumber()
  confidence!: number;
}

/**
 * ผลลัพธ์จากการวิเคราะห์เอกสารของ AI สำหรับการย้ายระบบ
 */
export class AiJobResultDto {
  @ApiProperty({ description: 'เอกสารมีความถูกต้องและสมบูรณ์หรือไม่' })
  @IsBoolean()
  isValid!: boolean;

  @ApiProperty({
    description: 'ระดับความมั่นใจเฉลี่ยโดยรวมของเอกสาร (0.0–1.0)',
  })
  @IsNumber()
  confidence!: number;

  @ApiProperty({ description: 'หมวดหมู่ของเอกสารโต้ตอบที่แนะนำ' })
  @IsString()
  category!: string;

  @ApiProperty({ description: 'บทสรุปโดยย่อของเอกสาร' })
  @IsString()
  summary!: string;

  @ApiProperty({
    type: [SuggestedTagDto],
    description: 'รายการแท็กที่ AI แนะนำ',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuggestedTagDto)
  suggestedTags!: SuggestedTagDto[];

  @ApiProperty({
    type: [String],
    description: 'รายการจุดผิดพลาดหรือข้อควรระวังที่พบในเอกสาร',
  })
  @IsArray()
  @IsString({ each: true })
  detectedIssues!: string[];

  @ApiProperty({
    enum: ['fast-path', 'slow-path'],
    description: 'วิธีการสกัดข้อความจากเอกสาร',
  })
  @IsString()
  ocrMethod!: 'fast-path' | 'slow-path';

  @ApiProperty({
    description: 'ระยะเวลาที่ใช้ในการสกัดข้อมูลและวิเคราะห์ (ms)',
  })
  @IsNumber()
  processingTimeMs!: number;
}
