// File: src/modules/rfa/dto/submit-rfa.dto.ts
// Change Log:
// - 2026-06-14: ตัด templateId ออก — ย้ายไปใช้ Unified Workflow Engine (ADR-001)
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SubmitRfaDto {
  @ApiProperty({
    description: 'publicId ของ Review Team สำหรับ Parallel Review (ADR-019)',
    example: '019505a1-7c3e-7000-8000-abc123def456',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  reviewTeamPublicId?: string;
}
