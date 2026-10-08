import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'Username', example: 'john_doe' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({
    description: 'Password (min 6 chars)',
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;

  @ApiProperty({ description: 'Email address', example: 'john.d@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ description: 'First name', example: 'John' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Line ID', example: 'john.line' })
  @IsString()
  @IsOptional()
  lineId?: string;

  @ApiPropertyOptional({
    description: 'Primary Organization ID or UUID',
    example: 1,
  })
  @IsOptional()
  primaryOrganizationId?: number | string; // ADR-019: Accept INT or UUID

  @ApiPropertyOptional({
    description: 'Department ID or UUID (of primary org)',
  })
  @IsOptional()
  departmentId?: number | string; // ADR-019: Accept INT or UUID

  @ApiPropertyOptional({
    description: 'Position in primary org (free-text)',
    example: 'ผู้จัดการโครงการ',
  })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiPropertyOptional({ description: 'Is user active?', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Role IDs to assign (Global scope)',
    example: [1, 2],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  roleIds?: number[];

  @ApiPropertyOptional({
    description: 'Force password change on first login (SEV-014)',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  mustChangePassword?: boolean;
}
