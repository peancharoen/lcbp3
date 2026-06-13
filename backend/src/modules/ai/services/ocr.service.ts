// File: backend/src/modules/ai/services/ocr.service.ts
// Change Log
// - 2026-05-15: เพิ่ม OCR auto-detection service สำหรับ ADR-023A.
// - 2026-05-25: แก้ไข AggregateError (empty message) จาก axios โดย wrap เป็น Error พร้อม context ที่ชัดเจน.
// - 2026-05-25: เพิ่ม path remapping (OCR_UPLOAD_BASE_PATH) เพื่อแปลง local upload path เป็น path ที่ sidecar เห็นผ่าน CIFS.
// - 2026-05-29: เพิ่ม checkHealth() เพื่อตรวจสอบสุขภาพของ OCR sidecar สำหรับ getSystemHealth() (ADR-027)
// - 2026-05-30: เปลี่ยนจาก PaddleOCR เป็น Tesseract OCR เพื่อความเข้ากันได้กับ CPU เก่า
// - 2026-05-30: เพิ่ม VRAM insufficiency guard สำหรับ Typhoon OCR engine (T016a, ADR-032)
// - 2026-05-30: ปรับปรุงสำหรับ Dynamic OCR Engine selection, Caching, และ Graceful Fallback (T013, T014, T016, T022, T023, US1)
// - 2026-06-01: ปรับปรุง remapPath ให้รองรับ Windows absolute และ relative path ได้แม่นยำ 100%
// - 2026-06-01: เปลี่ยน processWithTesseract/processWithTyphoon ให้ส่ง file content ผ่าน multipart ไปยัง /ocr-upload แทนการส่ง path
// - 2026-06-02: ส่งค่า X-API-Key ใน request headers ไปยัง ocr-sidecar เพื่อความมั่นคงปลอดภัยสูงสุด (ADR-033, Suggestion 2)
// - 2026-06-04: ADR-034 — เปลี่ยน TYPHOON_ENGINE.engineName เป็น typhoon-np-dms-ocr:latest ตรงกับชื่อโมเดลใน Ollama
// - 2026-06-11: US2 - คำนวณ OCR residency keep_alive แบบ dynamic ตาม VRAM headroom และ active profile
// - 2026-06-13: US5 - เพิ่มการส่ง temperature, topP และ repeatPenalty ไปยัง OCR sidecar ผ่าน multipart form (T070)

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import axios from 'axios';
import * as fs from 'fs';
import {
  OcrEngineConfiguration,
  OcrEngineType,
} from '../entities/ocr-engine-configuration.entity';
import { OcrEngineResponseDto } from '../dto/ocr-engine-response.dto';
import { SystemSetting } from '../entities/system-setting.entity';
import { AiAuditLog, AiAuditStatus } from '../entities/ai-audit-log.entity';
import { OcrCacheService } from './ocr-cache.service';
import { VramMonitorService } from './vram-monitor.service';
import { AiPolicyService } from './ai-policy.service';
import { ExecutionProfile } from '../interfaces/execution-policy.interface';
import { OcrResidencyDecision } from '../interfaces/ocr-residency.interface';

export interface OcrDetectionInput {
  extractedText?: string;
  extractedChars?: number;
  pdfPath?: string;
  documentPublicId?: string; // เพิ่มเพื่อการทำ audit logs
  activeProfile?: ExecutionProfile;
  typhoonOptions?: {
    temperature?: number;
    topP?: number;
    repeatPenalty?: number;
  };
}

export interface OcrDetectionResult {
  text: string;
  ocrUsed: boolean;
}

interface OcrSidecarResponse {
  text?: string;
}

export interface OcrHealthResult {
  status: 'HEALTHY' | 'DOWN';
  latencyMs: number;
  url: string;
  error?: string;
}

const OCR_ACTIVE_ENGINE_KEY = 'OCR_ACTIVE_ENGINE';
const OCR_ACTIVE_ENGINE_CACHE_KEY = 'system_settings:OCR_ACTIVE_ENGINE';
const OCR_ACTIVE_ENGINE_TTL_SECONDS = 30;

