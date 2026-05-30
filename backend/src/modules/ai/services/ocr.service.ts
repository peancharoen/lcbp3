// File: src/modules/ai/services/ocr.service.ts
// Change Log
// - 2026-05-15: เพิ่ม OCR auto-detection service สำหรับ ADR-023A.
// - 2026-05-25: แก้ไข AggregateError (empty message) จาก axios โดย wrap เป็น Error พร้อม context ที่ชัดเจน.
// - 2026-05-25: เพิ่ม path remapping (OCR_UPLOAD_BASE_PATH) เพื่อแปลง local upload path เป็น path ที่ sidecar เห็นผ่าน CIFS.
// - 2026-05-29: เพิ่ม checkHealth() เพื่อตรวจสอบสุขภาพของ OCR sidecar สำหรับ getSystemHealth() (ADR-027)
// - 2026-05-30: เปลี่ยนจาก PaddleOCR เป็น Tesseract OCR เพื่อความเข้ากันได้กับ CPU เก่า
// - 2026-05-30: เพิ่ม VRAM insufficiency guard สำหรับ Typhoon OCR engine (T016a, ADR-032)
// - 2026-05-30: ปรับปรุงสำหรับ Dynamic OCR Engine selection, Caching, และ Graceful Fallback (T013, T014, T016, T022, T023, US1)

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import axios from 'axios';
import {
  OcrEngineConfiguration,
  OcrEngineType,
} from '../entities/ocr-engine-configuration.entity';
import { OcrEngineResponseDto } from '../dto/ocr-engine-response.dto';
import { SystemSetting } from '../entities/system-setting.entity';
import { AiAuditLog, AiAuditStatus } from '../entities/ai-audit-log.entity';
import { OcrCacheService } from './ocr-cache.service';
import { VramMonitorService } from './vram-monitor.service';

