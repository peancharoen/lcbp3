import { IsEnum, IsString, IsOptional, IsUUID, IsInt } from 'class-validator';
import { WorkflowAction } from '../../workflow-engine/interfaces/workflow.interface';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for processing workflow actions
 *
 * Supports both:
 * - New Unified Workflow Engine (uses instanceId)
 * - Legacy RFA workflow (uses returnToSequence)
 */
export class WorkflowActionDto {
  @ApiPropertyOptional({
    description: 'Workflow Instance ID (UUID) - for Unified Workflow Engine',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  instanceId?: string;

  @ApiProperty({
    description: 'Workflow Action',
    enum: ['APPROVE', 'REJECT', 'RETURN', 'CANCEL', 'ACKNOWLEDGE'],
  })
  @IsEnum(WorkflowAction)
  action!: WorkflowAction;

  @ApiPropertyOptional({
    description: 'Review comments',
    example: 'Approved with note...',
  })
  @IsString()
  @IsOptional()
  comment?: string;

  /**
   * @deprecated Use 'comment' instead
   */
  @ApiPropertyOptional({
    description: 'Review comments (deprecated, use comment)',
    example: 'Approved with note...',
  })
  @IsString()
  @IsOptional()
  comments?: string;

  @ApiPropertyOptional({
    description: 'Sequence to return to (only for RETURN action in legacy RFA)',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  returnToSequence?: number;

  @ApiPropertyOptional({
    description: 'Additional payload data',
    example: { priority: 'HIGH' },
  })
  @IsOptional()
  payload?: Record<string, unknown>;
}
