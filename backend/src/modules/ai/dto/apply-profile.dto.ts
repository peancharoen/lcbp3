// File: backend/src/modules/ai/dto/apply-profile.dto.ts
// Change Log:
// - 2026-06-13: ADR-036 — DTO สำหรับ apply sandbox draft ไป production

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO สำหรับคำสั่ง Apply to Production
 */
export class ApplyProfileDto {
  @ApiPropertyOptional({
    enum: ['np-dms-ai', 'np-dms-ocr'],
    description: 'Canonical model ที่ต้องการ apply',
  })
  @IsOptional()
  @IsEnum(['np-dms-ai', 'np-dms-ocr'])
  canonicalModel?: 'np-dms-ai' | 'np-dms-ocr';

  @ApiPropertyOptional({
    description: 'เหตุผลในการ apply สำหรับ audit trail',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