export interface OcrDetectionInput {
  extractedText?: string;
  extractedChars?: number;
  pdfPath?: string;
  documentPublicId?: string; // เพิ่มเพื่อการทำ audit logs
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
  engineName: 'Typhoon OCR-3B',
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
  private readonly localUploadBase: string;
  private readonly sidecarUploadBase: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    @InjectRepository(AiAuditLog)
    private readonly auditLogRepo: Repository<AiAuditLog>,
    private readonly ocrCacheService: OcrCacheService,
    private readonly vramMonitorService: VramMonitorService,
    @InjectRedis() private readonly redis: Redis
  ) {
    this.threshold = this.configService.get<number>('OCR_CHAR_THRESHOLD', 100);
    this.ocrApiUrl = this.configService.get<string>(
      'OCR_API_URL',
      'http://localhost:8765'
    );
    this.localUploadBase = this.configService
      .get<string>('UPLOAD_PERMANENT_DIR', '/app/uploads/permanent')
      .replace(/\/permanent$/, '');
    this.sidecarUploadBase = this.configService.get<string>(
      'OCR_SIDECAR_UPLOAD_BASE',
      '/mnt/uploads'
    );
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

  /** แปลง local upload path เป็น path ที่ sidecar เห็นผ่าน CIFS mount */
  private remapPath(localPath: string): string {
    if (this.localUploadBase && localPath.startsWith(this.localUploadBase)) {
      return localPath.replace(this.localUploadBase, this.sidecarUploadBase);
    }
    return localPath;
  }

  /** ตรวจสอบสุขภาพและ latency ของ OCR sidecar (Tesseract) ผ่าน GET /health */
  async checkHealth(): Promise<OcrHealthResult> {
    const startTime = Date.now();
    try {
      await axios.get(`${this.ocrApiUrl}/health`, { timeout: 5000 });
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

  /** ประมวลผลผ่าน Tesseract OCR */
  private async processWithTesseract(
    input: OcrDetectionInput
  ): Promise<OcrDetectionResult> {
    const startTime = Date.now();
    const sidecarPath = this.remapPath(input.pdfPath!);

    try {
      this.logger.debug(
        `Tesseract OCR processing: ${input.pdfPath} → ${sidecarPath}`
      );
      const response = await axios.post<OcrSidecarResponse>(
        `${this.ocrApiUrl}/ocr`,
        { pdfPath: sidecarPath },
        { timeout: 90000 }
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

      return {
        text,
        ocrUsed: true,
      };
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
        cacheHit: false,
        errorMessage: cause,
      });

      throw new Error(
        `OCR sidecar (Tesseract) unreachable at ${this.ocrApiUrl} — ${cause}`
      );
    }
  }

  /** ประมวลผลผ่าน Typhoon OCR พร้อม Caching และ Fallback */
  private async processWithTyphoon(
    input: OcrDetectionInput
  ): Promise<OcrDetectionResult> {
    const startTime = Date.now();
    const pdfPath = input.pdfPath!;
    const engineType = 'typhoon-ocr-3b';

    // 1. ตรวจสอบ Redis cache (T022)
    try {
      const cached = await this.ocrCacheService.get(pdfPath, engineType);
      if (cached) {
        this.logger.log(`OCR Cache Hit for Typhoon OCR: ${pdfPath}`);
        const durationMs = Date.now() - startTime;

        await this.writeAuditLog({
          documentPublicId: input.documentPublicId,
          aiModel: 'typhoon-ocr',
          modelName: 'scb10x/typhoon-ocr-3b',
          modelType: engineType,
          status: AiAuditStatus.SUCCESS,
          processingTimeMs: durationMs,
          cacheHit: true,
        });

        return {
          text: cached.text,
          ocrUsed: true,
        };
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Cache checking failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // 2. ตรวจสอบปริมาณ VRAM ก่อนประมวลผล (T016a)
    const hasCapacity = await this.vramMonitorService.hasVramCapacity(
      TYPHOON_OCR_REQUIRED_VRAM_MB
    );
    if (!hasCapacity) {
      const errorMsg = `VRAM capacity (< 4GB) insufficient for Typhoon OCR-3B. Fallback to Tesseract.`;
      return this.fallbackToTesseract(
        pdfPath,
        errorMsg,
        input.documentPublicId
      );
    }

    // 3. เรียกประมวลผล Typhoon OCR
    const sidecarPath = this.remapPath(pdfPath);
    try {
      this.logger.log(`Calling Typhoon OCR-3B for: ${sidecarPath}`);
      const response = await axios.post<OcrSidecarResponse>(
        `${this.ocrApiUrl}/ocr`,
        { pdfPath: sidecarPath, engine: engineType },
        { timeout: 60000 } // 60s timeout per ADR-032
      );

      const text = response.data.text ?? '';
      const durationMs = Date.now() - startTime;

      // เซ็ต Cache ลง Redis 24 ชั่วโมง (T022)
      await this.ocrCacheService.set(pdfPath, engineType, {
        text,
        engineUsed: engineType,
        charCount: text.length,
      });

      // Invalidate VRAM monitor cache เนื่องจากใช้ keep_alive = 0 โมเดลจะถูก unload ทันที
      await this.vramMonitorService.invalidateCache();

      // บันทึก Audit Log (T023)
      await this.writeAuditLog({
        documentPublicId: input.documentPublicId,
        aiModel: 'typhoon-ocr',
        modelName: 'scb10x/typhoon-ocr-3b',
        modelType: engineType,
        status: AiAuditStatus.SUCCESS,
        processingTimeMs: durationMs,
        cacheHit: false,
        vramUsageMb: TYPHOON_OCR_REQUIRED_VRAM_MB,
      });

      return {
        text,
        ocrUsed: true,
      };
    } catch (err: unknown) {
      const cause = err instanceof Error ? err.message : String(err);
      const errorMsg = `Typhoon OCR API call failed: ${cause}`;

      // 4. สลับเอนจินสำรองอัตโนมัติ (Graceful Fallback to Tesseract - T016)
      return this.fallbackToTesseract(
        pdfPath,
        errorMsg,
        input.documentPublicId
      );
    }
  }

  /** สลับไปใช้งาน Tesseract OCR อัตโนมัติในฐานะระบบสำรอง (Graceful Fallback - T016) */
  private async fallbackToTesseract(
    pdfPath: string,
    originalError: string,
    documentPublicId?: string
  ): Promise<OcrDetectionResult> {
    this.logger.warn(
      `Typhoon OCR processing failed, initiating graceful fallback to Tesseract: ${originalError}`
    );
    const startTime = Date.now();
    const sidecarPath = this.remapPath(pdfPath);

    try {
      const response = await axios.post<OcrSidecarResponse>(
        `${this.ocrApiUrl}/ocr`,
        { pdfPath: sidecarPath }, // ส่งโดยไม่มี engine parameter เพื่อให้เป็น Tesseract
        { timeout: 30000 } // 30s timeout สำหรับ fallback
      );

      const text = response.data.text ?? '';
      const durationMs = Date.now() - startTime;

      // บันทึก Audit Log ด้วยสถานะ SUCCESS สำหรับ Tesseract แต่ระบุ Error ของ Typhoon ไว้
      await this.writeAuditLog({
        documentPublicId,
        aiModel: 'tesseract',
        modelName: 'tesseract-ocr',
        modelType: 'tesseract',
        status: AiAuditStatus.SUCCESS,
        processingTimeMs: durationMs,
        cacheHit: false,
        errorMessage: `Graceful fallback from Typhoon OCR. Original error: ${originalError}`,
      });

      return {
        text,
        ocrUsed: true,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const cause = err instanceof Error ? err.message : String(err);
      this.logger.error(`OCR fallback to Tesseract failed: ${cause}`);

      await this.writeAuditLog({
        documentPublicId,
        aiModel: 'tesseract',
        modelName: 'tesseract-ocr',
        modelType: 'tesseract',
        status: AiAuditStatus.FAILED,
        processingTimeMs: durationMs,
        cacheHit: false,
        errorMessage: `Fallback failed: ${cause}. Original Typhoon error: ${originalError}`,
      });

      throw new Error(
        `OCR processing failed entirely. Typhoon error: ${originalError}. Fallback error: ${cause}`
      );
    }
  }

  /** เขียนบันทึก AI Audit Log (T023) */
  private async writeAuditLog(params: {
    documentPublicId?: string;
    aiModel: string;
    modelName: string;
    modelType: string;
    status: AiAuditStatus;
    processingTimeMs: number;
    cacheHit: boolean;
    vramUsageMb?: number;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const log = this.auditLogRepo.create({
        documentPublicId: params.documentPublicId,
        aiModel: params.aiModel,
        modelName: params.modelName,
        modelType: params.modelType,
        status: params.status,
        processingTimeMs: params.processingTimeMs,
        cacheHit: params.cacheHit,
        vramUsageMb: params.vramUsageMb,
        errorMessage: params.errorMessage,
      });
      await this.auditLogRepo.save(log);
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to write AI audit log: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
