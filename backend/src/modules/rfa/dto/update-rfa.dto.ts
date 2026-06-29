// File: src/modules/rfa/dto/update-rfa.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateRfaDto {
  @ApiPropertyOptional({ description: 'RFA Subject' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'Body' })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Due Date' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Additional Details (JSON)' })
  @IsObject()
  @IsOptional()
  details?: Record<string, unknown>;
}
