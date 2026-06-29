// File: src/modules/review-team/services/veto-override.service.ts
// PM Veto Override — บังคับผ่าน RFA Revision แม้มี Code 3 (T068.5)
import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ReviewTask } from '../entities/review-task.entity';
import { ApprovalListenerService } from '../../distribution/services/approval-listener.service';
import { ConsensusDecision } from '../../common/enums/review.enums';

export interface VetoOverrideDto {
  rfaRevisionId: number;
  rfaPublicId: string;
  rfaRevisionPublicId: string;
  projectId: number;
  documentTypeId?: number;
  documentTypeCode: string;
  overrideReason: string;
  overriddenByUserId: number;
}

@Injectable()
export class VetoOverrideService {
  private readonly logger = new Logger(VetoOverrideService.name);

  constructor(
    @InjectRepository(ReviewTask)
    private readonly taskRepo: Repository<ReviewTask>,
    private readonly approvalListenerService: ApprovalListenerService,
    private readonly dataSource: DataSource
  ) {}

  /**
   * PM Override: บังคับ APPROVED แม้ว่าจะมี Code 3 rejection (FR-012)
   * ต้องมี justification reason และ audit trail
   */
  async executeOverride(
    dto: VetoOverrideDto
  ): Promise<{ decision: ConsensusDecision }> {
    const tasks = await this.taskRepo.find({
      where: { rfaRevisionId: dto.rfaRevisionId },
      relations: ['responseCode'],
    });

    if (tasks.length === 0) {
      throw new NotFoundException(
        `No review tasks found for revision ${dto.rfaRevisionId}`
      );
    }

    const hasVeto = tasks.some((t) => t.responseCode?.code === '3');
    if (!hasVeto) {
      throw new ForbiddenException(
        'No Code 3 veto found — override not needed'
      );
    }

    if (!dto.overrideReason || dto.overrideReason.trim().length < 10) {
      throw new ForbiddenException(
        'Override reason must be at least 10 characters'
      );
    }

    this.logger.warn(
      `PM Override executed by user ${dto.overriddenByUserId} for revision ${dto.rfaRevisionId}. Reason: ${dto.overrideReason}`
    );

    await this.approvalListenerService.onConsensusReached({
      rfaPublicId: dto.rfaPublicId,
      rfaRevisionPublicId: dto.rfaRevisionPublicId,
      projectId: dto.projectId,
      documentTypeId: dto.documentTypeId,
      documentTypeCode: dto.documentTypeCode,
      responseCode: '1A',
      decision: ConsensusDecision.OVERRIDDEN,
      approvedAt: new Date(),
    });

    return { decision: ConsensusDecision.OVERRIDDEN };
  }
}
