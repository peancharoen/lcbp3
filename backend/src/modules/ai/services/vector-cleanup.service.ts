// File: backend/src/modules/ai/services/vector-cleanup.service.ts
// Change Log:
// - 2026-09-03: Create VectorCleanupService — periodic cleanup สำหรับ Qdrant vectors
//   ที่ไม่ได้ถูกลบตอน hardDelete() (sync deletion fail) + orphan scan กวาด vectors
//   ที่ไม่มี doc_public_id ตรงใน DB
// - 2026-09-08: Fix orphanScan raw SQL — correspondences ใช้ column `uuid` ไม่ใช่ `public_id`
//   (ADR-019: UuidBaseEntity maps publicId → uuid column)
// - 2026-09-11: T051 — เพิ่ม generation-scoped cleanup และ retry records (Feature 254, Phase 5 US3)

import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { AiQdrantService } from '../qdrant.service';
import {
  PendingVectorDeletion,
  PendingVectorDeletionStatus,
} from '../entities/pending-vector-deletion.entity';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../entities/rag-attachment-page.entity';

/** ขนาด batch สำหรับ orphan scan (scroll Qdrant) */
const ORPHAN_SCAN_BATCH_SIZE = 100;

/** Retention threshold สำหรับ RETIRED generation cleanup (24 ชม.) */
const RETIRED_GENERATION_RETENTION_HOURS = 24;

/** Raw query result สำหรับ orphan scan */
interface OrphanGenerationRow {
  generationUuid: string;
  attachmentUuid: string;
}

/**
 * Periodic cleanup service สำหรับ Qdrant vectors
 *
 * ฟังก์ชันหลัก:
 * 1. retryPendingDeletions — retry ลบ vectors ที่เก็บใน pending_vector_deletions
 * 2. orphanScan — scroll Qdrant เทียบกับ DB ลบ vectors ที่ไม่มี doc_public_id ตรง
 * 3. cleanupRetiredGenerations — generation-scoped cleanup สำหรับ RETIRED generations
 * 4. recordPendingDeletion — สร้าง retry record สำหรับ compensation pattern
 *
 * รันทุกชั่วโมง (EVERY_HOUR) — ปรับได้ผ่าน env ในอนาคต
 */
@Injectable()
export class VectorCleanupService {
  private readonly logger = new Logger(VectorCleanupService.name);

  constructor(
    private readonly qdrantService: AiQdrantService,
    @InjectRepository(PendingVectorDeletion)
    private readonly pendingRepo: Repository<PendingVectorDeletion>,
    private readonly dataSource: DataSource,
    @Optional()
    @InjectRepository(RagAttachmentGeneration)
    private readonly generationRepo?: Repository<RagAttachmentGeneration>,
    @Optional()
    @InjectRepository(RagAttachmentChunk)
    private readonly chunkRepo?: Repository<RagAttachmentChunk>,
    @Optional()
    @InjectRepository(RagAttachmentPage)
    private readonly pageRepo?: Repository<RagAttachmentPage>
  ) {}

