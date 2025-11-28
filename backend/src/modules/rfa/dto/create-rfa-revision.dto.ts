// File: src/modules/rfa/dto/create-rfa-revision.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsDateString,
  IsObject,
  IsArray,
} from 'class-validator';

export class CreateRfaRevisionDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsInt()
  @IsNotEmpty()
  rfaStatusCodeId!: number;

  @IsInt()
  @IsOptional()
  rfaApproveCodeId?: number;

  @IsDateString()
  @IsOptional()
  documentDate?: string;

  @IsDateString()
  @IsOptional()
  issuedDate?: string;

  @IsDateString()
  @IsOptional()
  receivedDate?: string;

  @IsDateString()
  @IsOptional()
  approvedDate?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  details?: Record<string, any>;

  @IsArray()
  @IsOptional()
  shopDrawingRevisionIds?: number[]; // IDs of linked Shop Drawings
}
