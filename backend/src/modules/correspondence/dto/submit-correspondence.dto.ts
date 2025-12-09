import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for submitting correspondence to workflow
 * Uses Unified Workflow Engine - no templateId required
 */
export class SubmitCorrespondenceDto {
  @ApiPropertyOptional({
    description: 'Optional note for the submission',
    example: 'Submitting for review',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
