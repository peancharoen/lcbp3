// File: backend/src/modules/document/processors/bulk-operations.processor.ts
// Change Log:
// - 2026-09-07: BullMQ WorkerHost for durable bulk operations (cancel/tag/export)

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_BULK_OPERATIONS } from '../../../modules/common/constants/queue.constants';
import { DocumentService } from '../document.service';
import type { BulkOperationJobData } from '../document.service';

/**
 * Processor สำหรับประมวลผล bulk operations แบบ durable
 * รับ job จาก BullMQ queue แล้ว dispatch ไปยัง DocumentService
 */
@Processor(QUEUE_BULK_OPERATIONS, {
  concurrency: 3,
})
export class BulkOperationsProcessor extends WorkerHost {
  private readonly logger = new Logger(BulkOperationsProcessor.name);

  constructor(private readonly documentService: DocumentService) {
    super();
  }

  async process(job: Job<BulkOperationJobData>): Promise<void> {
    const { type } = job.data;
    this.logger.log(
      `Bulk operation job started — jobId=${String(job.id)}, type=${type}, bulkId=${job.data.bulkId}`
    );

    switch (type) {
      case 'cancel':
        await this.documentService.processCancelJob(job.data);
        break;
      case 'tag':
        await this.documentService.processTagJob(job.data);
        break;
      case 'export':
        await this.documentService.processExportJob(job.data);
        break;
      default:
        this.logger.warn(`Unknown bulk operation type: ${String(type)}`);
    }

    this.logger.log(
      `Bulk operation job completed — jobId=${String(job.id)}, type=${type}, bulkId=${job.data.bulkId}`
    );
  }
}
