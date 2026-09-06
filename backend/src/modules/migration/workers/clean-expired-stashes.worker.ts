// File: backend/src/modules/migration/workers/clean-expired-stashes.worker.ts
// Change Log:
// - 2026-09-06: Initial creation — Clean Expired Stashes Worker (T023, FR-016, D5)
//   รันทุกวันเวลาเที่ยงคืนเพื่อลบ stash directories ที่ Redis key หมดอายุแล้ว
//   ป้องกัน disk leak จาก sessions ที่ผู้ใช้ไม่กด confirm/cancel

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import { ReviewSessionStashService } from '../services/review-session-stash.service';

/**
 * CleanExpiredStashesWorker — Cron worker สำหรับลบ stash directories ที่หมดอายุ (T023)
 *
 * รันทุกวันเวลาเที่ยงคืน (EVERY_DAY_AT_MIDNIGHT)
 * ตรวจหา stash directories ที่ Redis key หมดอายุแล้ว (TTL 24 ชม.)
 * และลบทิ้งเพื่อป้องกัน disk leak (FR-016, D5 — Edge case 5)
 *
 * Idempotent — ไม่ throw แม้ไม่มี directory ให้ลบ
 */
@Injectable()
export class CleanExpiredStashesWorker {
  private readonly logger = new Logger(CleanExpiredStashesWorker.name);

  constructor(private readonly stashService: ReviewSessionStashService) {}

  /**
   * รันทุกวันเวลาเที่ยงคืน
   * 1. listExpiredStashDirs — หา directories ที่ Redis key หมดอายุ
   * 2. rm -rf แต่ละ directory
   * 3. log สรุป
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredStashCleanup(): Promise<void> {
    this.logger.log('เริ่มตรวจสอบ stash directories ที่หมดอายุ...');

    try {
      const expiredDirs = await this.stashService.listExpiredStashDirs();

      if (expiredDirs.length === 0) {
        this.logger.log('ไม่พบ stash directories ที่หมดอายุ — ไม่ต้อง cleanup');
        return;
      }

      this.logger.log(
        `พบ ${expiredDirs.length} stash directories ที่หมดอายุ — เริ่มลบ`
      );

      let cleanedCount = 0;
      let failedCount = 0;

      for (const dirPath of expiredDirs) {
        try {
          await fs.rm(dirPath, { recursive: true, force: true });
          cleanedCount++;
        } catch (err: unknown) {
          failedCount++;
          const detail = err instanceof Error ? err.message : 'unknown';
          this.logger.warn(`ลบ stash directory ${dirPath} ล้มเหลว: ${detail}`);
        }
      }

      this.logger.log(
        `cleanup เสร็จ: ลบสำเร็จ ${cleanedCount}/${expiredDirs.length}` +
          (failedCount > 0 ? `, ล้มเหลว ${failedCount}` : '')
      );
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`เกิดข้อผิดพลาดระหว่าง stash cleanup: ${detail}`);
    }
  }
}
