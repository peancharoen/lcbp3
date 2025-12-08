import { IsEnum, IsString, IsOptional, IsInt } from 'class-validator';
import { WorkflowAction } from '../../workflow-engine/interfaces/workflow.interface';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkflowActionDto {
  @ApiProperty({
    description: 'Workflow Action',
    enum: ['APPROVE', 'REJECT', 'RETURN', 'CANCEL', 'ACKNOWLEDGE'],
  })
  @IsEnum(WorkflowAction)
  action!: WorkflowAction; // APPROVE, REJECT, RETURN, ACKNOWLEDGE

  @ApiPropertyOptional({
    description: 'Review comments',
    example: 'Approved with note...',
  })
  @IsString()
  @IsOptional()
  comments?: string;

  @ApiPropertyOptional({
    description: 'Sequence to return to (only for RETURN action)',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  returnToSequence?: number; // ใช้กรณี action = RETURN
}
