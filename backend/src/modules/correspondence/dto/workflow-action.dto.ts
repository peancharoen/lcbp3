import { IsEnum, IsString, IsOptional, IsInt } from 'class-validator';
import { WorkflowAction } from '../../workflow-engine/interfaces/workflow.interface.js';

export class WorkflowActionDto {
  @IsEnum(WorkflowAction)
  action!: WorkflowAction; // APPROVE, REJECT, RETURN, ACKNOWLEDGE

  @IsString()
  @IsOptional()
  comments?: string;

  @IsInt()
  @IsOptional()
  returnToSequence?: number; // ใช้กรณี action = RETURN
}
