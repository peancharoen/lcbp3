// File: src/modules/review-team/services/consensus.service.ts
// Evaluate parallel review consensus และ trigger distribution (T068, FR-010)
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewTask } from '../entities/review-task.entity';
import { AggregateStatusService } from './aggregate-status.service';
import { ApprovalListenerService } from '../../distribution/services/approval-listener.service';
import { ConsensusDecision, ReviewTaskStatus } from '../../common/enums/review.enums';

export interface ConsensusResult {
  decision: ConsensusDecision;
  completedTasks: number;
  totalTasks: number;
  triggeredDistribution: boolean;
}

@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);

  constructor(
    @InjectRepository(ReviewTask)
    private readonly taskRepo: Repository<ReviewTask>,
    private readonly aggregateStatusService: AggregateStatusService,
    private readonly approvalListenerService: ApprovalListenerService,
  ) {}

  /**
   * เรียกหลัง task complete — ตรวจสอบ consensus และ trigger distribution (FR-010)
   */
  async evaluateAfterTaskComplete(
    rfaRevisionId: number,
    context: {
      rfaPublicId: string;
      rfaRevisionPublicId: string;
      projectId: number;
      documentTypeCode: string;
    },
  ): Promise<ConsensusResult> {
    const isReady = await this.aggregateStatusService.isReadyForConsensus(rfaRevisionId);

    const status = await this.aggregateStatusService.getForRevision(rfaRevisionId);

    if (!isReady) {
      this.logger.debug(
        `Revision ${rfaRevisionId}: ${status.completed}/${status.total} tasks done — not ready for consensus`,
      );
      return {
        decision: ConsensusDecision.PENDING,
        completedTasks: status.completed,
        totalTasks: status.total,
        triggeredDistribution: false,
      };
    }

    const decision = await this.aggregateStatusService.evaluateConsensus(rfaRevisionId);

    this.logger.log(
      `Revision ${rfaRevisionId}: consensus = ${decision} (${status.total} tasks)`,
    );

    let triggeredDistribution = false;
    if (
      decision === ConsensusDecision.APPROVED ||
      decision === ConsensusDecision.APPROVED_WITH_COMMENTS
    ) {
      // ดึง response code ที่ predominant
      const completedTasks = await this.taskRepo.find({
        where: { rfaRevisionId, status: ReviewTaskStatus.COMPLETED },
        relations: ['responseCode'],
        order: { completedAt: 'DESC' },
        take: 1,
      });

      const responseCode = completedTasks[0]?.responseCode?.code ?? '1A';

      await this.approvalListenerService.onConsensusReached({
        ...context,
        responseCode,
        decision,
        approvedAt: new Date(),
      });

      triggeredDistribution = true;
    }

    return {
      decision,
      completedTasks: status.completed,
      totalTasks: status.total,
      triggeredDistribution,
    };
  }
}
