// File: backend/src/modules/migration/dto/update-queue-ocr.dto.ts
// Change Log:
// - 2026-08-20: สร้าง DTO สำหรับอัปเดตข้อความ OCR และ Sync RAG (ADR-042/047)

import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQueueOcrDto {
  @ApiProperty({
    description: 'ข้อความ OCR ที่ผ่านการแก้ไข/ตรวจทานแล้ว',
    example: 'บันทึกข้อความ เรื่อง ขออนุมัติแบบก่อสร้าง...',
  })
  @IsString()
  @IsNotEmpty()
  ocrText!: string;

  @ApiPropertyOptional({
    description: 'สั่ง Re-embed ข้อความใหม่ลง Qdrant ทันทีหรือไม่ (ADR-042)',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  reEmbed?: boolean;
}
