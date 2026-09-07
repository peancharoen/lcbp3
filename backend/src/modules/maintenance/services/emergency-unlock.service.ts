// File: backend/src/modules/maintenance/services/emergency-unlock.service.ts
// Change Log:
// - 2026-09-07: Emergency Unlock skeleton for Maintenance Console (Feature 253 — T097)

import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DocumentHardDeleteService } from '../../../common/services/document-hard-delete.service';

export interface ReleasedLock {
  lockKey: string;
  released: boolean;
  previousTtl?: number;
}

/**
 * บริการ Emergency Unlock สำหรับ Maintenance Console
 * - ปลดล็อกเอกสารที่ค้าง (stuck locks)
 * - Force release Redlock
 * - Bulk hard-purge (superadmin)
 */
@Injectable()
export class EmergencyUnlockService {
  private readonly logger = new Logger(EmergencyUnlockService.name);
  private readonly LOCK_PREFIX = 'lock:';

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly hardDeleteService: DocumentHardDeleteService
  ) {}

  /**
   * สแกนหา lock keys ที่ยังค้างอยู่ใน Redis
   */
  async scanStuckLocks(pattern = 'lock:*'): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, found] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      keys.push(...found);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * บังคับปลดล็อก Redlock keys ที่ระบุ
   */
  async forceReleaseLocks(lockKeys: string[]): Promise<ReleasedLock[]> {
    const results: ReleasedLock[] = [];
    for (const key of lockKeys) {
      const prefixed = key.startsWith(this.LOCK_PREFIX)
        ? key
        : `${this.LOCK_PREFIX}${key}`;
      const ttl = await this.redis.ttl(prefixed);
      const deleted = await this.redis.del(prefixed);
      this.logger.warn(`Force released emergency lock: ${prefixed}`);
      results.push({
        lockKey: prefixed,
        released: deleted > 0,
        previousTtl: ttl > 0 ? ttl : undefined,
      });
    }
    return results;
  }

  /**
   * Hard-purge เอกสารหลายรายการโดย superadmin
   * @param userId - user_id ของผู้ที่สั่ง purge (สำหรับ audit trail)
   */
  async bulkHardPurge(
    publicIds: string[],
    documentType: 'CORRESPONDENCE' | 'RFA' | 'TRANSMITTAL' | 'DRAWING',
    userId: string
  ): Promise<{ publicId: string; success: boolean; error?: string }[]> {
    const results: { publicId: string; success: boolean; error?: string }[] =
      [];
    for (const publicId of publicIds) {
      try {
        await this.hardDeleteService.execute({
          publicId,
          documentType,
          userId,
          cascadePolicy:
            this.hardDeleteService.buildCascadePolicy(documentType),
        });

        results.push({ publicId, success: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Emergency hard purge failed for ${publicId} by user ${userId}: ${msg}`
        );
        results.push({ publicId, success: false, error: msg });
      }
    }
    return results;
  }
}
