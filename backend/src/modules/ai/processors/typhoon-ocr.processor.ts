// File: src/modules/ai/processors/typhoon-ocr.processor.ts
// Change Log
// - 2026-05-30: Initial processor สำหรับ Typhoon OCR sequential jobs (T009c, ADR-032)
//   รันด้วย concurrency=1 เพื่อป้องกัน VRAM overflow บน RTX 2060 Super (8GB)
//   ใช้ keep_alive=0 ผ่าน sidecar Ollama API เพื่อ unload model หลังประมวลผล

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAuditLog, AiAuditStatus } from '../entities/ai-audit-log.entity';
import { OcrCacheService } from '../services/ocr-cache.service';
import { VramMonitorService } from '../services/vram-monitor.service';
import {
  SandboxOcrEngineService,
  SandboxOcrEngineType,
} from '../services/sandbox-ocr-engine.service';

/** ชื่อ queue สำหรับ Typhoon OCR jobs */
export const QUEUE_TYPHOON_OCR = 'typhoon-ocr';

/** รูปแบบข้อมูล job ใน Typhoon OCR queue */
export interface TyphoonOcrJobData {
  /** public path ของไฟล์ PDF ที่ต้องการ OCR */
  pdfPath: string;
  /** engineType: เสมอเป็น 'typhoon-ocr-3b' สำหรับ queue นี้ */
  engineType: SandboxOcrEngineType;
  /** idempotencyKey สำหรับ Redis result key */
  idempotencyKey: string;
  /** documentPublicId สำหรับ audit log (optional) */
  documentPublicId?: string;
}

// VRAM ที่ Typhoon OCR-3B ต้องการ (MB) — ตาม ADR-032
const TYPHOON_OCR_REQUIRED_VRAM_MB = 4000;

/**
 * Processor สำหรับ Typhoon OCR jobs ที่รันแบบ sequential (concurrency=1)
 * เพื่อป้องกัน VRAM overflow เมื่อทำ OCR หลายงานพร้อมกันบน RTX 2060 Super
 * ตาม ADR-032: lockDuration=180000ms รองรับ 120s timeout + buffer
 */
@Processor(QUEUE_TYPHOON_OCR, { concurrency: 1, lockDuration: 180000 })
export class TyphoonOcrProcessor extends WorkerHost {
  private readonly logger = new Logger(TyphoonOcrProcessor.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(AiAuditLog)
    private readonly auditLogRepo: Repository<AiAuditLog>,
    private readonly ocrCacheService: OcrCacheService,
    private readonly vramMonitorService: VramMonitorService,
    private readonly sandboxOcrEngineService: SandboxOcrEngineService
  ) {
    super();
  }

  /** ประมวลผล Typhoon OCR job ทีละงาน */
  async process(job: Job<TyphoonOcrJobData>): Promise<void> {
    const { pdfPath, engineType, idempotencyKey, documentPublicId } = job.data;
    const startTime = Date.now();
    this.logger.log(
      `Typhoon OCR job started — idempotencyKey=${idempotencyKey}, engine=${engineType}`
    );
    // ตรวจสอบ Redis cache ก่อน — ถ้ามีผลลัพธ์แล้วไม่ต้องรัน OCR ซ้ำ
    const cached = await this.ocrCacheService.get(pdfPath, engineType);
    if (cached) {
      this.logger.log(
        `OCR cache hit: ${idempotencyKey} (engine=${engineType})`
      );
      await this.saveResult(idempotencyKey, {
        text: cached.text,
        engineUsed: cached.engineUsed,
        cacheHit: true,
        processingTimeMs: Date.now() - startTime,
      });
      await this.writeAuditLog({
        documentPublicId,
        engineType,
        status: AiAuditStatus.SUCCESS,
        processingTimeMs: Date.now() - startTime,
        cacheHit: true,
      });
      return;
    }
    // ตรวจสอบ VRAM ก่อนโหลด model
    const hasCapacity = await this.vramMonitorService.hasVramCapacity(
      TYPHOON_OCR_REQUIRED_VRAM_MB
    );
    if (!hasCapacity) {
      const errMsg = `VRAM ไม่เพียงพอสำหรับ Typhoon OCR-3B (ต้องการ ${TYPHOON_OCR_REQUIRED_VRAM_MB}MB) — retry ภายหลัง`;
      this.logger.warn(errMsg);
      await this.writeAuditLog({
        documentPublicId,
        engineType,
        status: AiAuditStatus.FAILED,
        errorMessage: errMsg,
        processingTimeMs: Date.now() - startTime,
        cacheHit: false,
      });
      throw new Error(errMsg);
    }
    // รัน OCR ผ่าน SandboxOcrEngineService (ซึ่งส่งคำขอไป sidecar → Ollama)
    try {
      const result = await this.sandboxOcrEngineService.detectAndExtract(
        pdfPath,
        engineType
      );
      const processingTimeMs = Date.now() - startTime;
      // บันทึกผลลัพธ์ใน Redis cache (24h TTL)
      await this.ocrCacheService.set(pdfPath, engineType, {
        text: result.text,
        engineUsed: result.engineUsed,
        charCount: result.text.length,
      });
      // Invalidate VRAM cache เพราะ keep_alive=0 unloaded model แล้ว
      await this.vramMonitorService.invalidateCache();
      await this.saveResult(idempotencyKey, {
        text: result.text,
        engineUsed: result.engineUsed,
        fallbackUsed: result.fallbackUsed,
        cacheHit: false,
        processingTimeMs,
      });
      await this.writeAuditLog({
        documentPublicId,
        engineType,
        status: AiAuditStatus.SUCCESS,
        processingTimeMs,
        cacheHit: false,
      });
      this.logger.log(
        `Typhoon OCR completed — ${result.text.length} chars, ${processingTimeMs}ms`
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Typhoon OCR job failed: ${errMsg}`);
      await this.writeAuditLog({
        documentPublicId,
        engineType,
        status: AiAuditStatus.FAILED,
        errorMessage: errMsg,
        processingTimeMs: Date.now() - startTime,
        cacheHit: false,
      });
      throw err;
    }
  }

  /** บันทึกผลลัพธ์ OCR ลง Redis สำหรับ polling */
  private async saveResult(
    idempotencyKey: string,
    result: {
      text: string;
      engineUsed: string;
      fallbackUsed?: boolean;
      cacheHit: boolean;
      processingTimeMs: number;
    }
  ): Promise<void> {
    await this.redis.setex(
      `ai:typhoon:ocr:${idempotencyKey}`,
      3600,
      JSON.stringify({
        idempotencyKey,
        status: 'completed',
        ...result,
        completedAt: new Date().toISOString(),
      })
    );
  }

  /** บันทึก audit log สำหรับ Typhoon OCR interaction */
  private async writeAuditLog(params: {
    documentPublicId?: string;
    engineType: string;
    status: AiAuditStatus;
    processingTimeMs: number;
    cacheHit: boolean;
    errorMessage?: string;
  }): Promise<void> {
    const log = this.auditLogRepo.create({
      documentPublicId: params.documentPublicId,
      aiModel: 'typhoon-ocr',
      modelName: 'scb10x/typhoon-ocr-3b',
      modelType: params.engineType,
      status: params.status,
      processingTimeMs: params.processingTimeMs,
      cacheHit: params.cacheHit,
      errorMessage: params.errorMessage,
    });
    await this.auditLogRepo.save(log);
  }
}
