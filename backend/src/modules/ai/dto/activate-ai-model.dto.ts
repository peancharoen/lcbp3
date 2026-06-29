// File: src/modules/ai/dto/activate-ai-model.dto.ts
// Change Log
// - 2026-05-30: สร้าง ActivateAiModelDto สำหรับตั้งค่าโมเดล AI หลักที่ต้องการเปิดใช้งาน (T026, US2)

import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** DTO สำหรับส่งรหัสของโมเดล AI ที่ต้องการเปิดใช้งาน */
export class ActivateAiModelDto {
  @ApiProperty({
    description: 'รหัสโมเดล AI (UUIDv7) หรือชื่อโมเดล AI ที่ต้องการเปิดใช้งาน',
  })
  @IsString()
  modelId!: string;
}
