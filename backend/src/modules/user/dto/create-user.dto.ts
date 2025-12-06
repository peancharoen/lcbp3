import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsBoolean,
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

  @ApiPropertyOptional({ description: 'Primary Organization ID', example: 1 })
  @IsInt()
  @IsOptional()
  primaryOrganizationId?: number; // รับเป็น ID ของ Organization

  @ApiPropertyOptional({ description: 'Is user active?', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
