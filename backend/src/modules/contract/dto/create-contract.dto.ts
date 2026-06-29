import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  Length,
  IsInt,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContractDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  projectId!: number;

  @ApiProperty({ example: 'C-001' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  contractCode!: string;

  @ApiProperty({ example: 'Main Construction Contract' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  contractName!: string;

  @ApiProperty({ example: 'Description of the contract', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-01-01', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string; // Receive as string, TypeORM handles date

  @ApiProperty({ example: '2025-12-31', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
