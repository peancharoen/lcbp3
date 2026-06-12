// File: backend/src/modules/ai/services/ai-policy.service.ts
// Change Log:
// - 2026-06-11: Initial creation of AiPolicyService for managing execution profiles and policies
// - 2026-06-11: แก้ไขข้อผิดพลาด TS2367 (เทียบ profile กับ ocr-extract) และลบบรรทัดว่างในฟังก์ชัน getProfileParameters

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { Repository } from 'typeorm';
import { AiExecutionProfile } from '../entities/ai-execution-profile.entity';
import {
  ExecutionProfile,
  InternalJobType,
  RuntimePolicy,
  AiJobPayload,
} from '../interfaces/execution-policy.interface';

@Injectable()
export class AiPolicyService {
  private readonly logger = new Logger(AiPolicyService.name);
  private readonly cachePrefix = 'ai_execution_profiles:';
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

  constructor(
    @InjectRepository(AiExecutionProfile)
    private readonly profileRepo: Repository<AiExecutionProfile>,
    @InjectRedis() private readonly redis: Redis
  ) {}

  /**
   * แปลงชื่อ model หรือ tag ของ Ollama ให้เป็น canonical name เสมอ (np-dms-ai หรือ np-dms-ocr)
   */
  getCanonicalModelName(modelName: string): 'np-dms-ai' | 'np-dms-ocr' {
    const name = modelName.toLowerCase();
    if (name.includes('ocr') || name.includes('typhoon-np-dms-ocr')) {
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
        const policy: RuntimePolicy = {
          canonicalModel: 'np-dms-ai',
          temperature: Number(dbProfile.temperature),
          topP: Number(dbProfile.topP),
          maxTokens: dbProfile.maxTokens,
          numCtx: dbProfile.numCtx,
          repeatPenalty: Number(dbProfile.repeatPenalty),
          keepAliveSeconds: dbProfile.keepAliveSeconds,
        };
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
    const policy = await this.getProfileParameters(effectiveProfile);
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
    };
  }
}
