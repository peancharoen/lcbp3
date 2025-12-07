// File: src/modules/dashboard/dto/get-activity.dto.ts
// บันทึกการแก้ไข: สร้างใหม่สำหรับ Query params ของ Activity endpoint

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * DTO สำหรับ Query params ของ GET /dashboard/activity
 */
export class GetActivityDto {
  @ApiPropertyOptional({ description: 'จำนวนรายการที่ต้องการ', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

/**
 * DTO สำหรับ Response ของ Activity Item
 */
export class ActivityItemDto {
  @ApiPropertyOptional({ description: 'Action ที่กระทำ' })
  action!: string;

  @ApiPropertyOptional({ description: 'ประเภท Entity' })
  entityType?: string;

  @ApiPropertyOptional({ description: 'ID ของ Entity' })
  entityId?: string;

  @ApiPropertyOptional({ description: 'รายละเอียด' })
  details?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'วันที่กระทำ' })
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'ชื่อผู้ใช้' })
  username?: string;
}
