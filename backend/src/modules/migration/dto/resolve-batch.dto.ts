// File: backend/src/modules/migration/dto/resolve-batch.dto.ts
// Change Log:
// - 2026-08-06: Initial creation — batch scope request for resolve-batch endpoint (Feature 242, FR-020, FR-020a)

import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Request body สำหรับ POST /api/migration/resolve-batch (FR-020, FR-020a)
 * ถ้าไม่ระบุ batchId จะประมวลผลทุกรายการที่ยัง pending
 */
export class ResolveBatchDto {
  @ApiPropertyOptional({
    description:
      'Import batch identifier; omit to process all pending records (FR-020a)',
    example: 'TIER1-2026-08-06-001',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  batchId?: string;
}
