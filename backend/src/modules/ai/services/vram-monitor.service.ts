// File: backend/src/modules/ai/services/vram-monitor.service.ts
// Change Log:
// - 2026-06-11: Initial creation of VramMonitorService to monitor VRAM headroom from Ollama /api/ps
// - 2026-06-11: เพิ่มการคำนวณ mainModelVramMb ใน getVramHeadroom
// - 2026-06-11: เพิ่ม getVramStatus และ invalidateCache เพื่อความเข้ากันได้กับส่วนอื่น
// - 2026-08-24: ADR-048 T010 — เพิ่ม loadModelVram และ unloadModelVram พร้อม auto-eviction
//   และ global empty-queue check บน AiQueueService (ADR-048 D4)

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import axios from 'axios';
import Redis from 'ioredis';
import { VramHeadroom } from '../interfaces/execution-policy.interface';
import { OllamaService } from './ollama.service';
import { AiQueueService } from '../ai-queue.service';

/** Redis key mutex lock ระหว่าง model transition (ADR-048) */
const REDIS_KEY_MODEL_TRANSITIONING = 'ai:model:transitioning';
/** TTL สำหรับ mutex lock ป้องกัน lock ค้างหาก service crash กลางทาง */
const TRANSITION_LOCK_TTL_SECONDS = 15;

/**
 * ผลลัพธ์ VRAM status สำหรับส่วนบริการภายนอก
 * ผลลัพธ์นี้มีวัตถุประสงค์เพื่อรักษาความเข้ากันได้ย้อนหลัง (Backward Compatibility)
 */
export interface VramStatus {
  totalVramMb: number;
  usedVramMb: number;
  freeVramMb: number;
  loadedModels: Array<{
    modelId: string;
    modelName: string;
    vramUsageMB: number;
  }>;
  hasCapacity: boolean;
}

