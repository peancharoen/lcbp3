// File: src/modules/ai/intent-classifier/dto/update-intent-pattern.dto.ts
// Change Log
// - 2026-05-19: สร้าง DTO สำหรับ update Intent Pattern (ADR-024).

import {
  IsString,
  IsEnum,
  IsInt,
  IsBoolean,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import {
  PatternType,
  PatternLanguage,
} from '../interfaces/intent-category.enum';

/**
 * DTO สำหรับ update Intent Pattern
 * ใช้กับ PATCH /admin/ai/intent-patterns/:publicId
 */
export class UpdateIntentPatternDto {
  @IsOptional()
  @IsEnum(PatternLanguage)
  language?: PatternLanguage;

  @IsOptional()
  @IsEnum(PatternType)
  patternType?: PatternType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  patternValue?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
