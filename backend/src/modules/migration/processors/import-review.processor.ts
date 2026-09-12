// File: backend/src/modules/migration/processors/import-review.processor.ts
// Change Log:
// - 2026-09-12: Initial creation — BullMQ processor สำหรับ Excel Import Review
//   background processing (ADR-008, ADR-052). รับ job จาก queue import-review
//   แล้วเรียก ExcelDataReviewService.processCheck() เพื่อรัน 4-Layer review
//   ใน background — แก้ปัญหา axios timeout 15s ไม่พอสำหรับ AI review 265+ แถว

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_IMPORT_REVIEW } from '../../common/constants/queue.constants';
import { ExcelDataReviewService } from '../services/excel-data-review.service';

/**
 * ImportReviewProcessor — BullMQ worker สำหรับ Excel Import Review (ADR-008)
 *
 * รับ job จาก queue `import-review` แล้วเรียก processCheck() เพื่อ:
 * - อ่านไฟล์จาก stash
 * - รัน Layer 1 (Schema) + Layer 2 (Business Rules) + Layer 3 (AI Reviewer)
 * - สร้างไฟล์ annotated .xlsx
 * - อัปเดต session ใน Redis ด้วย result + status
 *
 * concurrency=1 เพราะ AI review ใช้ GPU (Ollama) ที่มีจำกัด
 */
@Processor(QUEUE_IMPORT_REVIEW, {
  concurrency: 1,
  // lockDuration ยาวเพราะ AI review 265+ แถวใช้เวลานาน (เท่า ai-batch)
  lockDuration: 700000,
})
export class ImportReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportReviewProcessor.name);

  constructor(private readonly reviewService: ExcelDataReviewService) {
    super();
  }

  /**
   * ประมวลผล import-review check job
   * Job data: { reviewSessionPublicId: string }
   */
  async process(job: Job): Promise<void> {
    const { reviewSessionPublicId } = job.data as {
      reviewSessionPublicId: string;
    };

    if (!reviewSessionPublicId) {
      this.logger.warn(
        `Job ${job.id}: missing reviewSessionPublicId — skipping`
      );
      return;
    }

    this.logger.log(
      `Job ${job.id}: processCheck session=${reviewSessionPublicId}`
    );

    await this.reviewService.processCheck(reviewSessionPublicId);
  }
}
