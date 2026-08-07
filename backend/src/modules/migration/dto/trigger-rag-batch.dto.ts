// File: backend/src/modules/migration/dto/trigger-rag-batch.dto.ts
// Change Log:
// - 2026-08-06: Initial creation — batch scope request for trigger-rag-batch endpoint (Feature 242, FR-026, FR-026a)

import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Request body สำหรับ POST /api/migration/trigger-rag-batch (FR-026, FR-026a)
 * ถ้าไม่ระบุ batchId จะประมวลผลทุก attachment ที่ยัง pending
 */
export class TriggerRagBatchDto {
  @ApiPropertyOptional({
    description:
      'Import batch identifier; omit to process all pending attachments (FR-026a)',
    example: 'TIER1-2026-08-06-001',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  batchId?: string;
}