@Injectable()
export class VramMonitorService {
  private readonly logger = new Logger(VramMonitorService.name);
  private readonly ollamaUrl: string;
  private readonly totalVramMb: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
    private readonly ollamaService: OllamaService,
    private readonly aiQueueService: AiQueueService
  ) {
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      this.configService.get<string>(
        'AI_HOST_URL',
        'http://192.168.10.11:11434'
      )
    );
    this.totalVramMb = this.configService.get<number>(
      'GPU_TOTAL_VRAM_MB',
      16384 // Default to 16GB (RTX 5060 Ti)
    );
  }

  /**
   * ดึงสถานะ VRAM headroom จาก Ollama /api/ps
   * ถ้าล้มเหลวจะคืนค่าด้วย safe default (available = 0)
   */
  async getVramHeadroom(): Promise<VramHeadroom> {
    try {
      const response = await axios.get<{
        models?: Array<{
          name: string;
          size_vram: number;
        }>;
      }>(`${this.ollamaUrl}/api/ps`, { timeout: 3000 });
      const models = response.data?.models ?? [];
      let totalUsedBytes = 0;
      let mainModelUsedBytes = 0;
      for (const model of models) {
        totalUsedBytes += model.size_vram || 0;
        if (model.name.includes('np-dms-ai')) {
          mainModelUsedBytes += model.size_vram || 0;
        }
      }
      const usedMb = Math.round(totalUsedBytes / (1024 * 1024));
      const availableMb = Math.max(0, this.totalVramMb - usedMb);
      const mainModelVramMb = Math.round(mainModelUsedBytes / (1024 * 1024));
      return {
        totalMb: this.totalVramMb,
        usedMb,
        availableMb,
        querySuccess: true,
        mainModelVramMb,
      };
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to query Ollama /api/ps: ${err instanceof Error ? err.message : String(err)}`
      );
      // เปลี่ยนจาก pessimistic (assume all VRAM used) เป็น optimistic (assume no VRAM used)
      // เพื่อป้องกัน false positive OOM Guard เมื่อ query ล้มเหลวแต่ไม่มี model load จริง
      return {
        totalMb: this.totalVramMb,
        usedMb: 0, // สมมติว่าไม่มี model load เมื่อ query ล้มเหลว
        availableMb: this.totalVramMb,
        querySuccess: false,
        mainModelVramMb: 0,
      };
    }
  }

  /**
   * ดึงสถานะ VRAM ปัจจุบันของระบบ
   * เพื่อความเข้ากันได้ย้อนหลังกับ endpoint vram/status
   */
  async getVramStatus(minRequiredMb = 4000): Promise<VramStatus> {
    try {
      const response = await axios.get<{
        models?: Array<{
          name: string;
          size_vram: number;
        }>;
      }>(`${this.ollamaUrl}/api/ps`, { timeout: 3000 });
      const models = response.data?.models ?? [];
      const loadedModels = models.map((m) => ({
        modelId: m.name,
        modelName: m.name,
        vramUsageMB: Math.round((m.size_vram || 0) / (1024 * 1024)),
      }));
      const headroom = await this.getVramHeadroom();
      return {
        totalVramMb: headroom.totalMb,
        usedVramMb: headroom.usedMb,
        freeVramMb: headroom.availableMb,
        loadedModels,
        hasCapacity: headroom.availableMb >= minRequiredMb,
      };
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to get VRAM status: ${err instanceof Error ? err.message : String(err)}`
      );
      // เปลี่ยนจาก pessimistic เป็น optimistic: สมมติว่าไม่มี model load เมื่อ query ล้มเหลว
      return {
        totalVramMb: this.totalVramMb,
        usedVramMb: 0,
        freeVramMb: this.totalVramMb,
        loadedModels: [],
        hasCapacity: true, // สมมติว่ามี capacity เมื่อ query ล้มเหลว
      };
    }
  }

  /**
   * ตรวจสอบว่า VRAM เพียงพอสำหรับความต้องการโหลดโมเดลหรือไม่
   * ถ้าไม่มีโมเดลโหลดอยู่เลย จะอนุญาตให้โหลดโมเดลใหม่ได้เสมอ (ป้องกัน false positive)
   */
  async hasVramCapacity(requiredMb: number): Promise<boolean> {
    const headroom = await this.getVramHeadroom();
    // ถ้าไม่มีโมเดลโหลดอยู่เลย อนุญาตให้โหลดโมเดลใหม่ได้เสมอ
    if (headroom.usedMb === 0 && headroom.querySuccess) {
      this.logger.log(
        `No models loaded in VRAM, allowing model load (required=${requiredMb}MB)`
      );
      return true;
    }
    // ถ้า query ล้มเหลว ใช้ optimistic fallback (assume no VRAM used)
    if (!headroom.querySuccess) {
      this.logger.log(
        `VRAM query failed, using optimistic fallback (required=${requiredMb}MB)`
      );
      return true;
    }
    const hasCapacity = headroom.availableMb >= requiredMb;
    if (!hasCapacity) {
      this.logger.warn(
        `VRAM insufficient: available=${headroom.availableMb}MB, required=${requiredMb}MB`
      );
    }
    return hasCapacity;
  }

  /**
   * ล้าง cache VRAM (ไม่มี cache แล้วในระบบใหม่ แต่เก็บไว้เพื่อรองรับการเรียกใช้เดิม)
   */
  async invalidateCache(): Promise<void> {
    await Promise.resolve();
    this.logger.log('VRAM cache invalidation requested (no-op in new policy)');
  }

  // ─── ADR-048 T010/FR-007/FR-008: VRAM Load / Unload with Guards + Auto-Eviction ──

  /** VRAM ที่จำเป็นสำหรับโมเดลหลัก (MB) — ใช้ในการตัดสินใจ auto-eviction */
  private readonly MODEL_LOAD_REQUIRED_MB = 4000;

  /**
   * โหลดโมเดลเข้า VRAM ผ่าน Ollama keep_alive=-1 (permanent)
   * ADR-048 FR-007: ตรวจสอบ global empty-queue guard ก่อน (ทั้ง ai-batch และ ai-realtime)
   * ADR-048 FR-008: ถ้า VRAM ไม่พอ จะ auto-evict inactive model ก่อนโหลด
   * ADR-048 FR-009: ใช้ atomic SET NX EX สำหรับ transition lock (ownership token)
   * @param modelName ชื่อโมเดล Ollama เช่น np-dms-ai:latest
   * @throws HttpException (409) ถ้ามี active/waiting jobs ใน queue
   */
  async loadModelVram(modelName: string): Promise<void> {
    // FR-007: Global empty-queue guard — ตรวจสอบทั้ง ai-batch และ ai-realtime
    await this.aiQueueService.assertQueuesEmpty();
    this.logger.log(`[VRAM Load] Starting load for model: ${modelName}`);

    // FR-008: Auto-eviction — ถ้า VRAM ไม่พอ ให้ evict inactive model ก่อน
    await this.autoEvictIfNeeded(modelName);

    // FR-009: Atomic lock acquisition ด้วย ownership token (SET NX EX)
    const lockToken = `load-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const acquired = await this.redis.set(
      REDIS_KEY_MODEL_TRANSITIONING,
      lockToken,
      'EX',
      TRANSITION_LOCK_TTL_SECONDS,
      'NX'
    );
    if (!acquired) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          message: 'Conflict',
          userMessage: 'ระบบ AI กำลังอยู่ระหว่างเปลี่ยนโมเดล กรุณาลองอีกครั้ง',
          recoveryAction: 'รอประมาณ 15 วินาทีแล้วลองใหม่',
        },
        HttpStatus.CONFLICT
      );
    }
    try {
      // ส่ง empty generate พร้อม keep_alive=-1 เพื่อบังคับ Ollama โหลดโมเดลเข้า VRAM
      await this.ollamaService.loadModel(modelName, -1);
      this.logger.log(
        `[VRAM Load] Model ${modelName} loaded successfully into VRAM`
      );
    } finally {
      // ลบ lock เฉพาะเมื่อ token ตรงกัน (ป้องกันการลบ lock ของ transition อื่น)
      await this.releaseTransitionLock(lockToken);
    }
  }

  /**
   * Unload โมเดลออกจาก VRAM ผ่าน Ollama keep_alive=0 (evict immediately)
   * ADR-048 FR-007: ตรวจสอบ global empty-queue guard ก่อน (ทั้ง ai-batch และ ai-realtime)
   * ADR-048 FR-009: ใช้ atomic SET NX EX สำหรับ transition lock (ownership token)
   * @param modelName ชื่อโมเดล Ollama
   * @throws HttpException (409) ถ้า AI queue ยังมี active/waiting jobs
   */
  async unloadModelVram(modelName: string): Promise<void> {
    // FR-007: Global empty-queue guard — ตรวจสอบทั้ง ai-batch และ ai-realtime
    await this.aiQueueService.assertQueuesEmpty();
    this.logger.log(`[VRAM Unload] Starting unload for model: ${modelName}`);

    // FR-009: Atomic lock acquisition ด้วย ownership token
    const lockToken = `unload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const acquired = await this.redis.set(
      REDIS_KEY_MODEL_TRANSITIONING,
      lockToken,
      'EX',
      TRANSITION_LOCK_TTL_SECONDS,
      'NX'
    );
    if (!acquired) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          message: 'Conflict',
          userMessage: 'ระบบ AI กำลังอยู่ระหว่างเปลี่ยนโมเดล กรุณาลองอีกครั้ง',
          recoveryAction: 'รอประมาณ 15 วินาทีแล้วลองใหม่',
        },
        HttpStatus.CONFLICT
      );
    }
    try {
      // keep_alive=0 บอก Ollama ให้ evict โมเดลออกจาก VRAM ทันที
      await this.ollamaService.unloadModel(modelName);
      this.logger.log(
        `[VRAM Unload] Model ${modelName} unloaded from VRAM (cold-start warning: 5-10s)`
      );
    } finally {
      // ลบ lock เฉพาะเมื่อ token ตรงกัน
      await this.releaseTransitionLock(lockToken);
    }
  }

  /**
   * ADR-048 FR-008 — Auto-evict inactive model ถ้า VRAM ไม่พอสำหรับโมเดลใหม่
   * ตรวจสอบ VRAM headroom ก่อนโหลด ถ้าไม่พอจะ unload โมเดลอื่นที่ไม่ใช่ target ก่อน
   * @param targetModelName โมเดลที่กำลังจะโหลด
   */
  private async autoEvictIfNeeded(targetModelName: string): Promise<void> {
    const headroom = await this.getVramHeadroom();
    // ถ้า query ล้มเหลวหรือไม่มีโมเดลโหลดอยู่ ข้าม auto-eviction
    if (!headroom.querySuccess || headroom.usedMb === 0) {
      return;
    }
    // ถ้า VRAM พอ ข้าม auto-eviction
    if (headroom.availableMb >= this.MODEL_LOAD_REQUIRED_MB) {
      return;
    }
    // VRAM ไม่พอ — หา inactive model ที่ไม่ใช่ target เพื่อ evict
    this.logger.warn(
      `[VRAM Auto-Evict] VRAM insufficient (available=${headroom.availableMb}MB, required=${this.MODEL_LOAD_REQUIRED_MB}MB) — evicting inactive models before loading ${targetModelName}`
    );
    try {
      const response = await axios.get<{
        models?: Array<{ name: string; size_vram: number }>;
      }>(`${this.ollamaUrl}/api/ps`, { timeout: 3000 });
      const loadedModels = response.data?.models ?? [];
      // Evict โมเดลที่ไม่ใช่ target (ยกเว้นถ้ามีแค่ target อยู่แล้ว)
      for (const model of loadedModels) {
        if (!model.name.includes(targetModelName.replace(':latest', ''))) {
          this.logger.log(
            `[VRAM Auto-Evict] Evicting inactive model: ${model.name}`
          );
          await this.ollamaService.unloadModel(model.name);
        }
      }
    } catch (err: unknown) {
      this.logger.warn(
        `[VRAM Auto-Evict] Failed to query models for eviction: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * ADR-048 FR-009 — ปล่อย transition lock เฉพาะเมื่อ ownership token ตรงกัน
   * ป้องกันการลบ lock ของ transition อื่นที่อาจจะได้ lock หลังจากนี้
   */
  private async releaseTransitionLock(lockToken: string): Promise<void> {
    try {
      const currentToken = await this.redis.get(REDIS_KEY_MODEL_TRANSITIONING);
      if (currentToken === lockToken) {
        await this.redis.del(REDIS_KEY_MODEL_TRANSITIONING);
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to release transition lock: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
