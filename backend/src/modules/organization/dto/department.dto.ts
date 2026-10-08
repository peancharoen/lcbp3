// File: backend/src/modules/organization/dto/department.dto.ts
// Change Log:
// - 2026-10-06: Initial creation — DTOs สำหรับ departments (User Grouping Model)

import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({
    description: 'Department code (unique per org)',
    example: 'QC',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  departmentCode!: string;

  @ApiProperty({ description: 'Department name', example: 'ฝ่ายควบคุมคุณภาพ' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  departmentName!: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ description: 'Department code (unique per org)' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  departmentCode?: string;

  @ApiPropertyOptional({ description: 'Department name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  departmentName?: string;

  @ApiPropertyOptional({ description: 'Is active?', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
