// File: src/modules/distribution/services/approval-listener.service.ts
// Strangler Pattern — listens for RFA approval events and triggers distribution (T055)
import { Injectable, Logger } from '@nestjs/common';
import { DistributionService, DistributionJobPayload } from '../distribution.service';
import { ConsensusDecision } from '../../common/enums/review.enums';

/**
 * ApprovalListenerService — ถูกเรียกจาก ReviewTaskService หลัง consensus ถูกตัดสินใจ
 * ใช้ Strangler Pattern: ไม่แก้ไข rfaService.approve() โดยตรง
 */
@Injectable()
export class ApprovalListenerService {
  private readonly logger = new Logger(ApprovalListenerService.name);

  constructor(private readonly distributionService: DistributionService) {}

  /**
   * เรียกเมื่อ consensus ถูกตัดสินใจว่า APPROVED หรือ APPROVED_WITH_COMMENTS (FR-018)
   */
  async onConsensusReached(event: {
    rfaPublicId: string;
    rfaRevisionPublicId: string;
    projectId: number;
    documentTypeCode: string;
    responseCode: string;
    decision: ConsensusDecision;
    approvedAt: Date;
  }): Promise<void> {
    const shouldDistribute =
      event.decision === ConsensusDecision.APPROVED ||
      event.decision === ConsensusDecision.APPROVED_WITH_COMMENTS ||
      event.decision === ConsensusDecision.OVERRIDDEN;

    if (!shouldDistribute) {
      this.logger.log(
        `RFA ${event.rfaPublicId} decision = ${event.decision} — distribution skipped`,
      );
      return;
    }

    const payload: DistributionJobPayload = {
      rfaPublicId: event.rfaPublicId,
      rfaRevisionPublicId: event.rfaRevisionPublicId,
      projectId: event.projectId,
      documentTypeCode: event.documentTypeCode,
      responseCode: event.responseCode,
      approvedAt: event.approvedAt,
    };

    await this.distributionService.queueDistribution(payload);

    this.logger.log(
      `Distribution triggered for RFA ${event.rfaPublicId} (${event.decision})`,
    );
  }
}
