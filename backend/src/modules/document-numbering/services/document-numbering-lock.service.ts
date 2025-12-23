import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import Redlock, { Lock } from 'redlock';

interface LockCounterKey {
  projectId: number;
  originatorOrgId: number;
  recipientOrgId: number;
  correspondenceTypeId: number;
  subTypeId: number;
  rfaTypeId: number;
  disciplineId: number;
  resetScope: string;
}

@Injectable()
export class DocumentNumberingLockService {
  private readonly logger = new Logger(DocumentNumberingLockService.name);
  private redlock: Redlock;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 5,
      retryDelay: 100,
      retryJitter: 50,
    });
  }

  async acquireLock(key: LockCounterKey): Promise<Lock> {
    const lockKey = this.buildLockKey(key);
    const ttl = 5000; // 5 seconds

    try {
      const lock = await this.redlock.acquire([lockKey], ttl);
      this.logger.debug(`Acquired lock: ${lockKey}`);
      return lock;
    } catch (error) {
      this.logger.error(`Failed to acquire lock: ${lockKey}`, error);
      throw error;
    }
  }

  async releaseLock(lock: Lock): Promise<void> {
    try {
      await lock.release();
      this.logger.debug(`Released lock`);
    } catch (error) {
      this.logger.warn('Failed to release lock (may have expired)', error);
    }
  }

  private buildLockKey(key: LockCounterKey): string {
    return (
      `lock:docnum:${key.projectId}:${key.originatorOrgId}:` +
      `${key.recipientOrgId ?? 0}:${key.correspondenceTypeId}:` +
      `${key.subTypeId}:${key.rfaTypeId}:${key.disciplineId}:${key.resetScope}`
    );
  }
}
