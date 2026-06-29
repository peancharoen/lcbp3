// File: src/modules/migration/workers/expire-pending-reviews.worker.ts
// Change Log:
// - 2026-05-22: สร้างตัวยกเลิกรายการรีวิวที่ค้างเกิน 30 วัน (T016b) และแจ้งเตือน Admin

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as fs from 'fs-extra';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
} from '../entities/migration-review-queue.entity';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { User } from '../../user/entities/user.entity';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class ExpirePendingReviewsWorker {
  private readonly logger = new Logger(ExpirePendingReviewsWorker.name);

  constructor(
    @InjectRepository(MigrationReviewQueue)
    private readonly reviewQueueRepository: Repository<MigrationReviewQueue>,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * รันทุกวันเวลาเที่ยงคืนเพื่อตรวจสอบและยกเลิกรายการรีวิวที่ค้างอยู่ในสถานะ PENDING เกิน 30 วัน
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiration(): Promise<void> {
    this.logger.log('Starting migration review queue expiration worker...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const expiredRecords = await this.reviewQueueRepository.find({
        where: {
          status: MigrationReviewStatus.PENDING,
          createdAt: LessThan(thirtyDaysAgo),
        },
      });
      if (expiredRecords.length === 0) {
        this.logger.log('No expired pending reviews found.');
        return;
      }
      this.logger.log(
        `Found ${expiredRecords.length} expired pending reviews. Processing expiration...`
      );
      let expiredCount = 0;
      for (const record of expiredRecords) {
        try {
          if (record.tempAttachmentId) {
            const att = await this.attachmentRepository.findOne({
              where: { id: record.tempAttachmentId },
            });
            if (att) {
              if (await fs.pathExists(att.filePath)) {
                await fs.remove(att.filePath);
              }
              await this.attachmentRepository.remove(att);
            }
            record.tempAttachmentId = undefined;
          }
          record.status = MigrationReviewStatus.REJECTED;
          record.remarks = 'EXPIRED';
          record.reviewedAt = new Date();
          record.reviewedBy = 'SYSTEM_AUTO_EXPIRATION';
          await this.reviewQueueRepository.save(record);
          expiredCount++;
        } catch (error) {
          const errMessage = (error as Error).message;
          this.logger.error(
            `Failed to expire pending review record ID ${record.id}: ${errMessage}`
          );
        }
      }
      this.logger.log(
        `Auto-expiration complete. Expired ${expiredCount} records.`
      );
      if (expiredCount > 0) {
        const admins = await this.userRepository
          .createQueryBuilder('user')
          .innerJoin('user.assignments', 'assignment')
          .innerJoin('assignment.role', 'role')
          .where('role.roleName IN (:...roles)', {
            roles: ['ADMIN', 'SUPERADMIN'],
          })
          .andWhere('user.isActive = :isActive', { isActive: true })
          .getMany();
        this.logger.log(
          `Notifying ${admins.length} administrators about expired migration reviews.`
        );
        for (const admin of admins) {
          try {
            await this.notificationService.send({
              userId: admin.user_id,
              title: 'แจ้งเตือน: รายการนำเข้าเอกสารหมดอายุอัตโนมัติ',
              message: `มีรายการนำเข้าเอกสารจำนวน ${expiredCount} รายการที่ค้างรีวิวเกิน 30 วัน ถูกยกเลิกและลบไฟล์ชั่วคราวแล้วโดยระบบอัตโนมัติ`,
              type: 'SYSTEM',
            });
          } catch (notifErr) {
            const notifErrMsg = (notifErr as Error).message;
            this.logger.error(
              `Failed to send expiration notification to admin ID ${admin.user_id}: ${notifErrMsg}`
            );
          }
        }
      }
    } catch (err) {
      const errMsg = (err as Error).message;
      this.logger.error(
        `Error occurred during pending reviews expiration: ${errMsg}`
      );
    }
  }
}
