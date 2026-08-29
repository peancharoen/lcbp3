// File: src/modules/rfa/dto/create-rfa-workflow.dto.ts
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
} from 'class-validator';
// ADR-049 review-fix: ใช้ RfaActionType จาก entities/rfa-action-type.ts (single source of truth)
import { RfaActionType } from '../entities/rfa-action-type';

export class CreateRfaWorkflowDto {
  @IsInt()
  @IsNotEmpty()
  stepNumber!: number;

  @IsInt()
  @IsNotEmpty()
  organizationId!: number;

  @IsInt()
  @IsOptional()
  assignedTo?: number;

  @IsEnum(RfaActionType)
  @IsOptional()
  actionType?: RfaActionType;

  @IsString()
  @IsOptional()
  comments?: string;
}
