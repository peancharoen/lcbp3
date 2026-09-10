// File: backend/src/modules/ai/services/rag-generation-lock.service.ts
// Change Log:
// - 2026-09-09: เพิ่ม Redlock สำหรับ serialize RAG generation swap (Feature 254)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import Redlock, { Lock } from 'redlock';
import { ServiceUnavailableException } from '../../../common/exceptions';

/** บริการล็อก Attachment ระหว่าง generation build/swap */
@Injectable()
export class RagGenerationLockService {
  private readonly logger = new Logger(RagGenerationLockService.name);
  private readonly redlock: Redlock;
  private readonly ttlMs = 30_000;

  constructor(@InjectRedis() redis: Redis) {
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 5,
      retryDelay: 100,
      retryJitter: 50,
    });
  }

  /** Acquire lock ที่ผูกกับ Attachment publicId */
  public async acquire(attachmentPublicId: string): Promise<Lock> {
    const lockKey = `lock:rag-attachment:${attachmentPublicId}`;
    try {
      const lock = await this.redlock.acquire([lockKey], this.ttlMs);
      this.logger.debug(`Acquired RAG generation lock: ${attachmentPublicId}`);
      return lock;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to acquire RAG generation lock for ${attachmentPublicId}: ${message}`
      );
      throw new ServiceUnavailableException(
        'RAG_GENERATION_LOCK_UNAVAILABLE',
        `Unable to acquire RAG generation lock: ${message}`,
        'ระบบกำลังประมวลผลไฟล์นี้อยู่ กรุณาลองใหม่อีกครั้ง',
        ['รอให้การประมวลผลเดิมเสร็จ', 'ลองใหม่อีกครั้ง']
      );
    }
  }
}
