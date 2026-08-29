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
    enum: Object.values(WorkflowAction),
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

  // ADR-049 T018: Approve code for terminal RFA transitions (1=Approved, 2=Approved with Comments, 3=Revise Required, 4=Rejected)
  @ApiPropertyOptional({
    description: 'ADR-049: Approve code for RFA terminal transitions (1/2/3/4)',
    example: '1',
  })
  @IsString()
  @IsOptional()
  approveCode?: string;

  // ADR-049 T018: Consent reason code for CONSULTANT consent metadata (no state effect)
  @ApiPropertyOptional({
    description:
      'ADR-049: Consent reason code (NO_OBJECTION, COMMENTS_PROVIDED, etc.) — metadata only',
    example: 'NO_OBJECTION',
  })
  @IsString()
  @IsOptional()
  consentReasonCode?: string;

  // ADR-049 T030: Impersonation — UUID ของ handler ดั้งเดิมที่ admin ทำแทน
  @ApiPropertyOptional({
    description:
      'ADR-049: UUID ของ handler ดั้งเดิมที่ admin (Superadmin/Org Admin) ทำแทน',
    example: '019505a1-7c3e-7000-8000-owner001',
  })
  @IsUUID()
  @IsOptional()
  impersonatedUserId?: string;

  // ADR-049 review-fix: เหตุผลในการทำแทน (audit metadata — เก็บใน workflow_histories.metadata)
  @ApiPropertyOptional({
    description:
      'ADR-049: เหตุผลในการทำ action แทน (audit metadata — เก็บใน workflow_histories.metadata.impersonationReason)',
    example: 'Owner ลาพัก 3 วัน มอบหมายให้ดำเนินการแทน',
  })
  @IsString()
  @IsOptional()
  impersonationReason?: string;
}