const TESSERACT_ENGINE_ID = '019505a1-7c3e-7000-8000-abc123def001';
const TYPHOON_ENGINE_ID = '019505a1-7c3e-7000-8000-abc123def002';

// VRAM ที่ Typhoon OCR-3B ต้องการ (MB)
const TYPHOON_OCR_REQUIRED_VRAM_MB = 4000;

const TESSERACT_ENGINE: OcrEngineConfiguration = {
  engineId: TESSERACT_ENGINE_ID,
  engineName: 'Tesseract OCR',
  engineType: OcrEngineType.TESSERACT,
  isActive: true,
  vramRequirementMB: 0,
  processingTimeLimitSeconds: 30,
  concurrentLimit: 10,
  fallbackEngineId: null,
  createdAt: new Date('2026-05-30T00:00:00Z'),
  updatedAt: new Date('2026-05-30T00:00:00Z'),
};

const TYPHOON_ENGINE: OcrEngineConfiguration = {
  engineId: TYPHOON_ENGINE_ID,
  engineName: 'typhoon-np-dms-ocr:latest',
  engineType: OcrEngineType.TYPHOON_OCR,
  isActive: true,
  vramRequirementMB: TYPHOON_OCR_REQUIRED_VRAM_MB,
  processingTimeLimitSeconds: 60,
  concurrentLimit: 1,
  fallbackEngineId: TESSERACT_ENGINE_ID,
  createdAt: new Date('2026-05-30T00:00:00Z'),
  updatedAt: new Date('2026-05-30T00:00:00Z'),
};

const ENGINES_MAP = new Map<string, OcrEngineConfiguration>([
  [TESSERACT_ENGINE_ID, TESSERACT_ENGINE],
  [TYPHOON_ENGINE_ID, TYPHOON_ENGINE],
]);

