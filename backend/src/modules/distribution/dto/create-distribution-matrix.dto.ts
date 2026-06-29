// File: src/modules/distribution/dto/create-distribution-matrix.dto.ts
// Change Log
// - 2026-05-14: Add validated DTO for Distribution Matrix creation.
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class DistributionConditionsDto {
  @IsOptional()
  @IsString({ each: true })
  codes?: string[];

  @IsOptional()
  @IsString({ each: true })
  excludeCodes?: string[];
}

export class CreateDistributionMatrixDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsUUID()
  projectPublicId?: string;

  @IsInt()
  documentTypeId!: number;

  @IsOptional()
  @IsUUID()
  responseCodePublicId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DistributionConditionsDto)
  conditions?: DistributionConditionsDto;
}
