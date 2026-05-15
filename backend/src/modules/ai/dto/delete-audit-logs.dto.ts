// File: src/modules/ai/dto/delete-audit-logs.dto.ts
// Change Log
// - 2026-05-14: ย้าย DeleteAuditLogsQueryDto จาก ai.controller.ts เข้า dto/ folder (🟢 LOW-2).
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Query params สำหรับ DELETE /ai/audit-logs (T026) */
export class DeleteAuditLogsQueryDto {
  @ApiPropertyOptional({ description: 'UUID ของเอกสารที่ต้องการลบ log' })
  @IsOptional()
  @IsUUID()
  documentPublicId?: string;

  @ApiPropertyOptional({
    description: 'ลบ log ที่เก่ากว่า N วัน (1-365)',
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  olderThanDays?: number;
}
