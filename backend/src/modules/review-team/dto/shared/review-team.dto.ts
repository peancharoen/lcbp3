// File: src/modules/review-team/dto/shared/review-team.dto.ts
// Shared DTOs สำหรับ Review Team และ Review Task APIs

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  IsUUID,
  IsDateString,
  IsInt,
  IsPositive,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ReviewTaskStatus,
  ReviewTeamMemberRole,
  DelegationScope,
} from '../../../common/enums/review.enums';

// ─── Review Team DTOs ──────────────────────────────────────────────────────

export class CreateReviewTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsUUID()
  projectPublicId!: string; // ADR-019: รับ publicId เสมอ

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultForRfaTypes?: string[]; // ['SDW', 'DDW', 'ADW']
}

export class UpdateReviewTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultForRfaTypes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddTeamMemberDto {
  @IsUUID()
  userPublicId!: string; // ADR-019

  @IsUUID()
  disciplinePublicId!: string; // ADR-019

  @IsEnum(ReviewTeamMemberRole)
  role!: ReviewTeamMemberRole;

  @IsOptional()
  @IsInt()
  @IsPositive()
  priorityOrder?: number;
}

export class SearchReviewTeamDto {
  @IsOptional()
  @IsUUID()
  projectPublicId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

// ─── Review Task DTOs ──────────────────────────────────────────────────────

export class CompleteReviewTaskDto {
  @IsUUID()
  responseCodePublicId!: string; // ADR-019: รับ publicId

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  attachmentPublicIds?: string[];
}

export class UpdateReviewTaskStatusDto {
  @IsEnum(ReviewTaskStatus)
  status!: ReviewTaskStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SearchReviewTaskDto {
  @IsOptional()
  @IsUUID()
  rfaRevisionPublicId?: string;

  @IsOptional()
  @IsEnum(ReviewTaskStatus)
  status?: ReviewTaskStatus;

  @IsOptional()
  @IsUUID()
  assignedToUserPublicId?: string;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;
}

// ─── Delegation DTOs ───────────────────────────────────────────────────────

export class CreateDelegationDto {
  @IsUUID()
  delegateePublicId!: string; // ADR-019

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsEnum(DelegationScope)
  scope!: DelegationScope;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentTypes?: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}

// ─── Veto Override DTO ─────────────────────────────────────────────────────

export class VetoOverrideDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  justification!: string; // PM ต้องระบุเหตุผลที่ชัดเจน (min 10 chars)
}
