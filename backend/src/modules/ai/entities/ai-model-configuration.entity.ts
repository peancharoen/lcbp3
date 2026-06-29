// File: src/modules/ai/entities/ai-model-configuration.entity.ts
// Change Log
// - 2026-05-30: สร้าง AiModelConfiguration class สำหรับเก็บข้อมูลการตั้งค่า AI Model (T024, US2)

import { ApiProperty } from '@nestjs/swagger';

export enum AiModelType {
  LLM = 'llm',
  EMBEDDING = 'embedding',
  OCR = 'ocr',
}

/** คลาสสำหรับเก็บข้อมูลการตั้งค่า AI Model (ไม่ผูกกับตาราง SQL โดยตรง ตาม data-model.md) */
export class AiModelConfiguration {
  @ApiProperty({ description: 'รหัสประจำตัวโมเดล AI (UUIDv7)' })
  modelId!: string;

  @ApiProperty({
    description: 'ชื่อของโมเดล AI (เช่น np-dms-ai:latest, np-dms-ocr:latest)',
  })
  modelName!: string;

  @ApiProperty({ description: 'ประเภทของโมเดล AI', enum: AiModelType })
  modelType!: AiModelType;

  @ApiProperty({ description: 'ชื่อโมเดลใน Ollama Registry' })
  ollamaModelName!: string;

  @ApiProperty({ description: 'ความต้องการ VRAM ในการประมวลผล (MB)' })
  vramRequirementMB!: number;

  @ApiProperty({ description: 'สถานะเปิดใช้งานโมเดล' })
  isActive!: boolean;

  @ApiProperty({
    description: 'กรณีการใช้งานที่รองรับ (Use Cases)',
    type: [String],
  })
  useCases!: string[];

  @ApiProperty({
    description: 'ประเภท Quantization (เช่น Q3_K_M)',
    nullable: true,
  })
  quantization?: string | null;

  @ApiProperty({ description: 'เวลาที่สร้างข้อมูล' })
  createdAt!: Date;

  @ApiProperty({ description: 'เวลาที่อัปเดตข้อมูลล่าสุด' })
  updatedAt!: Date;
}
