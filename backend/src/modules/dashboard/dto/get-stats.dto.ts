// File: src/modules/dashboard/dto/get-stats.dto.ts
// Change Log:
// - Created DTO for Dashboard stats query parameters

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO สำหรับ Query params ของ GET /dashboard/stats
 */
export class GetStatsDto {
  @ApiPropertyOptional({ description: 'ID ของโครงการ (UUID)' })
  @IsOptional()
  @IsString()
  projectId?: string;
}
