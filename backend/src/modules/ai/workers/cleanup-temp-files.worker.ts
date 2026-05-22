// File: src/modules/ai/workers/cleanup-temp-files.worker.ts
// Change Log:
// - 2026-05-22: อัปเดตและสร้างตัวล้างไฟล์ชั่วคราว (T016) เพื่อลบไฟล์ที่หมดอายุ 24 ชม.

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs-extra';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
} from '../../migration/entities/migration-review-queue.entity';

@Injectable()
export class CleanupTempFilesWorker {
  private readonly logger = new Logger(CleanupTempFilesWorker.name);

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(MigrationReviewQueue)
    private readonly reviewQueueRepository: Repository<MigrationReviewQueue>
  ) {}

  /**
   * รันทุกชั่วโมงเพื่อลบไฟล์แนบชั่วคราวที่ครบ 24 ชั่วโมงและไม่ได้ถูกคอมมิต
   * ยกเว้นไฟล์ที่ถูกอ้างอิงโดยรายการที่สถานะเป็น PENDING ใน Migration Review Queue
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup(): Promise<void> {
    this.logger.log('Starting temporary files cleanup worker...');
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      const pendingRecords = await this.reviewQueueRepository.find({
        select: ['tempAttachmentId'],
        where: { status: MigrationReviewStatus.PENDING },
      });
      const pendingAttachmentIds = pendingRecords
        .map((r) => r.tempAttachmentId)
        .filter((id): id is number => id !== undefined && id !== null);
      const query = this.attachmentRepository
        .createQueryBuilder('attachment')
        .where('attachment.isTemporary = :isTemporary', { isTemporary: true })
        .andWhere('attachment.createdAt < :oneDayAgo', { oneDayAgo });
      if (pendingAttachmentIds.length > 0) {
        query.andWhere('attachment.id NOT IN (:...pendingAttachmentIds)', {
          pendingAttachmentIds,
        });
      }
      const expiredAttachments = await query.getMany();
      if (expiredAttachments.length === 0) {
        this.logger.log('No expired temporary files found.');
        return;
      }
      this.logger.log(
        `Found ${expiredAttachments.length} expired temporary files. Deleting...`
      );
      let deletedCount = 0;
      let failedCount = 0;
      for (const att of expiredAttachments) {
        try {
          if (await fs.pathExists(att.filePath)) {
            await fs.remove(att.filePath);
          }
          await this.attachmentRepository.remove(att);
          deletedCount++;
        } catch (error) {
          const errMessage = (error as Error).message;
          this.logger.error(
            `Failed to delete temporary file ID ${att.id}: ${errMessage}`
          );
          failedCount++;
        }
      }
      this.logger.log(
        `Temporary files cleanup completed. Deleted: ${deletedCount}, Failed: ${failedCount}`
      );
    } catch (err) {
      const errMsg = (err as Error).message;
      this.logger.error(
        `Error occurred during temporary files cleanup: ${errMsg}`
      );
    }
  }
}
