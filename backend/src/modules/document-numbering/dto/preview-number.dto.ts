// File: src/modules/document-numbering/dto/preview-number.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class PreviewNumberDto {
  @ApiProperty({ description: 'Project ID or UUID' })
  @IsNotEmpty()
  projectId!: number | string;

  @ApiProperty({ description: 'Originator organization ID or UUID' })
  @IsNotEmpty()
  originatorOrganizationId!: number | string;

  @ApiProperty({ description: 'Correspondence type ID' })
  @IsInt()
  @Type(() => Number)
  correspondenceTypeId!: number;

  @ApiPropertyOptional({ description: 'Sub type ID (for TRANSMITTAL)' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  subTypeId?: number;

  @ApiPropertyOptional({ description: 'RFA type ID (for RFA)' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  rfaTypeId?: number;

  @ApiPropertyOptional({ description: 'Discipline ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  disciplineId?: number;

  @ApiPropertyOptional({ description: 'Year (defaults to current)' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({ description: 'Recipient organization ID or UUID' })
  @IsOptional()
  recipientOrganizationId?: number | string;

  @ApiPropertyOptional({ description: 'Custom tokens' })
  @IsOptional()
  @IsObject()
  customTokens?: Record<string, string>;
}
