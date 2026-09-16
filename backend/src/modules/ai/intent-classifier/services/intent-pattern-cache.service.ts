// File: src/modules/ai/intent-classifier/services/intent-pattern-cache.service.ts
// Change Log
// - 2026-05-19: สร้าง Redis cache service สำหรับ Intent Patterns (ADR-024).
// - 2026-09-16: เพิ่ม single-flight สำหรับ cache-miss load (spec 224 Edge Case 1 —
//   query พร้อมกันหลายรายการต้อง hit DB ครั้งเดียว ไม่ให้เกิด thundering herd)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntentPattern } from '../entities/intent-pattern.entity';
import { CachedPattern } from '../interfaces/classification-result.interface';

/** Redis cache key สำหรับ active patterns ทั้งหมด */
const CACHE_KEY = 'ai:intent:patterns:active';

/**
 * Service สำหรับ cache Intent Patterns ใน Redis
 * Strategy: Single Key JSON Array, TTL 5 นาที (ปรับได้ผ่าน ENV)
 */
@Injectable()
export class IntentPatternCacheService {
  private readonly logger = new Logger(IntentPatternCacheService.name);
  private readonly ttlSeconds: number;
  /**
   * In-flight DB load ที่กำลังดำเนินการอยู่ — ใช้ dedupe concurrent cache misses
   * (single-flight: caller ที่มาทีหลังรอผลของ promise เดิมแทนการ query ซ้ำ)
   */
  private inflightLoad: Promise<CachedPattern[]> | null = null;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(IntentPattern)
    private readonly patternRepo: Repository<IntentPattern>,
    private readonly configService: ConfigService
  ) {
    this.ttlSeconds = this.configService.get<number>(
      'INTENT_PATTERN_CACHE_TTL',
      300
    );
  }

  /**
   * ดึง Active Patterns จาก Cache หรือ DB (cache-aside pattern)
   * เรียงตาม priority ASC — ต่ำ = ตรวจก่อน
   */
  async getActivePatterns(): Promise<CachedPattern[]> {
    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as CachedPattern[];
      }
    } catch (err) {
      this.logger.warn(
        'Redis get failed, falling back to DB',
        err instanceof Error ? err.message : String(err)
      );
    }

    return this.loadAndCache();
  }

  /** Invalidate cache เมื่อ Admin แก้ไข Pattern */
  async invalidate(): Promise<void> {
    try {
      await this.redis.del(CACHE_KEY);
      this.logger.log('Intent pattern cache invalidated');
    } catch (err) {
      this.logger.error(
        'Redis del failed',
        err instanceof Error ? err.stack : String(err)
      );
    }
  }

  /** โหลด patterns จาก DB แล้ว set ใน Redis (dedupe ผ่าน inflightLoad) */
  private async loadAndCache(): Promise<CachedPattern[]> {
    // ถ้ามี load ที่กำลังทำอยู่ให้รอผลเดียวกัน — กัน thundering herd ตอน cache หมดอายุพร้อมกัน
    if (this.inflightLoad) {
      return this.inflightLoad;
    }
    this.inflightLoad = this.doLoadAndCache().finally(() => {
      this.inflightLoad = null;
    });
    return this.inflightLoad;
  }

  /** ทำงานจริงของการโหลด patterns จาก DB แล้วเขียนลง Redis */
  private async doLoadAndCache(): Promise<CachedPattern[]> {
    const patterns = await this.patternRepo.find({
      where: { isActive: true },
      order: { priority: 'ASC' },
    });

    const cached: CachedPattern[] = patterns.map((p) => ({
      publicId: p.publicId,
      intentCode: p.intentCode,
      language: p.language,
      patternType: p.patternType,
      patternValue: p.patternValue,
      priority: p.priority,
    }));

    try {
      await this.redis.setex(
        CACHE_KEY,
        this.ttlSeconds,
        JSON.stringify(cached)
      );
    } catch (err) {
      this.logger.warn(
        'Redis setex failed, patterns loaded from DB only',
        err instanceof Error ? err.message : String(err)
      );
    }

    return cached;
  }
}
