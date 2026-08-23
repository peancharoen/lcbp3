// File: backend/src/modules/migration/services/rag-batch.service.ts
// Change Log:
// - 2026-08-06: Initial creation — stub for Phase 6 implementation (Feature 242, FR-021, FR-022, FR-023, FR-024, FR-025, FR-026)
// - 2026-08-06: Full implementation — RAG candidate query + BullMQ enqueue + idempotency (T053, T055)
// - 2026-08-23: เปลี่ยน migration Execute Import ให้ใช้ rag-prepare เส้นเดียวกับเอกสารปกติ

import { Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { isDwgFile } from '../constants/dwg-exclusion.constant';
import {
  IMPORT_TX_STATUS_PENDING,
  IMPORT_TX_STATUS_PROCESSING,
} from '../constants/migration.constants';
import { RagPrepareJobPayload } from '../../ai/ai-queue.service';

/** ผลลัพธ์การ trigger RAG batch (FR-026b) */
export interface RagBatchResult {
  batchId: string | null;
  total: number;
  enqueued: number;
  skipped: number;
  failed: number;
  enqueuedAt: Date;
  skipBreakdown: {
    noTextLayer: number;
    emptyOcrText: number;
    alreadyEmbedded: number;
  };
  warning?: string;
}

/** RAG candidate row จาก query */
interface RagCandidate {
  id: number;
  public_id: string;
  ocr_text: string | null;
  mime_type: string | null;
  original_filename: string | null;
  project_public_id: string | null;
}

/**
 * Service สำหรับ enqueue rag-prepare jobs สำหรับ committed attachments ที่มี persisted OCR text (FR-021, FR-026)
 * ข้าม DWG/DXF และไฟล์ที่ embedded แล้ว (FR-022, FR-025)
 */
@Injectable()
export class RagBatchService {
  private readonly logger = new Logger(RagBatchService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    @InjectQueue('ai-batch')
    private readonly aiBatchQueue?: Queue
  ) {}

  /**
   * ค้นหา RAG candidates และ enqueue rag-prepare jobs (FR-021, FR-026)
   * @param batchId optional batch scope; omit for all pending (FR-026a)
   * @returns ผลลัพธ์การ enqueue พร้อม skip breakdown (FR-026b)
   */
  async triggerRagBatch(batchId?: string): Promise<RagBatchResult> {
    const enqueuedAt = new Date();
    this.logger.log(`triggerRagBatch: batchId=${batchId ?? 'ALL'}`);

    // ตรวจสอบ active import batches (spec edge case)
    const activeImportWarning = await this.checkActiveImportBatches();

    // ดึง RAG candidates ตาม data-model §8.1
    const candidates = await this.fetchRagCandidates(batchId);
    const skipBreakdown = {
      noTextLayer: 0,
      emptyOcrText: 0,
      alreadyEmbedded: 0,
    };

    let enqueued = 0;
    let failed = 0;

    for (const candidate of candidates) {
      // FR-022: ข้าม DWG/DXF (MIME + extension check)
      if (
        isDwgFile(candidate.mime_type ?? '', candidate.original_filename ?? '')
      ) {
        skipBreakdown.noTextLayer += 1;
        continue;
      }

      // FR-023: ข้ามไฟล์ที่ไม่มี OCR text
      if (!candidate.ocr_text || candidate.ocr_text.trim().length === 0) {
        skipBreakdown.emptyOcrText += 1;
        continue;
      }

      // FR-025: ตรวจสอบ idempotency — ถ้า job มีอยู่แล้วใน queue ให้ skip
      const jobId = `rag-prepare-${candidate.public_id}`;
      if (this.aiBatchQueue) {
        try {
          const existingJob = await this.aiBatchQueue.getJob(jobId);
          if (existingJob && (await existingJob.getState()) !== 'completed') {
            skipBreakdown.alreadyEmbedded += 1;
            continue;
          }
          // FR-024: enqueue rag-prepare job (concurrency=1 ควบคุมโดย BullMQ)
          await this.aiBatchQueue.add(
            'rag-prepare',
            {
              documentPublicId: candidate.public_id,
              projectPublicId: candidate.project_public_id ?? '',
              batchId: batchId ?? undefined,
              jobType: 'rag-prepare',
            },
            {
              jobId,
              removeOnComplete: 100,
              removeOnFail: 50,
            }
          );
          enqueued += 1;
        } catch (err: unknown) {
          this.logger.error(
            `triggerRagBatch: failed to enqueue job for ${candidate.public_id}: ${err instanceof Error ? err.message : String(err)}`
          );
          failed += 1;
        }
      } else {
        // Queue ไม่พร้อมใช้งาน — log warning
        this.logger.warn(
          `triggerRagBatch: ai-batch queue not available — cannot enqueue ${candidate.public_id}`
        );
        failed += 1;
      }
    }

    const total = candidates.length;
    const skipped =
      skipBreakdown.noTextLayer +
      skipBreakdown.emptyOcrText +
      skipBreakdown.alreadyEmbedded;

    this.logger.log(
      `triggerRagBatch: total=${total} enqueued=${enqueued} skipped=${skipped} ` +
        `failed=${failed} noTextLayer=${skipBreakdown.noTextLayer} ` +
        `emptyOcrText=${skipBreakdown.emptyOcrText} alreadyEmbedded=${skipBreakdown.alreadyEmbedded}`
    );

    return {
      batchId: batchId ?? null,
      total,
      enqueued,
      skipped,
      failed,
      enqueuedAt,
      skipBreakdown,
      warning: activeImportWarning,
    };
  }

  /**
   * Enqueue rag-prepare สำหรับเอกสารทีนำเข้า/แก้ไขแล้ว (ADR-042/047)
   * ใช้ pipeline เดียวกับเอกสารปกติที submit workflow
   */
  async enqueueRagPrepare(payload: RagPrepareJobPayload): Promise<void> {
    if (!this.aiBatchQueue) {
      this.logger.warn(
        `enqueueRagPrepare: ai-batch queue not available for ${payload.documentPublicId}`
      );
      return;
    }
    const jobId = `rag-prepare:${payload.documentPublicId}:${payload.revisionNumber}`;
    try {
      await this.aiBatchQueue.add(
        'rag-prepare',
        {
          jobType: 'rag-prepare',
          ...payload,
        },
        {
          jobId,
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );
      this.logger.log(
        `enqueueRagPrepare: enqueued rag-prepare for ${payload.documentPublicId}`
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `enqueueRagPrepare: failed to enqueue rag-prepare for ${payload.documentPublicId}: ${errMsg}`
      );
    }
  }

  /** ดึง RAG candidates ตาม data-model §8.1 (FR-021, R5) */
  private async fetchRagCandidates(batchId?: string): Promise<RagCandidate[]> {
    // Query ตาม spec: DISTINCT, ocr_text IS NOT NULL, is_temporary=0, ai_processing_status <> 'DONE', DWG exclusion
    // batchId scope ถ้ามี (FR-026a)
    const params: unknown[] = [];
    let batchJoin = '';
    let batchWhere = '';
    if (batchId) {
      batchJoin =
        'JOIN import_transactions it ON it.document_number = c.correspondence_number';
      batchWhere = 'AND it.batch_id = ?';
      params.push(batchId);
    }

    const sql = `
      SELECT DISTINCT a.id, a.public_id, a.ocr_text, a.mime_type, a.original_filename,
        p.uuid AS project_public_id
      FROM attachments a
      JOIN correspondence_revision_attachments cra ON cra.attachment_id = a.id
      JOIN correspondence_revisions cr ON cr.id = cra.revision_id
      JOIN correspondences c ON c.id = cr.correspondence_id
      LEFT JOIN projects p ON p.id = c.project_id
      ${batchJoin}
      WHERE a.ocr_text IS NOT NULL
        AND a.ocr_text <> ''
        AND a.is_temporary = 0
        AND (a.ai_processing_status IS NULL OR a.ai_processing_status <> 'DONE')
        AND (a.mime_type IS NULL OR a.mime_type NOT IN ('application/dwg', 'application/dxf', 'image/vnd.dwg'))
        AND LOWER(a.original_filename) NOT REGEXP '\\\\.(dwg|dxf)$'
        ${batchWhere}
    `;

    return this.dataSource.query(sql, params);
  }

  /** ตรวจสอบ active import batches (spec edge case) */
  private async checkActiveImportBatches(): Promise<string | undefined> {
    try {
      const rows = await this.dataSource.query<{ active_count: number }[]>(
        'SELECT COUNT(*) as active_count FROM import_transactions WHERE status IN (?, ?)',
        [IMPORT_TX_STATUS_PENDING, IMPORT_TX_STATUS_PROCESSING]
      );
      if (rows.length > 0 && rows[0].active_count > 0) {
        return 'IMPORT_IN_PROGRESS';
      }
    } catch (err: unknown) {
      this.logger.warn(
        `checkActiveImportBatches: ไม่สามารถตรวจสอบ active imports: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return undefined;
  }
}
