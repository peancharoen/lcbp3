// File: backend/src/modules/maintenance/services/orphan-cleanup.service.ts
// Change Log:
// - 2026-09-07: Orphan Cleanup skeleton for Maintenance Console (Feature 253 — T095)
// - 2026-09-07: Add path traversal validation in purgeOrphans (Code Review M1)
// - 2026-09-07: EC-12 add Redlock during purge to avoid deleting files being committed

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import Redlock, { Lock } from 'redlock';
import { DataSource } from 'typeorm';
import { FileStorageService } from '../../../common/file-storage/file-storage.service';
import * as path from 'path';
import * as fs from 'fs-extra';

export interface OrphanFile {
  path: string;
  sizeBytes: number;
  lastModified: Date;
  reason: 'NO_ATTACHMENT_RECORD' | 'NO_DOCUMENT_REFERENCE' | 'STALE_TEMP';
}

/**
 * บริการ Orphan Cleanup สำหรับ Maintenance Console
 * - สแกนไฟล์ใน storage ที่ไม่มี attachment/document reference
 * - purge พร้อม audit
 * - ป้องกัน path traversal — ตรวจสอบทุก path ต้องอยู่ใน permanentDir หรือ tempDir เท่านั้น
 */
@Injectable()
export class OrphanCleanupService {
  private readonly logger = new Logger(OrphanCleanupService.name);
  /** Roots ที่อนุญาตให้ purge ได้ (resolve ครั้งเดียวตอน construct) */
  private readonly allowedRoots: string[];
  private readonly redlock: Redlock;

  constructor(
    private readonly dataSource: DataSource,
    private readonly fileStorageService: FileStorageService,
    @InjectRedis() private readonly redis: Redis
  ) {
    this.allowedRoots = [
      path.resolve(this.fileStorageService.permanentDir),
      path.resolve(this.fileStorageService.tempDir),
    ];
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 100,
      retryJitter: 50,
    });
  }

  /**
   * ตรวจสอบว่า path อยู่ภายใน allowedRoots หรือไม่
   * ป้องกัน path traversal (เช่น ../../etc/passwd)
   */
  private isPathAllowed(target: string): boolean {
    const resolved = path.resolve(target);
    return this.allowedRoots.some(
      (root) => resolved === root || resolved.startsWith(root + path.sep)
    );
  }

  /**
   * เดินไฟล์แบบ recursive ใน dir — permanentDir เก็บไฟล์ที่ {docType}/{YYYY}/{MM}/filename
   * (ดู migration-review.service.ts permanentDir path build) ไม่ใช่ flat directory
   */
  private async walkFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir);
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        files.push(...(await this.walkFiles(fullPath)));
      } else {
        files.push(fullPath);
      }
    }
    return files;
  }

  /**
   * สแกนไฟล์ลูกกร matter ใน permanent + temp storage
   */
  async scanOrphans(): Promise<OrphanFile[]> {
    const orphans: OrphanFile[] = [];

    for (const dir of [
      this.fileStorageService.permanentDir,
      this.fileStorageService.tempDir,
    ]) {
      if (!(await fs.pathExists(dir))) continue;
      const filePaths = await this.walkFiles(dir);
      for (const fullPath of filePaths) {
        const stat = await fs.stat(fullPath);
        const attachment = await this.dataSource.query<Array<{ id: number }>>(
          'SELECT id FROM attachments WHERE file_path = ? OR uuid = ? LIMIT 1',
          [fullPath, path.basename(fullPath)]
        );

        if (attachment.length === 0) {
          orphans.push({
            path: fullPath,
            sizeBytes: stat.size,
            lastModified: stat.mtime,
            reason: 'NO_ATTACHMENT_RECORD',
          });
        }
      }
    }

    return orphans;
  }

  /**
   * ลบไฟล์ที่ระบุ (paths) พร้อม audit
   * ตรวจสอบ path traversal — ทุก path ต้องอยู่ใน permanentDir หรือ tempDir
   * ใช้ Redlock ป้องกันการลบไฟล์ที่กำลังถูก commit (EC-12)
   */
  async purgeOrphans(
    paths: string[],
    userId: number
  ): Promise<{ deleted: number; failed: string[] }> {
    let deleted = 0;
    const failed: string[] = [];
    let lock: Lock | null = null;

    try {
      // ใช้ Redlock ระดับ global สำหรับ purge ทั้งหมด
      lock = await this.redlock.acquire(['lock:orphan-cleanup'], 30000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Could not acquire orphan cleanup lock: ${msg}`);
      return {
        deleted: 0,
        failed: paths.map((p) => `${p}: could not acquire cleanup lock`),
      };
    }

    try {
      for (const p of paths) {
        try {
          if (!this.isPathAllowed(p)) {
            this.logger.warn(
              `Rejected purge path outside storage roots by user ${userId}: ${p}`
            );
            failed.push(`${p}: path outside storage root`);
            continue;
          }
          if (await fs.pathExists(p)) {
            await fs.remove(p);
            deleted += 1;
            this.logger.log(`Purged orphan file by user ${userId}: ${p}`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          failed.push(`${p}: ${msg}`);
        }
      }
    } finally {
      try {
        if (lock) {
          await lock.release();
        }
      } catch (releaseErr: unknown) {
        const msg =
          releaseErr instanceof Error ? releaseErr.message : String(releaseErr);
        this.logger.warn(`Failed to release orphan cleanup lock: ${msg}`);
      }
    }

    return { deleted, failed };
  }
}
