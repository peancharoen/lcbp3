// File: backend/src/modules/migration/services/migration-lock.service.ts
// Change Log:
// - 2026-09-23: สร้างใหม่ — Redlock ป้องกัน race condition ตอนจองเลขที่เอกสาร/revision
//   label ระหว่าง concurrent import/confirm ใน migration pipeline (ADR-002)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import Redlock, { Lock } from 'redlock';
import { ServiceUnavailableException } from '../../../common/exceptions';

/**
 * บริการล็อกสำหรับ migration pipeline (ADR-002) — ใช้ Redlock ป้องกัน
 * concurrent transaction สองอันเลือก document_number หรือ revision label
 * ซ้ำกันในช่วง check-then-write (TOCTOU)
 */
@Injectable()
export class MigrationLockService {
  private readonly logger = new Logger(MigrationLockService.name);
  private readonly redlock: Redlock;
  private readonly ttlMs = 10_000;
  /** TTL ยาวกว่าปกติ — สำหรับ lock ที่คร่อม transaction ขนาดใหญ่ (เช่น confirm() หลายพันแถว) */
  private readonly longTtlMs = 10 * 60_000;

  constructor(@InjectRedis() redis: Redis) {
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 5,
      retryDelay: 100,
      retryJitter: 50,
    });
  }

  /** Acquire lock ผูกกับ base document number — กันชนตอนหาเลขที่/revision suffix ที่ไม่ซ้ำ */
  public async acquireDocumentNumber(baseDocNumber: string): Promise<Lock> {
    return this.acquire(`lock:migration-docnum:${baseDocNumber}`);
  }

  /** Acquire lock ผูกกับ correspondence — กันชนตอนสร้าง revision label ใหม่ใต้ correspondence เดียวกัน */
  public async acquireRevisionChain(correspondenceId: number): Promise<Lock> {
    return this.acquire(`lock:migration-revision:${correspondenceId}`);
  }

  /**
   * Acquire lock ผูกกับ project — กันชนตอน confirm() bulk-save เอกสารหลาย session
   * พร้อมกัน (TTL ยาวกว่าปกติเพราะ transaction อาจคร่อมหลายพันแถว)
   */
  public async acquireProjectImport(projectId: number): Promise<Lock> {
    return this.acquire(
      `lock:migration-project-import:${projectId}`,
      this.longTtlMs
    );
  }

  private async acquire(lockKey: string, ttlMs = this.ttlMs): Promise<Lock> {
    try {
      const lock = await this.redlock.acquire([lockKey], ttlMs);
      this.logger.debug(`Acquired migration lock: ${lockKey}`);
      return lock;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to acquire migration lock ${lockKey}: ${message}`
      );
      throw new ServiceUnavailableException(
        'MIGRATION_LOCK_UNAVAILABLE',
        `Unable to acquire migration lock: ${message}`,
        'ระบบกำลังประมวลผลรายการนี้อยู่ กรุณาลองใหม่อีกครั้ง',
        ['รอสักครู่แล้วลองใหม่']
      );
    }
  }

  /** Release lock — idempotent, ไม่ throw แม้ lock หมดอายุไปแล้ว */
  public async release(lock: Lock): Promise<void> {
    try {
      await lock.release();
    } catch (error) {
      this.logger.warn(
        'Failed to release migration lock (may have expired)',
        error
      );
    }
  }
}
