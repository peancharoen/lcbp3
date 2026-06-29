import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ActionType {
  ADD = 'ADD',
  REMOVE = 'REMOVE',
}

export class AssignmentActionDto {
  @IsInt()
  userId!: number;

  @IsEnum(ActionType)
  action!: ActionType;

  // Add more fields if we need to update specific assignment properties
  // For now, we assume simple Add/Remove Role logic
  @IsInt()
  roleId!: number;

  @IsInt()
  @IsOptional()
  organizationId?: number;

  @IsInt()
  @IsOptional()
  projectId?: number;
}

export class BulkAssignmentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentActionDto)
  assignments!: AssignmentActionDto[];
}
