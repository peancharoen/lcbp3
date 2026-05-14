// File: src/modules/response-code/dto/update-response-code.dto.ts
// Change Log:
// - 2026-05-13: Add DTO for updating response codes by publicId.

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ResponseCodeCategory } from '../../common/enums/review.enums';

export class UpdateResponseCodeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  subStatus?: string;

  @IsOptional()
  @IsEnum(ResponseCodeCategory)
  category?: ResponseCodeCategory;

  @IsOptional()
  @IsString()
  descriptionTh?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsObject()
  implications?: {
    affectsSchedule?: boolean;
    affectsCost?: boolean;
    requiresContractReview?: boolean;
    requiresEiaAmendment?: boolean;
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notifyRoles?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
