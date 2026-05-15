// File: src/modules/ai/processors/vector-deletion.processor.ts
// Change Log
// - 2026-05-14: เพิ่ม BullMQ Processor สำหรับลบ vector ใน Qdrant แบบ async ตาม ADR-023 FR-008 (T027).
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_AI_VECTOR_DELETION } from '../../common/constants/queue.constants';
import { AiQdrantService } from '../qdrant.service';
import { AiVectorDeletionJobPayload } from '../ai-queue.service';

/**
 * Processor สำหรับลบ vector ของเอกสารที่ถูกลบออกจาก Qdrant แบบ asynchronous
 * รองรับ retry 3 ครั้ง (ADR-008 + FR-008) เพื่อ eventual consistency เมื่อ Qdrant ไม่พร้อม
 */
@Processor(QUEUE_AI_VECTOR_DELETION)
export class AiVectorDeletionProcessor extends WorkerHost {
  private readonly logger = new Logger(AiVectorDeletionProcessor.name);

  constructor(private readonly qdrantService: AiQdrantService) {
    super();
  }

  async process(job: Job<AiVectorDeletionJobPayload>): Promise<void> {
    const { documentPublicId, requestedByUserPublicId } = job.data;

    this.logger.log(
      `Vector deletion started — documentPublicId=${documentPublicId}, jobId=${String(job.id)}, requestedBy=${requestedByUserPublicId}`
    );

    await this.qdrantService.deleteByDocumentPublicId(documentPublicId);

    this.logger.log(
      `Vector deletion completed — documentPublicId=${documentPublicId}, jobId=${String(job.id)}`
    );
  }
}
