// File: src/modules/ai/services/ocr-cache.service.ts
// Change Log
// - 2026-05-30: Initial implementation สำหรับ Typhoon OCR 24-hour result caching (T007, ADR-032)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { createHash } from 'crypto';

/** ผลลัพธ์ที่ cache ไว้ใน Redis */
export interface CachedOcrResult {
  text: string;
  engineUsed: string;
  charCount: number;
  cachedAt: string; // ISO string
}

// TTL 24 ชั่วโมง (ตามที่กำหนดใน ADR-032)
const OCR_CACHE_TTL_SECONDS = 24 * 60 * 60;
// Prefix key ใน Redis
const OCR_CACHE_PREFIX = 'ai:ocr:result:';

/**
 * บริการ cache ผลลัพธ์ OCR ใน Redis สำหรับ Typhoon OCR
 * Key: SHA-256(pdfPath + engineType) เพื่อป้องกัน key collision ระหว่าง engine ต่างๆ
 * TTL: 24 ชั่วโมง ตาม ADR-032
 */
@Injectable()
export class OcrCacheService {
  private readonly logger = new Logger(OcrCacheService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * สร้าง Redis cache key จาก pdfPath และ engineType
   * ใช้ SHA-256 เพื่อหลีกเลี่ยง key ยาวเกินไปและ cache collision
   */
  private buildKey(pdfPath: string, engineType: string): string {
    const hash = createHash('sha256')
      .update(`${pdfPath}::${engineType}`)
      .digest('hex');
    return `${OCR_CACHE_PREFIX}${hash}`;
  }

  /**
   * ดึงผลลัพธ์ OCR จาก Redis cache
   * คืน null ถ้าไม่มี cache หรือ cache หมดอายุ
   */
  async get(
    pdfPath: string,
    engineType: string
  ): Promise<CachedOcrResult | null> {
    const key = this.buildKey(pdfPath, engineType);
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as CachedOcrResult;
    } catch (err: unknown) {
      // Cache miss ที่เกิดจาก parse error — ไม่ throw, คืน null เพื่อ fallback OCR จริง
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`OCR cache get failed for ${engineType}: ${msg}`);
      return null;
    }
  }

  /**
   * บันทึกผลลัพธ์ OCR ลง Redis cache พร้อม TTL 24 ชั่วโมง
   */
  async set(
    pdfPath: string,
    engineType: string,
    result: Omit<CachedOcrResult, 'cachedAt'>
  ): Promise<void> {
    const key = this.buildKey(pdfPath, engineType);
    const value: CachedOcrResult = {
      ...result,
      cachedAt: new Date().toISOString(),
    };
    try {
      await this.redis.setex(key, OCR_CACHE_TTL_SECONDS, JSON.stringify(value));
      this.logger.debug(
        `OCR cache set: ${engineType} for ${pdfPath} (TTL 24h)`
      );
    } catch (err: unknown) {
      // Cache write failure ไม่ควร block OCR flow
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`OCR cache set failed: ${msg}`);
    }
  }

  /**
   * ลบ cache entry สำหรับไฟล์ที่ระบุ (เช่น หลังจากไฟล์ถูกแก้ไข)
   */
  async invalidate(pdfPath: string, engineType: string): Promise<void> {
    const key = this.buildKey(pdfPath, engineType);
    try {
      await this.redis.del(key);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`OCR cache invalidate failed: ${msg}`);
    }
  }

  /** ตรวจสอบว่ามี cache อยู่หรือไม่ (ไม่ดึงข้อมูล) */
  async exists(pdfPath: string, engineType: string): Promise<boolean> {
    const key = this.buildKey(pdfPath, engineType);
    const count = await this.redis.exists(key);
    return count > 0;
  }
}
