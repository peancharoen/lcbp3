// File: backend/src/modules/ai/dto/migration-queue-item.dto.ts
// บันทึกการแก้ไข: สร้าง DTO สำหรับ Legacy Migration (T029) ตาม ADR-023A

import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MigrationQueueItemDto {
  @ApiProperty({
    description: 'n8n batch identifier',
    example: 'batch-2026-05-15',
  })
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @ApiProperty({ description: 'ชื่อไฟล์ต้นฉบับ', example: 'INV-2026-001.pdf' })
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @ApiProperty({
    description: 'เส้นทางไฟล์ชั่วคราวใน storage',
    example: 'temp/migration/batch-1/INV-001.pdf',
  })
  @IsString()
  @IsNotEmpty()
  tempPath!: string;

  @ApiProperty({ description: 'UUID ของโครงการ (ถ้าทราบ)', required: false })
  @IsOptional()
  @IsUUID()
  projectPublicId?: string;
}
