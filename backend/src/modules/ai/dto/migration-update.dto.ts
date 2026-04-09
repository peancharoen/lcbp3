// File: src/modules/ai/dto/migration-update.dto.ts
// DTO สำหรับ Admin อัปเดตสถานะ MigrationLog หลังตรวจสอบ

import { IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MigrationLogStatus } from '../entities/migration-log.entity';

export class MigrationUpdateDto {
  // สถานะใหม่ที่ต้องการเปลี่ยน (VERIFIED หรือ FAILED เท่านั้น)
  @ApiPropertyOptional({
    enum: [MigrationLogStatus.VERIFIED, MigrationLogStatus.FAILED],
    description: 'สถานะใหม่ (Admin สามารถเปลี่ยนได้เฉพาะ VERIFIED หรือ FAILED)',
  })
  @IsOptional()
  @IsEnum([MigrationLogStatus.VERIFIED, MigrationLogStatus.FAILED])
  status?: MigrationLogStatus;

  // ความเห็นของ Admin
  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'ความเห็นจาก Admin ผู้ตรวจสอบ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminFeedback?: string;
}
