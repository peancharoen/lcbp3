// File: src/common/file-storage/file-cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as fs from 'fs-extra';
import { Attachment } from './entities/attachment.entity';

@Injectable()
export class FileCleanupService {
  private readonly logger = new Logger(FileCleanupService.name);

  constructor(
    @InjectRepository(Attachment)
    private attachmentRepository: Repository<Attachment>,
  ) {}

  /**
   * รันทุกวันเวลาเที่ยงคืน (00:00)
   * ลบไฟล์ชั่วคราว (isTemporary = true) ที่หมดอายุแล้ว (expiresAt < now)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCleanup() {
    this.logger.log('Running temporary file cleanup job...');

    const now = new Date();

    // 1. ค้นหาไฟล์ที่หมดอายุ
    const expiredAttachments = await this.attachmentRepository.find({
      where: {
        isTemporary: true,
        expiresAt: LessThan(now),
      },
    });

    if (expiredAttachments.length === 0) {
      this.logger.log('No expired files found.');
      return;
    }

    this.logger.log(
      `Found ${expiredAttachments.length} expired files. Deleting...`,
    );

    let deletedCount = 0;
    const errors = [];

    for (const att of expiredAttachments) {
      try {
        // 2. ลบไฟล์จริงออกจาก Disk
        if (await fs.pathExists(att.filePath)) {
          await fs.remove(att.filePath);
        }

        // 3. ลบ Record ออกจาก Database
        await this.attachmentRepository.remove(att);
        deletedCount++;
      } catch (error) {
        // ✅ แก้ไข: Cast error เป็น Error object เพื่อเข้าถึง .message
        const errMessage = (error as Error).message;
        this.logger.error(`Failed to delete file ID ${att.id}: ${errMessage}`);
        errors.push(att.id);
      }
    }

    this.logger.log(
      `Cleanup complete. Deleted: ${deletedCount}, Failed: ${errors.length}`,
    );
  }
}
