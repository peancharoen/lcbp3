// File: backend/src/modules/ai/dto/context-config.dto.ts
// Change Log:
// - 2026-06-14: Created ContextConfigDto for prompt context management (conforming to task T006)

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsObject, Min } from 'class-validator';

export class ContextFilterDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  projectId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  contractId!: string | null;
}

export class ContextConfigDto {
  @ApiPropertyOptional({ type: ContextFilterDto, nullable: true })
  @IsOptional()
  @IsObject()
  filter?: ContextFilterDto | null;

  @ApiProperty({ type: Number, minimum: 1 })
  @IsInt()
  @Min(1)
  pageSize!: number;

  @ApiProperty({ type: String })
  @IsString()
  language!: string;

  @ApiProperty({ type: String })
  @IsString()
  outputLanguage!: string;
}
