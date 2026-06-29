// File: src/modules/ai/dto/ai-admin-settings.dto.ts
// Change Log
// - 2026-05-21: เพิ่ม DTO สำหรับ AI Admin toggle endpoint.

import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** DTO สำหรับสลับสถานะเปิด/ปิด AI features ทั้งระบบ */
export class ToggleAiFeaturesDto {
  @ApiProperty({ description: 'สถานะเปิด/ปิด AI features สำหรับผู้ใช้ทั่วไป' })
  @IsBoolean()
  enabled!: boolean;
}
