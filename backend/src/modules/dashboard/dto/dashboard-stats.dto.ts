// File: src/modules/dashboard/dto/dashboard-stats.dto.ts
// บันทึกการแก้ไข: สร้างใหม่สำหรับ Dashboard Stats Response

import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO สำหรับ Response ของ Dashboard Statistics
 */
export class DashboardStatsDto {
  @ApiProperty({ description: 'จำนวนเอกสารทั้งหมด', example: 150 })
  totalDocuments!: number;

  @ApiProperty({ description: 'จำนวนเอกสารเดือนนี้', example: 25 })
  documentsThisMonth!: number;

  @ApiProperty({ description: 'จำนวนงานที่รออนุมัติ', example: 12 })
  pendingApprovals!: number;

  @ApiProperty({ description: 'จำนวนเอกสารที่อนุมัติแล้ว', example: 100 })
  approved!: number;

  @ApiProperty({ description: 'จำนวน RFA ทั้งหมด', example: 45 })
  totalRfas!: number;

  @ApiProperty({ description: 'จำนวน Circulation ทั้งหมด', example: 30 })
  totalCirculations!: number;
}
