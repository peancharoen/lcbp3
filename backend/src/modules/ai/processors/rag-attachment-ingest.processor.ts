// File: backend/src/modules/ai/processors/rag-attachment-ingest.processor.ts
// Change Log:
// - 2026-09-14: T061 เพิ่ม ZIP handling ผ่าน SecureArchiveService + sourceLocator fallback (Feature 254, Phase 6 US4)
// - 2026-09-10: T024-T028 update imports สำหรับ renamed/new services (Feature 254)
// - 2026-09-09: เพิ่ม BullMQ processor สำหรับ RAG Attachment ingestion (Feature 254)

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { SecureArchiveService } from '../../../common/file-storage/secure-archive.service';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentPage } from '../entities/rag-attachment-page.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAttachmentIngestionService } from '../services/rag-attachment-ingestion.service';
import { RagTextSegmentService } from '../services/rag-text-segment.service';
import { RagChunkingService } from '../services/rag-chunking.service';
import { RagAttachmentSourceService } from '../services/rag-attachment-source.service';
import { RagEmbeddingService } from '../services/rag-embedding.service';
import { AiQdrantService } from '../qdrant.service';
import { QUEUE_AI_RAG_INGEST } from '../../common/constants/queue.constants';
import type { RagAttachmentIngestJobPayload } from '../ai-queue.service';
import type { RagTextSegment } from '../interfaces/rag-attachment.types';
/**
 * Processor สำหรับ RAG Attachment ingestion
 * ทำหน้าที่: normalize → segment → chunk → embed → persist → activate
 */