  /**
   * Retry pending vector deletions ทุก 15 นาที
   * สแกน pending_vector_deletions ที่ status=PENDING และ retry_count < max_retries
   */
  @Cron('0 */15 * * * *')
  async retryPendingDeletions(): Promise<void> {
    this.logger.log('Starting pending vector deletions retry...');

    let processed = 0;
    let completed = 0;
    let failed = 0;

    try {
      const pendingItems = await this.pendingRepo.find({
        where: { status: PendingVectorDeletionStatus.PENDING },
        take: 50,
        order: { createdAt: 'ASC' },
      });

      for (const item of pendingItems) {
        processed++;
        try {
          await this.qdrantService.deleteByDocumentPublicId(
            item.projectPublicId,
            item.documentPublicId
          );

          await this.pendingRepo.update(item.id, {
            status: PendingVectorDeletionStatus.COMPLETED,
            completedAt: new Date(),
          });
          completed++;
          this.logger.log(
            `retryPendingDeletions: deleted vectors for doc=${item.documentPublicId}`
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          const newRetryCount = item.retryCount + 1;

          if (newRetryCount >= item.maxRetries) {
            // เกิน max_retries → mark FAILED (orphan scan จะกวาดภายหลัง)
            await this.pendingRepo.update(item.id, {
              status: PendingVectorDeletionStatus.FAILED,
              retryCount: newRetryCount,
              lastError: msg,
            });
            failed++;
            this.logger.error(
              `retryPendingDeletions: max retries exceeded for doc=${item.documentPublicId}, marking FAILED — orphan scan will catch it`
            );
          } else {
            await this.pendingRepo.update(item.id, {
              retryCount: newRetryCount,
              lastError: msg,
            });
            this.logger.warn(
              `retryPendingDeletions: retry ${newRetryCount}/${item.maxRetries} failed for doc=${item.documentPublicId}: ${msg}`
            );
          }
        }
      }

      this.logger.log(
        `retryPendingDeletions: processed=${processed}, completed=${completed}, failed=${failed}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`retryPendingDeletions: fatal error: ${msg}`);
    }
  }

  /**
   * Orphan scan ทุกชั่วโมง — scroll Qdrant เทียบกับ DB
   * ลบ vectors ที่ไม่มี doc_public_id ตรงกับ correspondences ใน DB
   *
   * ⚠️ ใช้ scroll API แบบ batch เพื่อควบคุม memory
   * ⚠️ กรอง projectPublicId เสมอ (ADR-023A)
   *
   * หมายเหตุ: ต้องระบุ projectPublicId เพื่อ scroll — ดึงรายการ projects จาก DB
   */
  @Cron(CronExpression.EVERY_HOUR)
  async orphanScan(): Promise<void> {
    this.logger.log('Starting Qdrant orphan vector scan...');

    let totalOrphansDeleted = 0;
    let totalScanned = 0;

    try {
      // ดึงรายการ projects ทั้งหมดเพื่อ scroll ทีละ project
      const projects = await this.dataSource.query<
        Array<{ public_id: string }>
      >(
        'SELECT uuid AS public_id FROM projects WHERE is_active = 1 AND is_sandbox = 0'
      );

      for (const project of projects) {
        const projectPublicId = project.public_id;
        let offset: string | number | undefined = undefined;
        let projectOrphans = 0;

        do {
          const { points, nextOffset } =
            await this.qdrantService.scrollByProject(
              projectPublicId,
              ORPHAN_SCAN_BATCH_SIZE,
              offset
            );

          if (points.length === 0) break;

          totalScanned += points.length;

          // ดึง doc_public_ids จาก payload ของ points ใน batch
          const docPublicIds = points
            .map((p) => p.payload?.['doc_public_id'] as string | undefined)
            .filter((id): id is string => !!id);

          if (docPublicIds.length === 0) {
            offset = nextOffset ?? undefined;
            continue;
          }

          // เช็คกับ DB — หา doc_public_ids ที่ยังมีอยู่ใน correspondences "จริง"
          // ต้องมีทั้ง (1) correspondence ไม่ถูก soft-delete (deleted_at IS NULL) และ
          // (2) มี revision อยู่จริงอย่างน้อย 1 รายการ — เดิมเช็คแค่ correspondence row
          // ยังอยู่ไหม ทำให้เคสที่ revision ถูกลบไปแล้วแต่ correspondence shell ยังอยู่
          // (เช่น ลบ revision ตรงๆ นอกช่องทาง app หรือ manual DB cleanup) ไม่ถูกจับว่า
          // orphan เลยแม้ Qdrant จะยังมี vector ของเนื้อหาที่หายไปแล้วอยู่ก็ตาม
          const existingDocs = await this.dataSource.query<
            Array<{ public_id: string }>
          >(
            `SELECT DISTINCT c.uuid AS public_id
             FROM correspondences c
             INNER JOIN correspondence_revisions cr ON cr.correspondence_id = c.id
             WHERE c.deleted_at IS NULL AND c.uuid IN (?)`,
            [docPublicIds]
          );

          const existingSet = new Set(existingDocs.map((d) => d.public_id));

          // หา orphan points — doc_public_id ที่ไม่มีใน DB
          const orphanPoints = points.filter((p) => {
            const docId = p.payload?.['doc_public_id'] as string | undefined;
            return docId && !existingSet.has(docId);
          });

          if (orphanPoints.length > 0) {
            const orphanPointIds = orphanPoints.map((p) => p.pointId);
            await this.qdrantService.deleteByPointIds(orphanPointIds);
            projectOrphans += orphanPoints.length;
            this.logger.warn(
              `orphanScan: deleted ${orphanPoints.length} orphan vectors in project=${projectPublicId}`
            );
          }

          offset = nextOffset ?? undefined;
        } while (offset !== null && offset !== undefined);

        totalOrphansDeleted += projectOrphans;
        if (projectOrphans > 0) {
          this.logger.log(
            `orphanScan: project=${projectPublicId} deleted ${projectOrphans} orphans`
          );
        }
      }

      this.logger.log(
        `orphanScan: completed — scanned=${totalScanned}, orphansDeleted=${totalOrphansDeleted}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`orphanScan: fatal error: ${msg}`);
    }
  }

  /**
   * Generation-scoped cleanup สำหรับ RETIRED generations ทุก 6 ชั่วโมง
   * ลบ Qdrant vectors ของ RETIRED generations ที่เก่ากว่า retention threshold
   * พร้อมลบ chunks/pages/generation records จาก MariaDB
   */
  @Cron('0 0 */6 * * *')
  async cleanupRetiredGenerations(): Promise<void> {
    this.logger.log('Starting generation-scoped RETIRED cleanup...');

    if (!this.generationRepo || !this.chunkRepo || !this.pageRepo) {
      this.logger.warn(
        'cleanupRetiredGenerations: generation/chunk/page repositories not available — skipping'
      );
      return;
    }

    let cleaned = 0;
    let failed = 0;

    try {
      const threshold = new Date(
        Date.now() - RETIRED_GENERATION_RETENTION_HOURS * 60 * 60 * 1000
      );
      const retiredGenerations = await this.generationRepo.find({
        where: {
          status: 'RETIRED' as never,
          retiredAt: LessThan(threshold),
        },
        take: 50,
      });

      if (retiredGenerations.length === 0) {
        this.logger.log(
          'cleanupRetiredGenerations: no RETIRED generations to clean'
        );
        return;
      }

      for (const generation of retiredGenerations) {
        try {
          await this.cleanupGenerationVectors(generation.generationUuid);

          await this.chunkRepo.delete({
            generationUuid: generation.generationUuid,
          });
          await this.pageRepo.delete({
            generationUuid: generation.generationUuid,
          });
          await this.generationRepo.delete({
            generationUuid: generation.generationUuid,
          });
          cleaned++;
        } catch (err: unknown) {
          failed++;
          this.logger.error(
            `cleanupRetiredGenerations: failed for generation ${generation.generationUuid}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      this.logger.log(
        `cleanupRetiredGenerations: cleaned=${cleaned}, failed=${failed}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`cleanupRetiredGenerations: fatal error: ${msg}`);
    }
  }

  /**
   * ลบ Qdrant vectors ของ generation หนึ่งโดยใช้ chunk public IDs
   * หาก Qdrant deletion ล้มเหลว จะบันทึก pending deletion record เพื่อ retry ภายหลัง
   * @param generationUuid UUID ของ generation ที่จะลบ vectors
   */
  async cleanupGenerationVectors(generationUuid: string): Promise<void> {
    if (!this.chunkRepo) {
      this.logger.warn(
        `cleanupGenerationVectors: chunk repository not available — skipping`
      );
      return;
    }
    const chunks = await this.chunkRepo.find({
      where: { generationUuid },
      select: ['chunkPublicId'],
    });
    if (chunks.length === 0) return;

    const pointIds = chunks.map((c) => c.chunkPublicId);
    try {
      await this.qdrantService.deleteByPointIds(pointIds);
      this.logger.debug(
        `cleanupGenerationVectors: deleted ${pointIds.length} vectors for generation ${generationUuid}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `cleanupGenerationVectors: Qdrant deletion failed for generation ${generationUuid}: ${msg} — recording pending deletion`
      );
      // บันทึก pending deletion เพื่อ retry ภายหลัง (compensation pattern)
      await this.recordPendingDeletion({
        documentPublicId: chunks[0]?.attachmentUuid ?? generationUuid,
        projectPublicId: chunks[0]?.projectPublicId ?? '',
      });
    }
  }

  /**
   * สร้าง pending vector deletion record สำหรับ retry ภายหลัง
   * ใช้ใน compensation pattern เมื่อ Qdrant deletion ล้มเหลว
   * @param payload ข้อมูล documentPublicId และ projectPublicId
   */
  async recordPendingDeletion(payload: {
    documentPublicId: string;
    projectPublicId: string;
  }): Promise<void> {
    const pendingDeletion = this.pendingRepo.create({
      publicId: uuidv7(),
      documentPublicId: payload.documentPublicId,
      projectPublicId: payload.projectPublicId,
      status: PendingVectorDeletionStatus.PENDING,
    });
    await this.pendingRepo.save(pendingDeletion);
    this.logger.log(
      `recordPendingDeletion: created pending deletion for doc=${payload.documentPublicId}`
    );
  }

  /**
   * Orphan scan — ลบ RAG records ของ attachments ที่ถูกลบแล้ว (Feature 255, Q8)
   * สแกน rag_attachment_generations LEFT JOIN attachments WHERE attachments.id IS NULL
   * สำหรับแต่ละ orphan: ลบ Qdrant vectors, ลบ chunks, ลบ pages, ลบ generation records
   * รันทุก 6 ชั่วโมง (matching cleanupRetiredGenerations schedule)
   */
  @Cron('0 0 */6 * * *')
  async orphanScanRagAttachments(): Promise<void> {
    if (!this.generationRepo || !this.chunkRepo || !this.pageRepo) {
      this.logger.warn(
        'orphanScanRagAttachments: generation/chunk/page repositories not available — skipping'
      );
      return;
    }

    this.logger.log('orphanScanRagAttachments: starting orphan scan...');

    try {
      // หา generations ที่ attachment ไม่มีอยู่แล้ว (orphaned)
      const orphans = await this.generationRepo
        .createQueryBuilder('g')
        .leftJoin('attachments', 'a', 'a.uuid = g.attachment_uuid')
        .where('a.id IS NULL')
        .select([
          'g.generation_uuid AS generationUuid',
          'g.attachment_uuid AS attachmentUuid',
        ])
        .getRawMany<OrphanGenerationRow>();

      if (orphans.length === 0) {
        this.logger.log('orphanScanRagAttachments: no orphaned records found');
        return;
      }

      this.logger.log(
        `orphanScanRagAttachments: found ${orphans.length} orphaned generation(s)`
      );

      let cleaned = 0;
      let failed = 0;

      for (const orphan of orphans) {
        try {
          const { generationUuid, attachmentUuid } = orphan;

          // 1. ลบ Qdrant vectors โดยใช้ chunk public IDs (matching cleanupGenerationVectors pattern)
          try {
            const chunks = await this.chunkRepo.find({
              where: { generationUuid },
              select: ['chunkPublicId'],
            });
            if (chunks.length > 0) {
              await this.qdrantService.deleteByPointIds(
                chunks.map((c) => c.chunkPublicId)
              );
            }
          } catch (err) {
            this.logger.warn(
              `orphanScanRagAttachments: Qdrant deletion failed for attachment ${attachmentUuid}: ${err instanceof Error ? err.message : String(err)} — continuing with DB cleanup`
            );
          }

          // 2. ลบ chunks
          await this.chunkRepo.delete({ generationUuid });
          // 3. ลบ pages
          await this.pageRepo.delete({ generationUuid });
          // 4. ลบ generation record
          await this.generationRepo.delete({ generationUuid });

          cleaned++;
          this.logger.log(
            `orphanScanRagAttachments: cleaned orphan generation ${generationUuid} (attachment ${attachmentUuid})`
          );
        } catch (err) {
          failed++;
          this.logger.error(
            `orphanScanRagAttachments: failed for generation ${orphan.generationUuid}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      this.logger.log(
        `orphanScanRagAttachments: completed — cleaned=${cleaned}, failed=${failed}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`orphanScanRagAttachments: fatal error: ${msg}`);
    }
  }
}
