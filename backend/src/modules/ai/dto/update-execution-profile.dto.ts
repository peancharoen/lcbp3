// File: backend/src/modules/ai/dto/update-execution-profile.dto.ts
// Change Log:
// - 2026-06-14: Created UpdateExecutionProfileDto for AI execution profile updates (conforming to task T009)

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsInt, Min, Max } from 'class-validator';

export class UpdateExecutionProfileDto {
  @ApiPropertyOptional({ description: 'Temperature parameter' })
  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Top-P parameter' })
  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  topP?: number;

  @ApiPropertyOptional({ description: 'Repeat penalty parameter' })
  @IsOptional()
  @IsNumber()
  @Min(1.0)
  @Max(2.0)
  repeatPenalty?: number;

  @ApiPropertyOptional({ description: 'Maximum tokens to generate' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number | null;

  @ApiPropertyOptional({ description: 'Context window size' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ctxSize?: number | null;

  @ApiPropertyOptional({ description: 'Keep alive in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  keepAlive?: number;
}
