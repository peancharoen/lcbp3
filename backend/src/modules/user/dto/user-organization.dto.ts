// File: backend/src/modules/user/dto/user-organization.dto.ts
// Change Log:
// - 2026-10-06: Initial creation — DTO สำหรับ user_organizations membership (User Grouping Model)

import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddUserOrganizationDto {
  @ApiProperty({ description: 'Organization ID or UUID' })
  @IsNotEmpty()
  organizationId!: number | string; // ADR-019: Accept INT or UUID

  @ApiPropertyOptional({ description: 'Department ID or UUID (in that org)' })
  @IsOptional()
  departmentId?: number | string; // ADR-019: Accept INT or UUID

  @ApiPropertyOptional({
    description: 'Position in that org (free-text)',
    example: 'ผู้จัดการโครงการ',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  position?: string;

  @ApiPropertyOptional({
    description: 'Set as primary org (syncs users.primary_organization_id)',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class UpdateUserOrganizationDto {
  @ApiPropertyOptional({ description: 'Department ID or UUID (in that org)' })
  @IsOptional()
  departmentId?: number | string;

  @ApiPropertyOptional({ description: 'Position in that org (free-text)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  position?: string;

  @ApiPropertyOptional({
    description: 'Set as primary org (syncs users.primary_organization_id)',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
