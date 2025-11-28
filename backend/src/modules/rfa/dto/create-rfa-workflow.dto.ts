// File: src/modules/rfa/dto/create-rfa-workflow.dto.ts
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
} from 'class-validator';

export enum RfaActionType {
  REVIEW = 'REVIEW',
  APPROVE = 'APPROVE',
  ACKNOWLEDGE = 'ACKNOWLEDGE',
}

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

