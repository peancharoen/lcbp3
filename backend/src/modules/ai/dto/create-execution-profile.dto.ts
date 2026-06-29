// File: backend/src/modules/ai/dto/create-execution-profile.dto.ts
// Change Log:
// - 2026-06-14: Created CreateExecutionProfileDto for AI execution profile creation (conforming to task T008)

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateExecutionProfileDto {
  @ApiProperty({ description: 'Profile Name' })
  @IsNotEmpty()
  @IsString()
  profileName!: string;

  @ApiPropertyOptional({
    description: 'Canonical Model',
    enum: ['np-dms-ai', 'np-dms-ocr'],
  })
  @IsOptional()
  @IsString()
  canonicalModel?: 'np-dms-ai' | 'np-dms-ocr';

  @ApiProperty({ description: 'Temperature parameter' })
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  temperature!: number;

  @ApiProperty({ description: 'Top-P parameter' })
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  topP!: number;

  @ApiProperty({ description: 'Repeat penalty parameter' })
  @IsNumber()
  @Min(1.0)
  @Max(2.0)
  repeatPenalty!: number;

  @ApiPropertyOptional({ description: 'Maximum tokens to generate' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number | null;

  @ApiPropertyOptional({
    description: 'Context window size (num_ctx / ctxSize)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  ctxSize?: number | null;

  @ApiProperty({ description: 'Keep alive in seconds' })
  @IsInt()
  @Min(0)
  keepAlive!: number;
}
