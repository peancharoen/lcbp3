// File: backend/src/modules/ai/dto/apply-result.dto.ts
// Change Log:
// - 2026-06-13: ADR-036 — DTO ผลลัพธ์สำหรับ apply sandbox draft ไป production

import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsObject, IsString } from 'class-validator';

/**
 * DTO สำหรับผลลัพธ์ของการ Apply to Production
 */
export class ApplyResultDto {
  @ApiProperty({ description: 'สถานะการ apply สำเร็จหรือไม่' })
  @IsBoolean()
  success!: boolean;

  @ApiProperty({ description: 'ชื่อโปรไฟล์ที่ถูก apply' })
  @IsString()
  profileName!: string;

  @ApiProperty({ description: 'ค่าก่อน apply' })
  @IsObject()
  oldValues!: Record<string, unknown>;

  @ApiProperty({ description: 'ค่าหลัง apply' })
  @IsObject()
  newValues!: Record<string, unknown>;

  @ApiProperty({ description: 'เวลาที่ apply เสร็จ', format: 'date-time' })
  @IsDateString()
  appliedAt!: string;
}
