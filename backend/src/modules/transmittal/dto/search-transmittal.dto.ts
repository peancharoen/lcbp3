import { IsInt, IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { TransmittalPurpose } from './create-transmittal.dto';

export class SearchTransmittalDto {
  @IsUUID('all')
  @IsOptional()
  projectUuid?: string; // ADR-019: Public UUID of the project

  /** @internal Resolved INT ID — set by controller, do NOT expose in API */
  projectId?: number;

  @IsEnum(TransmittalPurpose)
  @IsOptional()
  purpose?: TransmittalPurpose;

  @IsString()
  @IsOptional()
  search?: string; // ค้นหาจากเลขที่เอกสาร หรือ remarks

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit: number = 20;
}
