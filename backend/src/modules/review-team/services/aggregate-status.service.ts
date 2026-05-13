// File: src/modules/review-team/services/aggregate-status.service.ts
// คำนวณสถานะรวมของ Review Tasks ภายใน RFA Revision (T067, FR-009)
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewTask } from '../entities/review-task.entity';
import {
  ReviewTaskStatus,
  ConsensusDecision,
} from '../../common/enums/review.enums';

export interface AggregateStatus {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  delegated: number;
  expired: number;
  completionPct: number;
  isAllComplete: boolean;
  hasExpired: boolean;
}

@Injectable()
export class AggregateStatusService {
  private readonly logger = new Logger(AggregateStatusService.name);

  constructor(
    @InjectRepository(ReviewTask)
    private readonly taskRepo: Repository<ReviewTask>
  ) {}

  /**
   * คำนวณสถานะรวมของทุก Review Tasks ใน RFA Revision (FR-009)
   */
  async getForRevision(rfaRevisionId: number): Promise<AggregateStatus> {
    const tasks = await this.taskRepo.find({
      where: { rfaRevisionId },
      select: ['id', 'status'],
    });

    const counts = {
      total: tasks.length,
      completed: 0,
      pending: 0,
      inProgress: 0,
      delegated: 0,
      expired: 0,
    };

    for (const task of tasks) {
      switch (task.status) {
        case ReviewTaskStatus.COMPLETED:
          counts.completed++;
          break;
        case ReviewTaskStatus.PENDING:
          counts.pending++;
          break;
        case ReviewTaskStatus.IN_PROGRESS:
          counts.inProgress++;
          break;
        case ReviewTaskStatus.DELEGATED:
          counts.delegated++;
          break;
        case ReviewTaskStatus.EXPIRED:
          counts.expired++;
          break;
        default:
          break;
      }
    }

    const completionPct =
      counts.total > 0
        ? Math.round((counts.completed / counts.total) * 100)
        : 0;

    return {
      ...counts,
      completionPct,
      isAllComplete: counts.total > 0 && counts.completed === counts.total,
      hasExpired: counts.expired > 0,
    };
  }

  /**
   * ตรวจสอบว่า RFA Revision พร้อมสำหรับ consensus หรือยัง (FR-010)
   */
  async isReadyForConsensus(rfaRevisionId: number): Promise<boolean> {
    const status = await this.getForRevision(rfaRevisionId);
    return status.isAllComplete;
  }

  /**
   * Determine consensus based on response codes of completed tasks (FR-010)
   */
  async evaluateConsensus(rfaRevisionId: number): Promise<ConsensusDecision> {
    const tasks = await this.taskRepo.find({
      where: { rfaRevisionId, status: ReviewTaskStatus.COMPLETED },
      relations: ['responseCode'],
    });

    if (tasks.length === 0) return ConsensusDecision.PENDING;

    // Veto check: any Code 3 = REJECTED
    const hasVeto = tasks.some((t) => t.responseCode?.code === '3');
    if (hasVeto) return ConsensusDecision.REJECTED;

    // All approved: Code 1A or 1B = APPROVED
    const allApproved = tasks.every((t) =>
      ['1A', '1B'].includes(t.responseCode?.code ?? '')
    );
    if (allApproved) return ConsensusDecision.APPROVED;

    // Any Code 2 = APPROVED_WITH_COMMENTS
    const hasComments = tasks.some((t) => t.responseCode?.code === '2');
    if (hasComments) return ConsensusDecision.APPROVED_WITH_COMMENTS;

    return ConsensusDecision.APPROVED_WITH_COMMENTS;
  }
}
