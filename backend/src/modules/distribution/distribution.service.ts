// File: src/modules/distribution/distribution.service.ts
// Change Log
// - 2026-05-14: Carry canonical documentTypeId in queue payload while preserving legacy code metadata.
// Enqueue distribution jobs เมื่อ RFA ได้รับการอนุมัติ (T054)
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_DISTRIBUTION } from '../common/constants/queue.constants';

export interface DistributionJobPayload {
  rfaPublicId: string;
  rfaRevisionPublicId: string;
  projectId: number;
  documentTypeId?: number;
  documentTypeCode?: string;
  responseCode: string;
  approvedAt: Date;
}

@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);

  constructor(
    @InjectQueue(QUEUE_DISTRIBUTION)
    private readonly distributionQueue: Queue
  ) {}

  /**
   * Queue distribution job สำหรับ RFA ที่ผ่านการอนุมัติ (FR-018)
   */
  async queueDistribution(payload: DistributionJobPayload): Promise<void> {
    await this.distributionQueue.add('process-distribution', payload, {
      removeOnComplete: true,
      removeOnFail: 100,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    this.logger.log(
      `Distribution queued for RFA ${payload.rfaPublicId} (code: ${payload.responseCode})`
    );
  }

  /**
   * ตรวจสอบสถานะ distribution jobs ของ RFA
   */
  async getJobStatus(
    _rfaPublicId: string
  ): Promise<{ pending: number; completed: number }> {
    const [waiting, active] = await Promise.all([
      this.distributionQueue.getWaitingCount(),
      this.distributionQueue.getActiveCount(),
    ]);

    return { pending: waiting + active, completed: 0 };
  }
}
