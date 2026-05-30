// File: src/modules/ai/entities/ocr-engine-configuration.entity.ts
// Change Log
// - 2026-05-30: สร้าง OcrEngineConfiguration class สำหรับเก็บข้อมูลการตั้งค่า OCR Engine (T010, US1)

import { ApiProperty } from '@nestjs/swagger';

export enum OcrEngineType {
  TESSERACT = 'tesseract',
  TYPHOON_OCR = 'typhoon_ocr',
}

/** คลาสสำหรับเก็บข้อมูลการตั้งค่า OCR Engine (ไม่ผูกกับตาราง SQL ตาม data-model.md) */
export class OcrEngineConfiguration {
  @ApiProperty({ description: 'รหัสประจำตัว OCR Engine (UUIDv7)' })
  engineId!: string;

  @ApiProperty({ description: 'ชื่อของ OCR Engine' })
  engineName!: string;

  @ApiProperty({ description: 'ประเภทของ OCR Engine', enum: OcrEngineType })
  engineType!: OcrEngineType;

  @ApiProperty({ description: 'สถานะเปิดใช้งาน' })
  isActive!: boolean;

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

  @ApiProperty({ description: 'เวลาที่บันทึกข้อมูล' })
  createdAt!: Date;

  @ApiProperty({ description: 'เวลาที่อัปเดตข้อมูลล่าสุด' })
  updatedAt!: Date;
}
