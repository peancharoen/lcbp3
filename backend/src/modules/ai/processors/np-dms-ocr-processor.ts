// File: src/modules/ai/processors/np-dms-ocr-processor.ts
// Change Log
// - 2026-05-30: Initial processor สำหรับ np-dms-ocr sequential jobs (T009c, ADR-032)
//   รันด้วย concurrency=1 เพื่อป้องกัน VRAM overflow บน RTX 2060 Super (8GB)
//   ใช้ keep_alive=0 ผ่าน sidecar Ollama API เพื่อ unload model หลังประมวลผล
// - 2026-06-20: เปลี่ยนชื่อไฟล์จาก typhoon-ocr.processor.ts → np-dms-ocr-processor.ts
// - 2026-09-19: ADR-055 D15 — re-OCR branch: pointer/payload Redis, forceRefresh, conditional VRAM gate, empty→failed
// - 2026-09-19: ADR-055 D10 — เขียน status:'failed' ลง Redis ก่อน throw ทั้ง 2 failure path
//   (VRAM gate + catch) เฉพาะ attempt สุดท้าย เพื่อไม่ให้ polling client เห็นสถานะค้างเงียบ ๆ

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUE_NP_DMS_OCR } from '../../common/constants/queue.constants';
import {
  RE_OCR_TTL_SECONDS,
  ReOcrPayload,
  ReOcrPointer,
  reOcrPayloadKey,
  reOcrPointerKey,
} from '../../../common/file-storage/re-ocr.constants';
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
  OcrNpDmsOptions,
} from '../services/sandbox-ocr-engine.service';

// re-export เพื่อ backward-compat กับ importer เดิม (ai.module, monitoring)
export { QUEUE_NP_DMS_OCR };

/** รูปแบบข้อมูล job ใน np-dms-ocr queue */
export interface NpDmsOcrJobData {
  /** public path ของไฟล์ PDF ที่ต้องการ OCR */
  pdfPath: string;
  /** engineType: 'np-dms-ocr' สำหรับ queue นี้ */
  engineType: SandboxOcrEngineType;
  /** idempotencyKey สำหรับ Redis result key */
  idempotencyKey: string;
  /** documentPublicId สำหรับ audit log (optional) */
  documentPublicId?: string;
  /** np-dms-ocr options จาก sandbox UI เพื่อ override Modelfile defaults (optional) */
  ocrOptions?: OcrNpDmsOptions;
  // ── ADR-055 D15: re-OCR contract — ถ้ามี reOcrToken = job ประเภท re-OCR ──
  /** publicId ของ attachment ที่ถูก re-OCR (ใช้สร้าง Redis pointer key) */
  attachmentPublicId?: string;
  /** token ผูก job ↔ payload key (`attachment:re-ocr:{id}:{token}`) */
  reOcrToken?: string;
  /** ข้าม OcrCacheService.get() — ป้องกัน silent no-op จาก cache 24h */
  forceRefresh?: boolean;
  /** ชื่อผู้กด trigger (แสดงใน UI "เริ่มโดย …") */
  triggeredByDisplayName?: string;
  /** เวลา trigger (ISO) */
  triggeredAt?: string;
}

// VRAM ที่ np-dms-ocr ต้องการ (MB) — ตาม ADR-032
const NP_DMS_OCR_REQUIRED_VRAM_MB = 4000;

/**
 * Processor สำหรับ np-dms-ocr jobs ที่รันแบบ sequential (concurrency=1)
 * เพื่อป้องกัน VRAM overflow เมื่อทำ OCR หลายงานพร้อมกันบน RTX 2060 Super
 * ตาม ADR-032: lockDuration=180000ms รองรับ 120s timeout + buffer
 */
@Processor(QUEUE_NP_DMS_OCR, { concurrency: 1, lockDuration: 180000 })
export class NpDmsOcrProcessor extends WorkerHost {
  private readonly logger = new Logger(NpDmsOcrProcessor.name);

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

