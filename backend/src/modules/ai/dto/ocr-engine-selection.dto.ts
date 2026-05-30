// File: src/modules/ai/dto/ocr-engine-selection.dto.ts
// Change Log
// - 2026-05-30: สร้าง OcrEngineSelectionDto สำหรับการเลือก OCR Engine (T011, US1)

import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/** DTO สำหรับการเลือกหรือตั้งค่าการทำงานของ OCR Engine */
export class OcrEngineSelectionDto {
  @ApiProperty({
    description: 'เปิดใช้งานหรือปิดใช้งาน Engine นี้',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
