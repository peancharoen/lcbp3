import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsDateString,
  IsObject,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRfaRevisionDto {
  @ApiProperty({ description: 'RFA Title', example: 'RFA for Building A' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'RFA Status Code ID', example: 1 })
  @IsInt()
  @IsNotEmpty()
  rfaStatusCodeId!: number;

  @ApiPropertyOptional({ description: 'RFA Approve Code ID', example: 1 })
  @IsInt()
  @IsOptional()
  rfaApproveCodeId?: number;

  @ApiPropertyOptional({
    description: 'Document Date',
    example: '2025-12-06T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  documentDate?: string;

  @ApiPropertyOptional({
    description: 'Issued Date',
    example: '2025-12-06T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  issuedDate?: string;

  @ApiPropertyOptional({
    description: 'Received Date',
    example: '2025-12-06T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  receivedDate?: string;

  @ApiPropertyOptional({
    description: 'Approved Date',
    example: '2025-12-06T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  approvedDate?: string;

  @ApiPropertyOptional({
    description: 'Description',
    example: 'Details about the RFA...',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Additional Details (JSON)',
    example: { key: 'value' },
  })
  @IsObject()
  @IsOptional()
  details?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Linked Shop Drawing Revision IDs',
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  shopDrawingRevisionIds?: number[]; // IDs of linked Shop Drawings
}
