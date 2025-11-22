import {
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransmittalPurpose } from './create-transmittal.dto';

export class SearchTransmittalDto {
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  projectId!: number; // บังคับระบุ Project

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
  pageSize: number = 20;
}