/** บริการเลือก fast path หรือ OCR sidecar (Tesseract/Typhoon) พร้อมความสามารถในสลับ Engine และ Caching */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly threshold: number;
  private readonly ocrApiUrl: string;
  private readonly ocrSidecarApiKey: string;
  private readonly vramHeadroomThresholdMb: number;
  private readonly ocrResidencyWindowSeconds: number;
  private readonly mainModelPressureThresholdMb: number;
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    @InjectRepository(AiAuditLog)
    private readonly auditLogRepo: Repository<AiAuditLog>,
    private readonly ocrCacheService: OcrCacheService,
    private readonly vramMonitorService: VramMonitorService,
    private readonly aiPolicyService: AiPolicyService,
    @InjectRedis() private readonly redis: Redis
  ) {
    this.threshold = this.configService.get<number>('OCR_CHAR_THRESHOLD', 100);
    this.ocrApiUrl = this.configService.get<string>(
      'OCR_API_URL',
      'http://localhost:8765'
    );
    this.ocrSidecarApiKey = this.configService.get<string>(
      'OCR_SIDECAR_API_KEY',
      'lcbp3-dms-ocr-sidecar-secure-token-2026'
    );
    this.vramHeadroomThresholdMb = this.configService.get<number>(
      'VRAM_HEADROOM_THRESHOLD_MB',
      this.configService.get<number>('AI_VRAM_HEADROOM_THRESHOLD_MB', 3000)
    );
    this.ocrResidencyWindowSeconds = this.configService.get<number>(
      'OCR_RESIDENCY_WINDOW_SECONDS',
      this.configService.get<number>('AI_OCR_RESIDENCY_WINDOW_SECONDS', 120)
    );
    this.mainModelPressureThresholdMb = this.configService.get<number>(
      'GPU_MAIN_MODEL_PRESSURE_THRESHOLD_MB',
      this.configService.get<number>(
        'AI_GPU_MAIN_MODEL_PRESSURE_THRESHOLD_MB',
        12000
      )
    );
  }

  /**
   * คำนวณ keep_alive สำหรับ OCR ตามความจุ VRAM และประวัติการรัน
   */
  async calculateOcrResidency(
    activeProfile?: ExecutionProfile | null
  ): Promise<OcrResidencyDecision> {
    try {
      const headroom = await this.vramMonitorService.getVramHeadroom();
      if (!headroom.querySuccess) {
        return {
          keepAliveSeconds: 0,
          vramHeadroomMb: 0,
          activeProfile: activeProfile ?? null,
          reason: 'query-failed',
        };
      }
      if (activeProfile === 'deep-analysis') {
        this.logger.log(`OCR Residency: deep-analysis active, keep_alive = 0`);
        return {
          keepAliveSeconds: 0,
          vramHeadroomMb: headroom.availableMb,
          activeProfile,
          reason: 'deep-analysis-active',
        };
      }
      const isHighPressure =
        (headroom.mainModelVramMb ?? 0) > this.mainModelPressureThresholdMb ||
        headroom.availableMb < this.vramHeadroomThresholdMb;
      if (isHighPressure) {
        this.logger.log(
          `OCR Residency: VRAM pressure is high (main: ${headroom.mainModelVramMb}MB, avail: ${headroom.availableMb}MB), keep_alive = 0`
        );
        return {
          keepAliveSeconds: 0,
          vramHeadroomMb: headroom.availableMb,
          activeProfile: activeProfile ?? null,
          reason: 'high-pressure',
        };
      }
      this.logger.log(
        `OCR Residency: VRAM headroom sufficient (${headroom.availableMb} MB), keep_alive = ${this.ocrResidencyWindowSeconds}`
      );
      return {
        keepAliveSeconds: this.ocrResidencyWindowSeconds,
        vramHeadroomMb: headroom.availableMb,
        activeProfile: activeProfile ?? null,
        reason: 'headroom-sufficient',
      };
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to calculate OCR residency: ${err instanceof Error ? err.message : String(err)}`
      );
      return {
        keepAliveSeconds: 0,
        vramHeadroomMb: 0,
        activeProfile: activeProfile ?? null,
        reason: 'query-failed',
      };
    }
  }

  /** ดึงรายการ OCR Engines ทั้งหมด พร้อมตรวจสอบตัวที่กำลัง Active */
  async getOcrEngines(): Promise<OcrEngineResponseDto[]> {
    const activeEngineId = await this.getActiveEngineId();
    return Array.from(ENGINES_MAP.values()).map((engine) => ({
      ...engine,
      isCurrentActive: engine.engineId === activeEngineId,
    }));
  }

  /** บันทึกการเลือก OCR Engine หลัก */
  async selectOcrEngine(
    engineId: string,
    userId: number
  ): Promise<OcrEngineConfiguration> {
    const selectedEngine = ENGINES_MAP.get(engineId);
    if (!selectedEngine) {
      throw new NotFoundException(`OCR Engine with ID ${engineId} not found`);
    }

    await this.settingRepo.manager.transaction(
      async (manager: EntityManager): Promise<void> => {
        const repo = manager.getRepository(SystemSetting);
        const existing = await repo.findOne({
          where: { settingKey: OCR_ACTIVE_ENGINE_KEY },
        });

        const setting =
          existing ??
          repo.create({
            settingKey: OCR_ACTIVE_ENGINE_KEY,
            dataType: 'string',
            category: 'ai',
            description: 'เอนจิน OCR หลักที่ใช้งานในระบบ (global)',
            isPublic: true,
          });

        setting.settingValue = engineId;
        setting.updatedBy = userId;
        await repo.save(setting);
      }
    );

    await this.redis.del(OCR_ACTIVE_ENGINE_CACHE_KEY);
    this.logger.log(
      `Active OCR Engine changed to ${selectedEngine.engineName} (ID: ${engineId}) by user ${userId}`
    );
    return selectedEngine;
  }

  /** ดึง ID ของ OCR Engine ที่ใช้งานอยู่ปัจจุบัน */
  async getActiveEngineId(): Promise<string> {
    try {
      const cachedValue = await this.redis.get(OCR_ACTIVE_ENGINE_CACHE_KEY);
      if (cachedValue) return cachedValue;

      const setting = await this.settingRepo.findOne({
        where: { settingKey: OCR_ACTIVE_ENGINE_KEY },
      });

      const activeEngine = setting?.settingValue ?? TESSERACT_ENGINE_ID;
      await this.redis.set(
        OCR_ACTIVE_ENGINE_CACHE_KEY,
        activeEngine,
        'EX',
        OCR_ACTIVE_ENGINE_TTL_SECONDS
      );
      return activeEngine;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get active OCR engine: ${error instanceof Error ? error.message : String(error)}`
      );
      return TESSERACT_ENGINE_ID;
    }
  }

  async checkHealth(): Promise<OcrHealthResult> {
    const startTime = Date.now();
    try {
      await axios.get(`${this.ocrApiUrl}/health`, {
        timeout: 5000,
        headers: { 'X-API-Key': this.ocrSidecarApiKey },
      });
      return {
        status: 'HEALTHY',
        latencyMs: Date.now() - startTime,
        url: this.ocrApiUrl,
      };
    } catch (err: unknown) {
      const cause = err instanceof Error ? err.message : String(err);
      this.logger.warn(`OCR sidecar health check failed: ${cause}`);
      return {
        status: 'DOWN',
        latencyMs: Date.now() - startTime,
        url: this.ocrApiUrl,
        error: cause,
      };
    }
  }

  /** ตรวจสอบ text layer ก่อนเลือก OCR slow path */
  async detectAndExtract(
    input: OcrDetectionInput
  ): Promise<OcrDetectionResult> {
    const extractedText = input.extractedText ?? '';
    const extractedChars = input.extractedChars ?? extractedText.length;

    if (extractedChars > this.threshold) {
      return { text: extractedText, ocrUsed: false };
    }

    if (!input.pdfPath) {
      this.logger.warn('OCR slow path skipped because pdfPath is missing');
      return { text: extractedText, ocrUsed: false };
    }

    const activeEngineId = await this.getActiveEngineId();

    if (activeEngineId === TYPHOON_ENGINE_ID) {
      return this.processWithTyphoon(input);
    } else {
      return this.processWithTesseract(input);
    }
  }

  /** ประมวลผลผ่าน Tesseract OCR โดยส่ง file content ผ่าน multipart */
  private async processWithTesseract(
    input: OcrDetectionInput
  ): Promise<OcrDetectionResult> {
    const startTime = Date.now();
    try {
      this.logger.debug(`Tesseract OCR processing: ${input.pdfPath}`);
      const fileBuffer = fs.readFileSync(input.pdfPath!);
      const form = new FormData();
      form.append(
        'file',
        new Blob([fileBuffer], { type: 'application/pdf' }),
        'upload.pdf'
      );
      form.append('engine', 'auto');
      const response = await axios.post<OcrSidecarResponse>(
        `${this.ocrApiUrl}/ocr-upload`,
        form,
        {
          timeout: 90000,
          headers: { 'X-API-Key': this.ocrSidecarApiKey },
        }
      );
      const text = response.data.text ?? '';
      const durationMs = Date.now() - startTime;
      await this.writeAuditLog({
        documentPublicId: input.documentPublicId,
        aiModel: 'tesseract',
        modelName: 'tesseract-ocr',
        modelType: 'tesseract',
        status: AiAuditStatus.SUCCESS,
        processingTimeMs: durationMs,
        cacheHit: false,
      });
      return { text, ocrUsed: true };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const cause =
        err instanceof AggregateError && err.errors?.length
          ? err.errors
              .map((e: unknown) => (e instanceof Error ? e.message : String(e)))
              .join('; ')
          : err instanceof Error
            ? err.message
            : String(err);
      await this.writeAuditLog({
        documentPublicId: input.documentPublicId,
        aiModel: 'tesseract',
        modelName: 'tesseract-ocr',
        modelType: 'tesseract',
        status: AiAuditStatus.FAILED,
        processingTimeMs: durationMs,
        errorMessage: cause,
        cacheHit: false,
      });
      throw new Error(`Tesseract OCR Sidecar failed: ${cause}`);
    }
  }

  /** ประมวลผลผ่าน Typhoon OCR */
  private async processWithTyphoon(
    input: OcrDetectionInput
  ): Promise<OcrDetectionResult> {
    const startTime = Date.now();
    try {
      const hasCapacity = await this.vramMonitorService.hasVramCapacity(
        TYPHOON_OCR_REQUIRED_VRAM_MB
      );
      if (!hasCapacity) {
        this.logger.warn(
          `VRAM insufficient for Typhoon OCR. Falling back to Tesseract baseline.`
        );
        return this.processWithTesseract(input);
      }
      const residency = await this.calculateOcrResidency(input.activeProfile);
      const keepAlive = residency.keepAliveSeconds;
      this.logger.debug(`Typhoon OCR processing: ${input.pdfPath}`);
      const fileBuffer = fs.readFileSync(input.pdfPath!);
      const form = new FormData();
      form.append(
        'file',
        new Blob([fileBuffer], { type: 'application/pdf' }),
        'upload.pdf'
      );
      form.append('engine', 'typhoon-np-dms-ocr');
      form.append('keep_alive', String(keepAlive));
      if (input.typhoonOptions?.temperature !== undefined) {
        form.append('temperature', String(input.typhoonOptions.temperature));
      }
      if (input.typhoonOptions?.topP !== undefined) {
        form.append('topP', String(input.typhoonOptions.topP));
      }
      if (input.typhoonOptions?.repeatPenalty !== undefined) {
        form.append(
          'repeatPenalty',
          String(input.typhoonOptions.repeatPenalty)
        );
      }
      const response = await axios.post<OcrSidecarResponse>(
        `${this.ocrApiUrl}/ocr-upload`,
        form,
        {
          timeout: 120000,
          headers: { 'X-API-Key': this.ocrSidecarApiKey },
        }
      );
      const text = response.data.text ?? '';
      const durationMs = Date.now() - startTime;
      await this.writeAuditLog({
        documentPublicId: input.documentPublicId,
        aiModel: 'typhoon-ocr',
        modelName: 'typhoon-np-dms-ocr:latest',
        modelType: 'typhoon-ocr',
        status: AiAuditStatus.SUCCESS,
        processingTimeMs: durationMs,
        cacheHit: false,
      });
      return {
        text,
        ocrUsed: true,
      };
    } catch (err: unknown) {
      this.logger.warn(
        `Typhoon OCR failed, trying fallback baseline (Tesseract): ${err instanceof Error ? err.message : String(err)}`
      );
      return this.processWithTesseract(input);
    }
  }

  /** บันทึก Log การรัน AI */
  private async writeAuditLog(log: {
    documentPublicId?: string;
    aiModel: string;
    modelName: string;
    modelType: string;
    status: AiAuditStatus;
    processingTimeMs: number;
    errorMessage?: string;
    cacheHit: boolean;
  }): Promise<void> {
    try {
      await this.auditLogRepo.save(
        this.auditLogRepo.create({
          documentPublicId: log.documentPublicId,
          aiModel: log.aiModel,
          modelName: log.modelName,
          processingTimeMs: log.processingTimeMs,
          status: log.status,
          errorMessage: log.errorMessage,
        })
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to save AI Audit Log: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /** เรียก Sidecar /embed เพื่อทำ BGE-M3 (Dense + Sparse) embedding (T012) */
  async embedViaSidecar(text: string): Promise<{
    dense: number[];
    sparse: { indices: number[]; values: number[] };
    device?: string;
  }> {
    try {
      const response = await axios.post(
        `${this.ocrApiUrl}/embed`,
        { text },
        {
          headers: {
            'X-API-Key': this.ocrSidecarApiKey,
          },
        }
      );
      return response.data as {
        dense: number[];
        sparse: { indices: number[]; values: number[] };
        device?: string;
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to embed via Sidecar: ${msg}`);
      throw new Error(`AI_SIDECAR_EMBED_FAILED: ${msg}`);
    }
  }

  /** เรียก Sidecar /rerank เพื่อทำ BGE-Reranker-Large re-ranking (T014) */
  async rerankViaSidecar(
    query: string,
    chunks: string[]
  ): Promise<{ scores: number[]; ranked_indices: number[]; device?: string }> {
    try {
      const response = await axios.post(
        `${this.ocrApiUrl}/rerank`,
        { query, chunks },
        {
          headers: {
            'X-API-Key': this.ocrSidecarApiKey,
          },
        }
      );
      return response.data as {
        scores: number[];
        ranked_indices: number[];
        device?: string;
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to rerank via Sidecar: ${msg}`);
      throw new Error(`AI_SIDECAR_RERANK_FAILED: ${msg}`);
    }
  }
}
