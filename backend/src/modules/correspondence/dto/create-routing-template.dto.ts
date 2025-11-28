// File: src/modules/correspondence/dto/create-routing-template.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoutingTemplateStepDto {
  @IsInt()
  @IsNotEmpty()
  sequence!: number;

  @IsInt()
  @IsNotEmpty()
  toOrganizationId!: number;

  @IsInt()
  @IsOptional()
  roleId?: number;

  @IsString()
  @IsOptional()
  stepPurpose?: string = 'FOR_REVIEW';

  @IsInt()
  @IsOptional()
  expectedDays?: number;
}

export class CreateRoutingTemplateDto {
  @IsString()
  @IsNotEmpty()
  templateName!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  projectId?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRoutingTemplateStepDto)
  steps!: CreateRoutingTemplateStepDto[];
}
