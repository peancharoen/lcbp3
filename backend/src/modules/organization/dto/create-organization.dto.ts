import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'ITD' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  organizationCode!: string;

  @ApiProperty({ example: 'Italian-Thai Development' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  organizationName!: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  roleId?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
