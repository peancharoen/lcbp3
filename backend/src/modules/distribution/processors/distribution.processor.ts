// File: src/modules/distribution/processors/distribution.processor.ts
// Change Log
// - 2026-05-14: Notify direct USER recipients after Distribution processing.
// BullMQ Worker สำหรับประมวลผล Distribution jobs (T056, ADR-008)
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_DISTRIBUTION } from '../../common/constants/queue.constants';
import { DistributionJobPayload } from '../distribution.service';
import { TransmittalCreatorService } from '../services/transmittal-creator.service';
import { NotificationService } from '../../notification/notification.service';
import { DeliveryMethod } from '../../common/enums/review.enums';

@Processor(QUEUE_DISTRIBUTION)
export class DistributionProcessor extends WorkerHost {
  private readonly logger = new Logger(DistributionProcessor.name);

  constructor(
    private readonly transmittalCreator: TransmittalCreatorService,
    private readonly notificationService: NotificationService
  ) {
    super();
  }

  async process(job: Job<DistributionJobPayload>): Promise<void> {
    const payload = job.data;

    this.logger.log(
      `Processing distribution for RFA ${payload.rfaPublicId} (${payload.documentTypeId ?? payload.documentTypeCode}, code ${payload.responseCode})`
    );

    // 1. สร้าง Transmittal records
    const result =
      await this.transmittalCreator.createFromDistribution(payload);

    this.logger.log(
      `Created ${result.transmittalPublicIds.length} transmittals for RFA ${payload.rfaPublicId}`
    );

    await Promise.all(
      result.notificationTargets.flatMap((target) => {
        const base = {
          userId: target.userId,
          title: `RFA ${payload.responseCode} distributed`,
          message: `RFA ${payload.rfaPublicId} has been distributed after approval.`,
          entityType: 'rfa',
          link: `/rfa/${payload.rfaPublicId}`,
        };
        if (target.deliveryMethod === DeliveryMethod.BOTH) {
          return [
            this.notificationService.send({ ...base, type: 'SYSTEM' }),
            this.notificationService.send({ ...base, type: 'EMAIL' }),
          ];
        }
        return [
          this.notificationService.send({
            ...base,
            type:
              target.deliveryMethod === DeliveryMethod.EMAIL
                ? 'EMAIL'
                : 'SYSTEM',
          }),
        ];
      })
    );

    this.logger.log(`Distribution complete for RFA ${payload.rfaPublicId}`);
  }
}
