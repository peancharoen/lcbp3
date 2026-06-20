// File: backend/src/modules/ai/services/ai-policy.service.ts
// Change Log:
// - 2026-06-11: Initial creation of AiPolicyService for managing execution profiles and policies
// - 2026-06-11: แก้ไขข้อผิดพลาด TS2367 (เทียบ profile กับ ocr-extract) และลบบรรทัดว่างในฟังก์ชัน getProfileParameters
// - 2026-06-13: ADR-036 — เพิ่ม canonical model defaults และ OCR snapshot params
// - 2026-06-13: T022 — เพิ่ม saveSandboxDraft (UPSERT sandbox draft)
// - 2026-06-13: T023 — เพิ่ม resetSandboxToProduction (overwrite draft ด้วยค่า production)
// - 2026-06-13: T035, T038 — เพิ่ม applyProfile และ validatePolicyParams สำหรับการปรับใช้ sandbox draft ไปยัง production
// - 2026-06-13: T067, T068 — ปรับปรุง createJobPayload ให้ดึงพารามิเตอร์สำหรับ ocr-extract จาก model defaults

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { Repository } from 'typeorm';
import { AiExecutionProfile } from '../entities/ai-execution-profile.entity';
import { AiSandboxProfile } from '../entities/ai-sandbox-profile.entity';
import {
  ExecutionProfile,
  InternalJobType,
  OcrSnapshotParams,
  RuntimePolicy,
  AiJobPayload,
} from '../interfaces/execution-policy.interface';

@Injectable()
export class AiPolicyService {
  private readonly logger = new Logger(AiPolicyService.name);
  private readonly cachePrefix = 'ai_execution_profiles:';
  private readonly modelDefaultsCachePrefix = 'ai_execution_profiles:model:';
  private readonly cacheTtlSeconds = 60;

  private readonly defaultProfiles: Record<ExecutionProfile, RuntimePolicy> = {
    interactive: {
      canonicalModel: 'np-dms-ai',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      numCtx: 4096,
      repeatPenalty: 1.15,
      keepAliveSeconds: 300,
    },
    standard: {
      canonicalModel: 'np-dms-ai',
      temperature: 0.5,
      topP: 0.8,
      maxTokens: 4096,
      numCtx: 8192,
      repeatPenalty: 1.15,
      keepAliveSeconds: 600,
    },
    quality: {
      canonicalModel: 'np-dms-ai',
      temperature: 0.1,
      topP: 0.95,
      maxTokens: 8192,
      numCtx: 8192,
      repeatPenalty: 1.15,
      keepAliveSeconds: 600,
    },
    'deep-analysis': {
      canonicalModel: 'np-dms-ai',
      temperature: 0.3,
      topP: 0.85,
      maxTokens: 8192,
      numCtx: 32768,
      repeatPenalty: 1.15,
      keepAliveSeconds: 0,
    },
  };

  private readonly defaultOcrPolicy: RuntimePolicy = {
    canonicalModel: 'np-dms-ocr',
    temperature: 0.1,
    topP: 0.1,
    maxTokens: null,
    numCtx: null,
    repeatPenalty: 1.1,
    keepAliveSeconds: 0,
  };

  constructor(
    @InjectRepository(AiExecutionProfile)
    private readonly profileRepo: Repository<AiExecutionProfile>,
    @InjectRepository(AiSandboxProfile)
    private readonly sandboxProfileRepo: Repository<AiSandboxProfile>,
    @InjectRedis() private readonly redis: Redis
  ) {}

  /**
   * แปลงชื่อ model หรือ tag ของ Ollama ให้เป็น canonical name เสมอ (np-dms-ai หรือ np-dms-ocr)
   */
  getCanonicalModelName(modelName: string): 'np-dms-ai' | 'np-dms-ocr' {
    const name = modelName.toLowerCase();
    if (name.includes('ocr')) {
      return 'np-dms-ocr';
    }
    return 'np-dms-ai';
  }