  /** ประมวลผล np-dms-ocr job ทีละงาน */
  async process(job: Job<NpDmsOcrJobData>): Promise<void> {
    const {
      pdfPath,
      engineType,
      idempotencyKey,
      documentPublicId,
      ocrOptions,
      forceRefresh,
    } = job.data;
    const isReOcr = this.isReOcrJob(job.data);
    const startTime = Date.now();
    this.logger.log(
      `np-dms-ocr job started — idempotencyKey=${idempotencyKey}, engine=${engineType}, reOcr=${String(isReOcr)}`
    );
    if (isReOcr) {
      await this.updateReOcrPointer(job, {
        status: 'processing',
        attempt: job.attemptsMade + 1,
      });
    }
    // ตรวจสอบ Redis cache ก่อน — ถ้ามีผลลัพธ์แล้วไม่ต้องรัน OCR ซ้ำ
    // ADR-055 D15: re-OCR (forceRefresh) ข้าม cache-read เพื่อไม่ให้ได้ text เดิมกลับมา (silent no-op)
    const cached = forceRefresh
      ? null
      : await this.ocrCacheService.get(pdfPath, engineType);
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
      if (isReOcr) {
        await this.completeReOcr(job, {
          text: cached.text,
          engineUsed: cached.engineUsed,
          processingTimeMs: Date.now() - startTime,
        });
      }
      return;
    }
    // ตรวจสอบ VRAM ก่อนโหลด model — เฉพาะ np-dms-ocr (ADR-055 D7: 'auto' ใช้ PyMuPDF/CPU ก่อน ไม่ต้อง gate)
    if (engineType === 'np-dms-ocr') {
      const hasCapacity = await this.vramMonitorService.hasVramCapacity(
        NP_DMS_OCR_REQUIRED_VRAM_MB
      );
      if (!hasCapacity) {
        const errMsg = `VRAM ไม่เพียงพอสำหรับ np-dms-ocr (ต้องการ ${NP_DMS_OCR_REQUIRED_VRAM_MB}MB) — retry ภายหลัง`;
        this.logger.warn(errMsg);
        await this.writeAuditLog({
          documentPublicId,
          engineType,
          status: AiAuditStatus.FAILED,
          errorMessage: errMsg,
          processingTimeMs: Date.now() - startTime,
          cacheHit: false,
        });
        await this.reportFailure(job, errMsg);
        throw new Error(errMsg);
      }
    }
    // รัน OCR ผ่าน SandboxOcrEngineService (ซึ่งส่งคำขอไป sidecar → Ollama)
    try {
      const result = await this.sandboxOcrEngineService.detectAndExtract(
        pdfPath,
        engineType,
        ocrOptions
      );
      const processingTimeMs = Date.now() - startTime;
      // ADR-055 D16: re-OCR ที่ได้ text ว่างเปล่า = failed ทันที (ไม่ retry — ผลว่างไม่ใช่ transient) ไม่ cache/ไม่เขียน payload
      if (isReOcr && result.text.trim().length === 0) {
        await this.failReOcrEmpty(job, engineType, documentPublicId, startTime);
        return;
      }
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
      if (isReOcr) {
        await this.completeReOcr(job, {
          text: result.text,
          engineUsed: result.engineUsed,
          processingTimeMs,
        });
      }
      this.logger.log(
        `np-dms-ocr completed — ${result.text.length} chars, ${processingTimeMs}ms`
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`np-dms-ocr job failed: ${errMsg}`);
      await this.writeAuditLog({
        documentPublicId,
        engineType,
        status: AiAuditStatus.FAILED,
        errorMessage: errMsg,
        processingTimeMs: Date.now() - startTime,
        cacheHit: false,
      });
      await this.reportFailure(job, errMsg);
      throw err;
    }
  }

  /** job นี้เป็น re-OCR ของ attachment (ADR-055 D15) หรือไม่ */
  private isReOcrJob(data: NpDmsOcrJobData): data is NpDmsOcrJobData & {
    attachmentPublicId: string;
    reOcrToken: string;
  } {
    return Boolean(data.reOcrToken && data.attachmentPublicId);
  }

  /**
   * อัปเดต status pointer `attachment:re-ocr:{publicId}` แบบ merge (ADR-055 D4)
   * — ไม่เขียนถ้า pointer ถูก supersede ด้วย token ใหม่แล้ว (trigger ซ้อน)
   */
  private async updateReOcrPointer(
    job: Job<NpDmsOcrJobData>,
    patch: Partial<ReOcrPointer>
  ): Promise<void> {
    const { attachmentPublicId, reOcrToken } = job.data;
    if (!attachmentPublicId || !reOcrToken) {
      return;
    }
    const key = reOcrPointerKey(attachmentPublicId);
    const raw = await this.redis.get(key);
    let existing: Partial<ReOcrPointer> = {};
    if (raw) {
      try {
        existing = JSON.parse(raw) as Partial<ReOcrPointer>;
      } catch {
        this.logger.warn(`Re-OCR pointer เสียหาย — สร้างใหม่: ${key}`);
      }
    }
    if (existing.reOcrToken && existing.reOcrToken !== reOcrToken) {
      this.logger.warn(
        `Re-OCR pointer ถูก supersede (${existing.reOcrToken}) — job ${reOcrToken} ไม่เขียนทับ`
      );
      return;
    }
    const next: ReOcrPointer = {
      status: 'queued',
      reOcrToken,
      jobId: String(job.id),
      engineType: job.data.engineType,
      triggeredByDisplayName: job.data.triggeredByDisplayName ?? '',
      triggeredAt: job.data.triggeredAt ?? new Date().toISOString(),
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.setex(key, RE_OCR_TTL_SECONDS, JSON.stringify(next));
  }

  /**
   * re-OCR สำเร็จ: เขียน payload ก่อน แล้วค่อยตั้ง pointer = completed (completed ต้องมี payload เสมอ)
   * Known limitation: ถ้า worker crash ระหว่าง 2 writes → pointer ค้าง processing จน TTL 72h
   * (admin เห็น processing ค้าง แล้ว trigger ใหม่ได้หลัง job ตาย — ไม่มี data corruption)
   */
  private async completeReOcr(
    job: Job<NpDmsOcrJobData>,
    result: { text: string; engineUsed: string; processingTimeMs: number }
  ): Promise<void> {
    const { attachmentPublicId, reOcrToken } = job.data;
    if (!attachmentPublicId || !reOcrToken) {
      return;
    }
    const payload: ReOcrPayload = {
      newText: result.text,
      engineUsed: result.engineUsed,
      charCount: result.text.length,
      processingTimeMs: result.processingTimeMs,
      completedAt: new Date().toISOString(),
    };
    await this.redis.setex(
      reOcrPayloadKey(attachmentPublicId, reOcrToken),
      RE_OCR_TTL_SECONDS,
      JSON.stringify(payload)
    );
    await this.updateReOcrPointer(job, {
      status: 'completed',
      attempt: undefined,
      errorMessage: undefined,
    });
  }

  /** re-OCR ได้ text ว่าง → failed ทันที (ไม่ retry) */
  private async failReOcrEmpty(
    job: Job<NpDmsOcrJobData>,
    engineType: string,
    documentPublicId: string | undefined,
    startTime: number
  ): Promise<void> {
    const errMsg = 'engine คืนผลลัพธ์ว่างเปล่า';
    this.logger.warn(`np-dms-ocr re-OCR: ${errMsg} — job ${String(job.id)}`);
    await this.writeAuditLog({
      documentPublicId,
      engineType,
      status: AiAuditStatus.FAILED,
      errorMessage: errMsg,
      processingTimeMs: Date.now() - startTime,
      cacheHit: false,
    });
    await this.writeFailedKey(job.data.idempotencyKey, errMsg);
    await this.updateReOcrPointer(job, {
      status: 'failed',
      errorMessage: errMsg,
      attempt: undefined,
    });
  }

  /**
   * ADR-055 D10: เขียน status:'failed' ลง Redis เฉพาะ attempt สุดท้าย
   * (attempt ก่อนหน้ายังมี retry — ไม่เขียนเพื่อกันสถานะกะพริบ failed→processing)
   * re-OCR job: อัปเดต status pointer ด้วย
   */
  private async reportFailure(
    job: Job<NpDmsOcrJobData>,
    errorMessage: string
  ): Promise<void> {
    const maxAttempts = job.opts?.attempts ?? 1;
    if (job.attemptsMade + 1 < maxAttempts) {
      return;
    }
    await this.writeFailedKey(job.data.idempotencyKey, errorMessage);
    if (this.isReOcrJob(job.data)) {
      await this.updateReOcrPointer(job, {
        status: 'failed',
        errorMessage,
        attempt: undefined,
      });
    }
  }

  /** เขียน `ai:np-dms-ocr:{key}` = failed สำหรับ polling ทั่วไป */
  private async writeFailedKey(
    idempotencyKey: string,
    errorMessage: string
  ): Promise<void> {
    await this.redis.setex(
      `ai:np-dms-ocr:${idempotencyKey}`,
      3600,
      JSON.stringify({
        idempotencyKey,
        status: 'failed',
        errorMessage,
        failedAt: new Date().toISOString(),
      })
    );
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
      `ai:np-dms-ocr:${idempotencyKey}`,
      3600,
      JSON.stringify({
        idempotencyKey,
        status: 'completed',
        ...result,
        completedAt: new Date().toISOString(),
      })
    );
  }

  /** บันทึก audit log สำหรับ np-dms-ocr interaction */
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
      aiModel: 'np-dms-ocr',
      modelName: 'np-dms-ocr:latest',
      modelType: params.engineType,
      status: params.status,
      processingTimeMs: params.processingTimeMs,
      cacheHit: params.cacheHit,
      errorMessage: params.errorMessage,
    });
    await this.auditLogRepo.save(log);
  }
}
