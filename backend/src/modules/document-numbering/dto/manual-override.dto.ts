import {
  IsNumber,
  IsString,
  IsNotEmpty,
  Min,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CounterKeyDto } from './counter-key.dto';

export class ManualOverrideDto extends CounterKeyDto {
  @ApiProperty({ example: 10, description: 'New last number value' })
  @IsNumber()
  @Min(0)
  newLastNumber!: number;

  @ApiProperty({
    example: 'Correction due to system error',
    description: 'Reason for override',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({
    example: 'ADMIN-001',
    description: 'Reference ticket or user',
    required: false,
  })
  @IsString()
  @IsOptional()
  reference?: string;
}
