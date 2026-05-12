// File: src/modules/rfa/dto/submit-rfa.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class SubmitRfaDto {
  @ApiProperty({
    description: 'ID ของ Routing Template ที่จะใช้เดินเรื่อง',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  templateId!: number;

  @ApiProperty({
    description: 'publicId ของ Review Team สำหรับ Parallel Review (ADR-019)',
    example: '019505a1-7c3e-7000-8000-abc123def456',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  reviewTeamPublicId?: string;
}
