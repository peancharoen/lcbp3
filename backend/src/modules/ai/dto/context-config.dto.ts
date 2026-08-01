// File: backend/src/modules/ai/dto/context-config.dto.ts
// Change Log:
// - 2026-06-14: Created ContextConfigDto for prompt context management (conforming to task T006)
// - 2026-07-31: DTO hardening (Feature-237 review) — @IsUUID, @ValidateNested, @Max, @IsEnum

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsObject,
  Min,
  Max,
  IsUUID,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * ภาษาที่รองรับสำหรับ Context Config (FR-020)
 */
export const CONTEXT_LANGUAGES = ['th', 'en', 'mixed'] as const;
export type ContextLanguage = (typeof CONTEXT_LANGUAGES)[number];

/**
 * Filter สำหรับกรอง Master Data Context ตามโครงการ/สัญญา
 * เก็บค่าเป็น public UUID string (ADR-019) — service จะ resolve เป็น internal ID เอง
 *
 * รองรับทั้งชื่อ field แบบใหม่ (projectPublicId/contractPublicId)
 * และชื่อเดิม (projectId/contractId) เพื่อ backward compatibility
 */
export class ContextFilterDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Project public UUID (ADR-019) — ใช้ projectPublicId หรือ projectId (legacy)',
  })
  @IsOptional()
  @IsUUID('7')
  projectPublicId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Contract public UUID (ADR-019) — ใช้ contractPublicId หรือ contractId (legacy)',
  })
  @IsOptional()
  @IsUUID('7')
  contractPublicId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Legacy alias สำหรับ projectPublicId (backward compat)',
  })
  @IsOptional()
  @IsUUID('7')
  projectId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Legacy alias สำหรับ contractPublicId (backward compat)',
  })
  @IsOptional()
  @IsUUID('7')
  contractId?: string | null;
}

/**
 * Context Config สำหรับ Prompt Version (FR-020)
 * - pageSize: 1-1000
 * - language/outputLanguage: enum th|en|mixed
 * - filter: nested validation สำหรับ project/contract public UUID
 */
export class ContextConfigDto {
  @ApiPropertyOptional({ type: ContextFilterDto, nullable: true })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ContextFilterDto)
  filter?: ContextFilterDto | null;

  @ApiProperty({ type: Number, minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize!: number;

  @ApiProperty({ type: String, enum: CONTEXT_LANGUAGES })
  @IsEnum(CONTEXT_LANGUAGES)
  language!: ContextLanguage;

  @ApiProperty({ type: String, enum: CONTEXT_LANGUAGES })
  @IsEnum(CONTEXT_LANGUAGES)
  outputLanguage!: ContextLanguage;
}
