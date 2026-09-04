// File: backend/src/modules/ai/services/vector-cleanup.service.ts
// Change Log:
// - 2026-09-03: Create VectorCleanupService — periodic cleanup สำหรับ Qdrant vectors
//   ที่ไม่ได้ถูกลบตอน hardDelete() (sync deletion fail) + orphan scan กวาด vectors
//   ที่ไม่มี doc_public_id ตรงใน DB

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AiQdrantService } from '../qdrant.service';
import {
  PendingVectorDeletion,
  PendingVectorDeletionStatus,
} from '../entities/pending-vector-deletion.entity';

/** ขนาด batch สำหรับ orphan scan (scroll Qdrant) */
const ORPHAN_SCAN_BATCH_SIZE = 100;

/**
 * Periodic cleanup service สำหรับ Qdrant vectors
 *
 * 2 ฟังก์ชันหลัก:
 * 1. retryPendingDeletions — retry ลบ vectors ที่เก็บใน pending_vector_deletions
 * 2. orphanScan — scroll Qdrant เทียบกับ DB ลบ vectors ที่ไม่มี doc_public_id ตรง
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
    private readonly dataSource: DataSource
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
        'SELECT public_id FROM projects WHERE is_active = 1 AND is_sandbox = 0'
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
            `SELECT DISTINCT c.public_id AS public_id
             FROM correspondences c
             INNER JOIN correspondence_revisions cr ON cr.correspondence_id = c.id
             WHERE c.deleted_at IS NULL AND c.public_id IN (?...)`,
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
}
