// File: src/modules/dashboard/dto/get-pending.dto.ts
// บันทึกการแก้ไข: สร้างใหม่สำหรับ Query params ของ Pending endpoint

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * DTO สำหรับ Query params ของ GET /dashboard/pending
 */
export class GetPendingDto {
  @ApiPropertyOptional({ description: 'หน้าที่ต้องการ', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'จำนวนรายการต่อหน้า', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

/**
 * DTO สำหรับ Response ของ Pending Task Item
 */
export class PendingTaskItemDto {
  @ApiPropertyOptional({ description: 'Instance ID ของ Workflow' })
  instanceId!: string;

  @ApiPropertyOptional({ description: 'Workflow Code' })
  workflowCode!: string;

  @ApiPropertyOptional({ description: 'State ปัจจุบัน' })
  currentState!: string;

  @ApiPropertyOptional({ description: 'ประเภทเอกสาร' })
  entityType!: string;

  @ApiPropertyOptional({ description: 'ID ของเอกสาร' })
  entityId!: string;

  @ApiPropertyOptional({ description: 'เลขที่เอกสาร' })
  documentNumber!: string;

  @ApiPropertyOptional({ description: 'หัวข้อเรื่อง' })
  subject!: string;

  @ApiPropertyOptional({ description: 'วันที่ได้รับมอบหมาย' })
  assignedAt!: Date;
}
