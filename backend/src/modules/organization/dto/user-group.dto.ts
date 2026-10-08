// File: backend/src/modules/organization/dto/user-group.dto.ts
// Change Log:
// - 2026-10-06: Initial creation — DTOs สำหรับ user_groups (User Grouping Model)

import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserGroupDto {
  @ApiProperty({ description: 'Organization ID or UUID' })
  @IsNotEmpty()
  organizationId!: number | string; // ADR-019: Accept INT or UUID

  @ApiProperty({
    description: 'Group name (unique per org)',
    example: 'ทีม QC',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: 'Initial member user publicIds',
    type: [String],
  })
  @IsArray()
  @IsOptional()
  memberIds?: string[];
}

export class UpdateUserGroupDto {
  @ApiPropertyOptional({ description: 'Group name' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ description: 'Is active?', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
