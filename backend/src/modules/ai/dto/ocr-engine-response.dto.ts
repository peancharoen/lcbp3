// File: src/modules/ai/dto/ocr-engine-response.dto.ts
// Change Log
// - 2026-05-30: สร้าง OcrEngineResponseDto สำหรับส่งข้อมูลผลลัพธ์ OCR Engine (T012, US1)

import { ApiProperty } from '@nestjs/swagger';
import { OcrEngineType } from '../entities/ocr-engine-configuration.entity';

/** DTO สำหรับส่งรายการ OCR Engine กลับไปยังไคลเอนต์ */
export class OcrEngineResponseDto {
  @ApiProperty({ description: 'รหัสประจำตัว OCR Engine (UUIDv7)' })
  engineId!: string;

  @ApiProperty({ description: 'ชื่อของ OCR Engine' })
  engineName!: string;

  @ApiProperty({ description: 'ประเภทของ OCR Engine', enum: OcrEngineType })
  engineType!: OcrEngineType;

  @ApiProperty({ description: 'สถานะเปิดใช้งาน' })
  isActive!: boolean;

  @ApiProperty({
    description: 'ระบุว่าเป็น Engine ที่ใช้งานอยู่ปัจจุบันหรือไม่',
  })
  isCurrentActive!: boolean;

  @ApiProperty({ description: 'ความต้องการ VRAM ในการประมวลผล (MB)' })
  vramRequirementMB!: number;

  @ApiProperty({ description: 'จำกัดเวลาในการประมวลผลสูงสุดต่อหน้า (วินาที)' })
  processingTimeLimitSeconds!: number;

  @ApiProperty({ description: 'จำกัดการประมวลผลพร้อมกัน' })
  concurrentLimit!: number;

  @ApiProperty({
    description: 'รหัสประจำตัว OCR Engine สำรองกรณีขัดข้อง',
    nullable: true,
  })
  fallbackEngineId?: string | null;

  @ApiProperty({ description: 'เวลาที่สร้างข้อมูล' })
  createdAt!: Date;

  @ApiProperty({ description: 'เวลาที่อัปเดตข้อมูลล่าสุด' })
  updatedAt!: Date;
}
