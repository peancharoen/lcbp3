// File: src/modules/ai/services/vram-monitor.service.ts
// Change Log
// - 2026-05-30: Initial implementation สำหรับ Typhoon OCR VRAM monitoring (T006, ADR-032)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

/** ข้อมูล VRAM จาก Ollama PS API */
export interface OllamaModelInfo {
  name: string;
  size_vram: number; // bytes
}

/** ผลลัพธ์ VRAM status */
export interface VramStatus {
  totalVramMb: number;
  usedVramMb: number;
  freeVramMb: number;
  loadedModels: string[];
  hasCapacity: boolean; // true ถ้า free VRAM >= minRequiredMb
}

/** ผลลัพธ์ภายในจาก Ollama /api/ps */
interface OllamaProcessStatus {
  models?: OllamaModelInfo[];
}

// Redis key สำหรับ cache VRAM status
const VRAM_STATUS_CACHE_KEY = 'ai:vram:status';
// TTL 10 วินาที — refresh บ่อยพอสำหรับ real-time monitoring
const VRAM_STATUS_TTL_SECONDS = 10;
// VRAM limit สำหรับ RTX 2060 Super (8192 MB)
const GPU_TOTAL_VRAM_MB = 8192;
// Threshold: ไม่โหลด model ถ้า usage > 90%
const VRAM_USAGE_LIMIT_PERCENT = 0.9;

/** บริการตรวจสอบ VRAM GPU ผ่าน Ollama API ตาม ADR-032 */
@Injectable()
export class VramMonitorService {
  private readonly logger = new Logger(VramMonitorService.name);
  private readonly ollamaUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis
  ) {
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      this.configService.get<string>('AI_HOST_URL', 'http://localhost:11434')
    );
  }

  /**
   * ดึงสถานะ VRAM ปัจจุบันจาก Ollama /api/ps
   * ใช้ Redis cache TTL 10 วินาทีเพื่อลด overhead
   */
  async getVramStatus(minRequiredMb = 4000): Promise<VramStatus> {
    const cached = await this.redis.get(VRAM_STATUS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as VramStatus;
      parsed.hasCapacity = parsed.freeVramMb >= minRequiredMb;
      return parsed;
    }
    return this.fetchAndCacheVramStatus(minRequiredMb);
  }

  /** ตรวจสอบว่า VRAM เพียงพอสำหรับโหลด model ที่ต้องการ */
  async hasVramCapacity(requiredMb: number): Promise<boolean> {
    const status = await this.getVramStatus(requiredMb);
    return status.hasCapacity;
  }

  /** ดึงข้อมูล VRAM จาก Ollama และ cache ใน Redis */
  private async fetchAndCacheVramStatus(
    minRequiredMb: number
  ): Promise<VramStatus> {
    try {
      const response = await axios.get<OllamaProcessStatus>(
        `${this.ollamaUrl}/api/ps`,
        { timeout: 5000 }
      );
      const models = response.data.models ?? [];
      const loadedModels = models.map((m) => m.name);
      // คำนวณ VRAM ที่ใช้จาก models ที่โหลดอยู่
      const usedVramBytes = models.reduce(
        (sum, m) => sum + (m.size_vram ?? 0),
        0
      );
      const usedVramMb = Math.round(usedVramBytes / 1024 / 1024);
      // จำกัด VRAM ไม่เกิน limit 90% ของ GPU ทั้งหมด
      const maxAllowedMb = Math.floor(
        GPU_TOTAL_VRAM_MB * VRAM_USAGE_LIMIT_PERCENT
      );
      const freeVramMb = Math.max(0, maxAllowedMb - usedVramMb);
      const status: VramStatus = {
        totalVramMb: GPU_TOTAL_VRAM_MB,
        usedVramMb,
        freeVramMb,
        loadedModels,
        hasCapacity: freeVramMb >= minRequiredMb,
      };
      await this.redis.setex(
        VRAM_STATUS_CACHE_KEY,
        VRAM_STATUS_TTL_SECONDS,
        JSON.stringify(status)
      );
      return status;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `VRAM status fetch failed: ${msg} — ใช้ค่า conservative fallback`
      );
      // Fallback: สมมติว่า VRAM ไม่พอเมื่อ Ollama ไม่ตอบสนอง
      return {
        totalVramMb: GPU_TOTAL_VRAM_MB,
        usedVramMb: GPU_TOTAL_VRAM_MB,
        freeVramMb: 0,
        loadedModels: [],
        hasCapacity: false,
      };
    }
  }

  /**
   * ล้าง VRAM cache (เรียกหลังจาก model unload ด้วย keep_alive=0)
   * เพื่อให้ status check ครั้งต่อไปดึงข้อมูลใหม่จาก Ollama
   */
  async invalidateCache(): Promise<void> {
    await this.redis.del(VRAM_STATUS_CACHE_KEY);
  }
}