  /**
   * แผนผังการแปลง JobType เป็น ExecutionProfile
   */
  getProfileForJobType(jobType: InternalJobType): ExecutionProfile {
    switch (jobType) {
      case 'auto-fill-document':
      case 'migrate-document':
        return 'quality';
      case 'rag-query':
        return 'standard';
      case 'intent-classify':
      case 'tool-suggest':
        return 'interactive';
      case 'sandbox-analysis':
        return 'deep-analysis';
      case 'ocr-extract':
      default:
        return 'standard';
    }
  }

  /**
   * ดึงพารามิเตอร์การทำงานสำหรับ ExecutionProfile แต่ละอัน
   */
  async getProfileParameters(
    profile: ExecutionProfile
  ): Promise<RuntimePolicy> {
    const cacheKey = `${this.cachePrefix}${profile}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as RuntimePolicy;
      }
    } catch (cacheErr) {
      this.logger.warn(
        `Failed to read execution profile cache: ${cacheErr instanceof Error ? cacheErr.message : String(cacheErr)}`
      );
    }
    try {
      const dbProfile = await this.profileRepo.findOne({
        where: { profileName: profile, isActive: true },
      });
      if (dbProfile) {
        const policy = this.toRuntimePolicy(dbProfile);
        try {
          await this.redis.set(
            cacheKey,
            JSON.stringify(policy),
            'EX',
            this.cacheTtlSeconds
          );
        } catch (cacheSetErr) {
          this.logger.warn(
            `Failed to write execution profile cache: ${cacheSetErr instanceof Error ? cacheSetErr.message : String(cacheSetErr)}`
          );
        }
        return policy;
      }
    } catch (dbErr) {
      this.logger.error(
        `Failed to read execution profile from DB: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`
      );
    }
    return this.defaultProfiles[profile];
  }

  /**
   * ดึงค่า default แยกตาม canonical model สำหรับ model-defaults rows เช่น ocr-extract
   */
  async getModelDefaults(
    canonicalModel: 'np-dms-ai' | 'np-dms-ocr'
  ): Promise<RuntimePolicy> {
    const cacheKey = `${this.modelDefaultsCachePrefix}${canonicalModel}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as RuntimePolicy;
    } catch (cacheErr) {
      this.logger.warn(
        `Failed to read model defaults cache: ${cacheErr instanceof Error ? cacheErr.message : String(cacheErr)}`
      );
    }
    try {
      const dbProfile = await this.profileRepo.findOne({
        where: { canonicalModel, isActive: true },
        order: { updatedAt: 'DESC' },
      });
      if (dbProfile) {
        const policy = this.toRuntimePolicy(dbProfile);
        await this.cachePolicy(cacheKey, policy);
        return policy;
      }
    } catch (dbErr) {
      this.logger.error(
        `Failed to read model defaults from DB: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`
      );
    }
    return canonicalModel === 'np-dms-ocr'
      ? this.defaultOcrPolicy
      : this.defaultProfiles.standard;
  }

  /**
   * ดึง sandbox draft profile; ถ้ายังไม่มีจะ seed จาก production profile ปัจจุบัน
   */
  async getSandboxParameters(profileName: string): Promise<RuntimePolicy> {
    const existing = await this.sandboxProfileRepo.findOne({
      where: { profileName },
    });
    if (existing) return this.toRuntimePolicy(existing);
    const productionPolicy = await this.getProductionPolicy(profileName);
    const draft = this.sandboxProfileRepo.create({
      profileName,
      canonicalModel: productionPolicy.canonicalModel,
      temperature: productionPolicy.temperature,
      topP: productionPolicy.topP,
      maxTokens: productionPolicy.maxTokens,
      numCtx: productionPolicy.numCtx,
      repeatPenalty: productionPolicy.repeatPenalty,
      keepAliveSeconds: productionPolicy.keepAliveSeconds,
    });
    return this.toRuntimePolicy(await this.sandboxProfileRepo.save(draft));
  }

  /**
   * บันทึก sandbox draft parameters (UPSERT) — เปลี่ยนเฉพาะ fields ที่ระบุ
   */
  async saveSandboxDraft(
    profileName: string,
    updates: Partial<{
      temperature: number;
      topP: number;
      maxTokens: number | null;
      numCtx: number | null;
      repeatPenalty: number;
      keepAliveSeconds: number;
      canonicalModel: 'np-dms-ai' | 'np-dms-ocr';
    }>,
    updatedBy?: number
  ): Promise<RuntimePolicy> {
    let draft = await this.sandboxProfileRepo.findOne({
      where: { profileName },
    });
    if (!draft) {
      const productionPolicy = await this.getProductionPolicy(profileName);
      draft = this.sandboxProfileRepo.create({
        profileName,
        canonicalModel: productionPolicy.canonicalModel,
        temperature: productionPolicy.temperature,
        topP: productionPolicy.topP,
        maxTokens: productionPolicy.maxTokens,
        numCtx: productionPolicy.numCtx,
        repeatPenalty: productionPolicy.repeatPenalty,
        keepAliveSeconds: productionPolicy.keepAliveSeconds,
      });
    }
    if (updates.temperature !== undefined)
      draft.temperature = updates.temperature;
    if (updates.topP !== undefined) draft.topP = updates.topP;
    if (updates.maxTokens !== undefined) draft.maxTokens = updates.maxTokens;
    if (updates.numCtx !== undefined) draft.numCtx = updates.numCtx;
    if (updates.repeatPenalty !== undefined)
      draft.repeatPenalty = updates.repeatPenalty;
    if (updates.keepAliveSeconds !== undefined)
      draft.keepAliveSeconds = updates.keepAliveSeconds;
    if (updates.canonicalModel !== undefined)
      draft.canonicalModel = updates.canonicalModel;
    if (updatedBy !== undefined) draft.updatedBy = updatedBy;
    return this.toRuntimePolicy(await this.sandboxProfileRepo.save(draft));
  }

  /**
   * รีเซ็ต sandbox draft ให้ตรงกับ production profile ปัจจุบัน
   */
  async resetSandboxToProduction(
    profileName: string,
    updatedBy?: number
  ): Promise<RuntimePolicy> {
    const productionPolicy = await this.getProductionPolicy(profileName);
    let draft = await this.sandboxProfileRepo.findOne({
      where: { profileName },
    });
    if (!draft) {
      draft = this.sandboxProfileRepo.create({ profileName });
    }
    draft.canonicalModel = productionPolicy.canonicalModel;
    draft.temperature = productionPolicy.temperature;
    draft.topP = productionPolicy.topP;
    draft.maxTokens = productionPolicy.maxTokens;
    draft.numCtx = productionPolicy.numCtx;
    draft.repeatPenalty = productionPolicy.repeatPenalty;
    draft.keepAliveSeconds = productionPolicy.keepAliveSeconds;
    if (updatedBy !== undefined) draft.updatedBy = updatedBy;
    return this.toRuntimePolicy(await this.sandboxProfileRepo.save(draft));
  }

  /**
   * สร้าง payload ของ BullMQ job ที่มี snapshot parameters ณ เวลา dispatch
   */
  async createJobPayload(
    jobType: InternalJobType,
    documentPublicId?: string,
    attachmentPublicId?: string
  ): Promise<AiJobPayload> {
    const effectiveProfile = this.getProfileForJobType(jobType);
    const canonicalModel =
      jobType === 'ocr-extract' ? 'np-dms-ocr' : 'np-dms-ai';
    const policy =
      jobType === 'ocr-extract'
        ? await this.getModelDefaults('np-dms-ocr')
        : await this.getProfileParameters(effectiveProfile);
    const ocrSnapshotParams = await this.createOcrSnapshotParams(jobType);
    return {
      jobType,
      documentPublicId,
      attachmentPublicId,
      effectiveProfile,
      canonicalModel,
      snapshotParams: {
        temperature: policy.temperature,
        topP: policy.topP,
        maxTokens: policy.maxTokens,
        numCtx: policy.numCtx,
        repeatPenalty: policy.repeatPenalty,
        keepAliveSeconds: policy.keepAliveSeconds,
      },
      ...(ocrSnapshotParams ? { ocrSnapshotParams } : {}),
    };
  }

  private toRuntimePolicy(
    profile: AiExecutionProfile | AiSandboxProfile
  ): RuntimePolicy {
    return {
      canonicalModel: profile.canonicalModel ?? 'np-dms-ai',
      temperature: Number(profile.temperature),
      topP: Number(profile.topP),
      maxTokens: profile.maxTokens,
      numCtx: profile.numCtx,
      repeatPenalty: Number(profile.repeatPenalty),
      keepAliveSeconds: profile.keepAliveSeconds,
    };
  }

  private async getProductionPolicy(
    profileName: string
  ): Promise<RuntimePolicy> {
    if (this.isExecutionProfile(profileName)) {
      return this.getProfileParameters(profileName);
    }
    if (profileName === 'ocr-extract') {
      return this.getModelDefaults('np-dms-ocr');
    }
    return this.defaultProfiles.standard;
  }

  private isExecutionProfile(
    profileName: string
  ): profileName is ExecutionProfile {
    return (
      profileName === 'interactive' ||
      profileName === 'standard' ||
      profileName === 'quality' ||
      profileName === 'deep-analysis'
    );
  }

  private async cachePolicy(
    cacheKey: string,
    policy: RuntimePolicy
  ): Promise<void> {
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(policy),
        'EX',
        this.cacheTtlSeconds
      );
    } catch (cacheSetErr) {
      this.logger.warn(
        `Failed to write execution policy cache: ${cacheSetErr instanceof Error ? cacheSetErr.message : String(cacheSetErr)}`
      );
    }
  }

  private async createOcrSnapshotParams(
    jobType: InternalJobType
  ): Promise<OcrSnapshotParams | undefined> {
    if (
      jobType !== 'migrate-document' &&
      jobType !== 'auto-fill-document' &&
      jobType !== 'ocr-extract'
    ) {
      return undefined;
    }
    const ocrPolicy = await this.getModelDefaults('np-dms-ocr');
    return {
      temperature: ocrPolicy.temperature,
      topP: ocrPolicy.topP,
      repeatPenalty: ocrPolicy.repeatPenalty,
    };
  }

  /**
   * Apply sandbox draft to production (copy sandbox profile -> execution profile)
   * And invalidate Redis cache key.
   */
  async applyProfile(
    profileName: string,
    updatedBy?: number
  ): Promise<RuntimePolicy> {
    const draft = await this.sandboxProfileRepo.findOne({
      where: { profileName },
    });
    if (!draft) {
      throw new NotFoundException(
        `Sandbox draft for profile ${profileName} not found`
      );
    }
    this.validatePolicyParams(draft);
    let production = await this.profileRepo.findOne({
      where: { profileName },
    });
    if (!production) {
      production = this.profileRepo.create({
        profileName,
        isActive: true,
      });
    }
    production.canonicalModel = draft.canonicalModel;
    production.temperature = draft.temperature;
    production.topP = draft.topP;
    production.maxTokens = draft.maxTokens;
    production.numCtx = draft.numCtx;
    production.repeatPenalty = draft.repeatPenalty;
    production.keepAliveSeconds = draft.keepAliveSeconds;
    if (updatedBy !== undefined) {
      production.updatedBy = updatedBy;
    }
    const saved = await this.profileRepo.save(production);
    const cacheKey = `${this.cachePrefix}${profileName}`;
    const modelDefaultsCacheKey = `${this.modelDefaultsCachePrefix}${draft.canonicalModel}`;
    try {
      await this.redis.del(cacheKey);
      await this.redis.del(modelDefaultsCacheKey);
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate cache: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return this.toRuntimePolicy(saved);
  }

  private validatePolicyParams(params: {
    temperature: number | string;
    topP: number | string;
    repeatPenalty: number | string;
    keepAliveSeconds: number;
  }): void {
    const temp = Number(params.temperature);
    const topP = Number(params.topP);
    const repeat = Number(params.repeatPenalty);
    const keepAlive = params.keepAliveSeconds;
    if (isNaN(temp) || temp < 0 || temp > 1) {
      throw new BadRequestException('Temperature must be between 0 and 1');
    }
    if (isNaN(topP) || topP < 0 || topP > 1) {
      throw new BadRequestException('Top-P must be between 0 and 1');
    }
    if (isNaN(repeat) || repeat < 1 || repeat > 2) {
      throw new BadRequestException('Repeat penalty must be between 1 and 2');
    }
    if (keepAlive < 0) {
      throw new BadRequestException(
        'Keep-alive seconds must be greater than or equal to 0'
      );
    }
  }
}
