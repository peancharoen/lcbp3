// File: src/modules/distribution/processors/distribution.processor.ts
// BullMQ Worker สำหรับประมวลผล Distribution jobs (T056, ADR-008)
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_DISTRIBUTION } from '../../common/constants/queue.constants';
import { DistributionJobPayload } from '../distribution.service';
import { TransmittalCreatorService } from '../services/transmittal-creator.service';
import { NotificationService } from '../../notification/notification.service';

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
      `Processing distribution for RFA ${payload.rfaPublicId} (${payload.documentTypeCode}, code ${payload.responseCode})`
    );

    // 1. สร้าง Transmittal records
    const result =
      await this.transmittalCreator.createFromDistribution(payload);

    this.logger.log(
      `Created ${result.transmittalPublicIds.length} transmittals for RFA ${payload.rfaPublicId}`
    );

    // 2. แจ้งเตือน submitter
    this.logger.log(`Distribution complete for RFA ${payload.rfaPublicId}`);
  }
}
