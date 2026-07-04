// File: backend/src/modules/ai/processors/np-dms-ai.processor.ts
// Change Log
// - 2026-05-30: Initial processor สำหรับ np-dms-ai sequential jobs (T009d, ADR-032)
//   รันด้วย concurrency=1 เพื่อป้องกัน VRAM overflow บน RTX 2060 Super (8GB)
//   ใช้ keep_alive=0 ผ่าน Ollama API เพื่อ unload model หลังประมวลผล
// - 2026-06-20: เปลี่ยนชื่อจาก typhoon-llm.processor.ts เป็น np-dms-ai.processor.ts

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiAuditLog, AiAuditStatus } from '../entities/ai-audit-log.entity';
import { VramMonitorService } from '../services/vram-monitor.service';

/** ชื่อ queue สำหรับ np-dms-ai LLM jobs */
export const QUEUE_NP_DMS_AI = 'np-dms-ai';

/** รูปแบบข้อมูล job ใน np-dms-ai LLM queue */
export interface NpDmsAiJobData {
  /** prompt ที่จะส่งให้ np-dms-ai LLM */
  prompt: string;
  /** ชื่อ model เช่น np-dms-ai:latest */
  model?: string;
  /** idempotencyKey สำหรับ Redis result key */
  idempotencyKey: string;
  /** documentPublicId สำหรับ audit log (optional) */
  documentPublicId?: string;
  /** projectPublicId สำหรับ data isolation */
  projectPublicId?: string;
}

/** Ollama generate API response */
interface OllamaGenerateResponse {
  response: string;
  done: boolean;
}

// VRAM ที่ np-dms-ai ต้องการ (MB) — ตาม ADR-032
const NP_DMS_AI_REQUIRED_VRAM_MB = 4500;
// Timeout 120 วินาทีสำหรับ LLM generation
const NP_DMS_AI_TIMEOUT_MS = 120000;

/**
 * Processor สำหรับ np-dms-ai LLM jobs ที่รันแบบ sequential (concurrency=1)
 * เพื่อป้องกัน VRAM overflow เมื่อรัน LLM หลายงานพร้อมกันบน RTX 2060 Super
 * ตาม ADR-032: lockDuration=180000ms รองรับ 120s timeout + buffer
 */
@Processor(QUEUE_NP_DMS_AI, { concurrency: 1, lockDuration: 180000 })
export class NpDmsAiProcessor extends WorkerHost {
  private readonly logger = new Logger(NpDmsAiProcessor.name);
  private readonly ollamaUrl: string;
  private readonly defaultModel: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(AiAuditLog)
    private readonly auditLogRepo: Repository<AiAuditLog>,
    private readonly vramMonitorService: VramMonitorService
  ) {
    super();
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      this.configService.get<string>(
        'AI_HOST_URL',
        'http://192.168.10.11:11434'
      )
    );
    this.defaultModel = this.configService.get<string>(
      'OLLAMA_MODEL_MAIN',
      'np-dms-ai:latest'
    );
  }

  /** ประมวลผล np-dms-ai LLM job ทีละงาน */
  async process(job: Job<NpDmsAiJobData>): Promise<void> {
    const { prompt, model, idempotencyKey, documentPublicId } = job.data;
    const startTime = Date.now();
    const targetModel = model ?? this.defaultModel;
    this.logger.log(
      `np-dms-ai LLM job started — idempotencyKey=${idempotencyKey}, model=${targetModel}`
    );
    // ตรวจสอบ VRAM ก่อนโหลด model
    const hasCapacity = await this.vramMonitorService.hasVramCapacity(
      NP_DMS_AI_REQUIRED_VRAM_MB
    );
    if (!hasCapacity) {
      const errMsg = `VRAM ไม่เพียงพอสำหรับ ${targetModel} (ต้องการ ${NP_DMS_AI_REQUIRED_VRAM_MB}MB) — retry ภายหลัง`;
      this.logger.warn(errMsg);
      await this.saveResult(idempotencyKey, {
        status: 'failed',
        errorMessage: errMsg,
        processingTimeMs: Date.now() - startTime,
      });
      await this.writeAuditLog({
        documentPublicId,
        model: targetModel,
        status: AiAuditStatus.FAILED,
        errorMessage: errMsg,
        processingTimeMs: Date.now() - startTime,
      });
      throw new Error(errMsg);
    }
    try {
      // เรียก Ollama generate API พร้อม keep_alive=0 เพื่อ unload model หลังประมวลผล
      const response = await axios.post<OllamaGenerateResponse>(
        `${this.ollamaUrl}/api/generate`,
        {
          model: targetModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.0,
            top_p: 0.9,
            repeat_penalty: 1.0,
          },
          keep_alive: 0,
        },
        { timeout: NP_DMS_AI_TIMEOUT_MS }
      );
      const processingTimeMs = Date.now() - startTime;
      const generatedText = response.data.response ?? '';
      // Invalidate VRAM cache เพราะ keep_alive=0 unloaded model แล้ว
      await this.vramMonitorService.invalidateCache();
      await this.saveResult(idempotencyKey, {
        status: 'completed',
        response: generatedText,
        model: targetModel,
        processingTimeMs,
      });
      await this.writeAuditLog({
        documentPublicId,
        model: targetModel,
        status: AiAuditStatus.SUCCESS,
        processingTimeMs,
      });
      this.logger.log(
        `np-dms-ai LLM completed — ${generatedText.length} chars, ${processingTimeMs}ms`
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`np-dms-ai LLM job failed: ${errMsg}`);
      await this.saveResult(idempotencyKey, {
        status: 'failed',
        errorMessage: errMsg,
        processingTimeMs: Date.now() - startTime,
      });
      await this.writeAuditLog({
        documentPublicId,
        model: targetModel,
        status: AiAuditStatus.FAILED,
        errorMessage: errMsg,
        processingTimeMs: Date.now() - startTime,
      });
      throw err;
    }
  }

  /** บันทึกผลลัพธ์ LLM ลง Redis สำหรับ polling */
  private async saveResult(
    idempotencyKey: string,
    result: {
      status: 'completed' | 'failed';
      response?: string;
      model?: string;
      processingTimeMs: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    await this.redis.setex(
      `ai:np-dms-ai:llm:${idempotencyKey}`,
      3600,
      JSON.stringify({
        idempotencyKey,
        ...result,
        completedAt: new Date().toISOString(),
      })
    );
  }

  /** บันทึก audit log สำหรับ np-dms-ai LLM interaction */
  private async writeAuditLog(params: {
    documentPublicId?: string;
    model: string;
    status: AiAuditStatus;
    processingTimeMs: number;
    errorMessage?: string;
  }): Promise<void> {
    const log = this.auditLogRepo.create({
      documentPublicId: params.documentPublicId,
      aiModel: 'np-dms-ai',
      modelName: params.model,
      modelType: 'llm',
      status: params.status,
      processingTimeMs: params.processingTimeMs,
      cacheHit: false,
      errorMessage: params.errorMessage,
    });
    await this.auditLogRepo.save(log);
  }
}
