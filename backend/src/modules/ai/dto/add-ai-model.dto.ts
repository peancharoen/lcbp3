// File: src/modules/ai/dto/add-ai-model.dto.ts
// Change Log
// - 2026-05-30: สร้าง AddAiModelDto สำหรับเพิ่มโมเดล AI ใหม่เข้าระบบ (T025, US2)

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  IsOptional,
} from 'class-validator';
import { AiModelType } from '../entities/ai-model-configuration.entity';

/** DTO สำหรับเพิ่มโมเดล AI ใหม่ */
export class AddAiModelDto {
  @ApiProperty({
    description: 'ชื่อของโมเดล AI (เช่น gemma4:e4b, typhoon2.1-gemma3-4b)',
  })
  @IsString()
  modelName!: string;

  @ApiProperty({ description: 'ประเภทของโมเดล AI', enum: AiModelType })
  @IsEnum(AiModelType)
  modelType!: AiModelType;

  @ApiProperty({ description: 'ชื่อโมเดลใน Ollama Registry' })
  @IsString()
  ollamaModelName!: string;

  @ApiProperty({ description: 'ความต้องการ VRAM ในการประมวลผล (MB)' })
  @IsNumber()
  vramRequirementMB!: number;

  @ApiProperty({
    description: 'กรณีการใช้งานที่รองรับ (Use Cases)',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  useCases!: string[];

  @ApiProperty({
    description: 'ประเภท Quantization (เช่น Q3_K_M)',
    required: false,
  })
  @IsString()
  @IsOptional()
  quantization?: string;
}