@Processor(QUEUE_AI_RAG_INGEST, { concurrency: 1 })
export class RagAttachmentIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(RagAttachmentIngestProcessor.name);

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepository: Repository<RagAttachmentGeneration>,
    @InjectRepository(RagAttachmentPage)
    private readonly pageRepository: Repository<RagAttachmentPage>,
    @InjectRepository(RagAttachmentChunk)
    private readonly chunkRepository: Repository<RagAttachmentChunk>,
    private readonly ingestionService: RagAttachmentIngestionService,
    private readonly textSegmentService: RagTextSegmentService,
    private readonly chunkingService: RagChunkingService,
    private readonly attachmentSourceService: RagAttachmentSourceService,
    private readonly embeddingService: RagEmbeddingService,
    private readonly qdrantService: AiQdrantService,
    @Optional() private readonly secureArchiveService?: SecureArchiveService
  ) {
    super();
  }

  async process(job: Job<RagAttachmentIngestJobPayload>): Promise<void> {
    const { attachmentPublicId, attachmentChecksum, force: _force } = job.data;
    // force ใช้ใน ingestionService.ingest() ไม่ใช่ใน processor — log เพื่อ audit trail เท่านั้น
    this.logger.log(
      `Processing RAG attachment ingest — attachment=${attachmentPublicId}, force=${_force}`
    );

    const generation = await this.generationRepository.findOne({
      where: { attachmentUuid: attachmentPublicId, status: 'BUILDING' },
      order: { createdAt: 'DESC' },
    });
    if (!generation) {
      this.logger.warn(
        `No BUILDING generation found for ${attachmentPublicId} — skipping`
      );
      return;
    }

    try {
      const attachment = await this.attachmentRepository.findOne({
        where: { publicId: attachmentPublicId },
      });
      if (!attachment) {
        await this.ingestionService.markFailed(
          generation.generationUuid,
          'ATTACHMENT_NOT_FOUND',
          `Attachment ${attachmentPublicId} not found during ingest`
        );
        return;
      }

      const ocrText = attachment.ocrText ?? '';
      if (ocrText.trim().length === 0) {
        await this.ingestionService.markFailed(
          generation.generationUuid,
          'NO_OCR_TEXT',
          'Attachment has no OCR text to ingest'
        );
        return;
      }

      // Resolve owner context (project/owner) จาก Attachment
      const ownerContext =
        await this.attachmentSourceService.resolveFromAttachment(
          attachmentPublicId
        );
      if (!ownerContext) {
        await this.ingestionService.markFailed(
          generation.generationUuid,
          'OWNER_CONTEXT_NOT_FOUND',
          `Unable to resolve owner context for attachment ${attachmentPublicId}`
        );
        return;
      }

      // 1. Normalize และ segment — สำหรับ ZIP ใช้ SECTION segment พร้อม sourceLocator
      const segment = this.createSegment(attachment, ocrText);

      // 2. สร้าง page record
      const pageUuid = uuidv7();
      const page = this.pageRepository.create({
        pageUuid,
        generationUuid: generation.generationUuid,
        attachmentUuid: attachmentPublicId,
        segmentType: segment.segmentType,
        normalizedText: segment.text,
        normalizedStartOffset: '0',
        normalizedEndOffset: String(segment.text.length),
      });
      await this.pageRepository.save(page);

      // 3. Chunk segment
      const chunkDrafts = this.chunkingService.chunkSegment(segment, pageUuid);
      if (chunkDrafts.length === 0) {
        await this.ingestionService.markFailed(
          generation.generationUuid,
          'NO_CHUNKS',
          'Segmentation produced zero chunks'
        );
        return;
      }

      // 4. Embed และสร้าง Qdrant points
      const points: Array<{
        id: string;
        vector: {
          bge_dense: number[];
          bge_sparse: { indices: number[]; values: number[] };
        };
        payload: Record<string, unknown>;
      }> = [];
      const chunkEntities: RagAttachmentChunk[] = [];

      for (const draft of chunkDrafts) {
        try {
          const embedResult = await this.embeddingService.embedChunk(
            draft.content
          );

          const chunkEntity = this.chunkRepository.create({
            chunkPublicId: draft.chunkPublicId,
            generationUuid: generation.generationUuid,
            attachmentUuid: attachmentPublicId,
            chunkIndex: draft.chunkIndex,
            content: draft.content,
            sourcePageUuid: draft.sourcePageUuid,
            segmentType: draft.segmentType,
            segmentNumber: draft.segmentNumber,
            segmentLabel: draft.segmentLabel,
            sourceLocator: draft.sourceLocator,
            startOffset: String(draft.startOffset),
            endOffset: String(draft.endOffset),
            classification: attachment.classification ?? 'INTERNAL',
            ownerType: ownerContext.ownerType,
            ownerPublicId: ownerContext.ownerPublicId,
            projectPublicId: ownerContext.projectPublicId,
          });
          chunkEntities.push(chunkEntity);

          points.push(
            this.embeddingService.buildQdrantPoint(draft, embedResult, {
              generationUuid: generation.generationUuid,
              attachmentPublicId,
              ownerType: ownerContext.ownerType,
              ownerPublicId: ownerContext.ownerPublicId,
              projectPublicId: ownerContext.projectPublicId,
              classification: attachment.classification ?? 'INTERNAL',
            })
          );
        } catch (err) {
          this.logger.error(
            `Failed to embed chunk ${draft.chunkIndex} for ${attachmentPublicId}`,
            err instanceof Error ? err.message : String(err)
          );
        }
      }

      if (chunkEntities.length === 0) {
        await this.ingestionService.markFailed(
          generation.generationUuid,
          'ALL_CHUNKS_FAILED',
          'All chunks failed to embed'
        );
        return;
      }

      // 5. Persist chunks
      await this.chunkRepository.save(chunkEntities);

      // 6. Verify checksum
      await this.ingestionService.markVerified(
        generation.generationUuid,
        attachmentChecksum
      );

      // 7. Upsert vectors to Qdrant ก่อน activate — ป้องกัน window ที่ ACTIVE แต่ยังไม่มี vectors
      await this.qdrantService.upsert(ownerContext.projectPublicId, points);

      // 8. Activate generation — vectors พร้อมแล้ว ปลอดภัยที่จะเปิดใช้งาน
      await this.ingestionService.activate(generation.generationUuid);

      this.logger.log(
        `RAG ingestion complete — attachment=${attachmentPublicId}, chunks=${chunkEntities.length}`
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `RAG ingestion failed for ${attachmentPublicId}: ${errorMessage}`
      );
      try {
        await this.ingestionService.markFailed(
          generation.generationUuid,
          'INGESTION_ERROR',
          errorMessage
        );
      } catch (markFailedErr: unknown) {
        const markFailedMessage =
          markFailedErr instanceof Error
            ? markFailedErr.message
            : String(markFailedErr);
        this.logger.error(
          `Failed to mark generation ${generation.generationUuid} as FAILED: ${markFailedMessage}`
        );
      }
    }
  }

  /**
   * สร้าง TextSegment จาก attachment — สำหรับ ZIP ใช้ SECTION segment
   * พร้อม sourceLocator ที่ชี้ไปยัง inner file path (T061, FR-039)
   * - ถ้าไม่ใช่ ZIP จะใช้ WHOLE_DOCUMENT (default behavior)
   * - ถ้าเป็น ZIP จะ parse ocrText เพื่อหา file path ด้วย regex (fallback)
   *   หมายเหตุ: ZIP extraction ที่ปลอดภัยทำใน ingestionService ผ่าน SecureArchiveService
   *   ส่วน createSegment ทำแค่สร้าง segment จาก ocrText ที่ได้มา
   */
  private createSegment(
    attachment: Attachment,
    ocrText: string
  ): RagTextSegment {
    const isZip = attachment.mimeType === 'application/zip';
    if (!isZip) {
      return this.textSegmentService.normalizeWholeDocument(ocrText);
    }

    // สำหรับ ZIP: ตรวจหา inner file path ใน ocrText เพื่อสร้าง sourceLocator
    // pattern สำหรับ file path เช่น docs/spec.pdf, drawings/d1.pdf
    const filePathPattern =
      /([\w/.-]+\.(?:pdf|docx|xlsx|dwg|txt|csv|doc|xls))/gi;
    const matches = ocrText.match(filePathPattern);
    if (matches && matches.length > 0) {
      const sourceLocator = matches[0];
      return this.textSegmentService.normalizeSection(
        1,
        sourceLocator,
        ocrText,
        sourceLocator
      );
    }

    // Fallback: ไม่พบ file path ใน ocrText ใช้ WHOLE_DOCUMENT
    return this.textSegmentService.normalizeWholeDocument(ocrText);
  }
}
