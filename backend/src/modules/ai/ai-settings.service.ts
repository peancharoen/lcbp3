// File: src/modules/ai/ai-settings.service.ts
// Change Log
// - 2026-05-21: เพิ่ม service สำหรับอ่าน/เขียน AI feature toggle พร้อม Redis cache.
// - 2026-05-22: เพิ่ม try-catch ใน getAiFeaturesEnabled() เพื่อความยืดหยุ่นในกรณีที่ฐานข้อมูลยังไม่ได้อัปเกรดตาราง system_settings
// - 2026-05-25: เพิ่ม methods สำหรับจัดการรายการโมเดล AI แบบไดนามิก (ADR-027)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { EntityManager, Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity';
import { AiAvailableModel } from './entities/ai-available-model.entity';
import { NotFoundException } from '../../common/exceptions';

const AI_FEATURES_ENABLED_KEY = 'AI_FEATURES_ENABLED';
const AI_FEATURES_ENABLED_CACHE_KEY = 'system_settings:AI_FEATURES_ENABLED';
const AI_FEATURES_ENABLED_TTL_SECONDS = 30;

const AI_ACTIVE_MODEL_KEY = 'AI_ACTIVE_MODEL';
const AI_ACTIVE_MODEL_CACHE_KEY = 'system_settings:AI_ACTIVE_MODEL';
const AI_ACTIVE_MODEL_TTL_SECONDS = 30;

/** Service สำหรับจัดการ system_settings ที่เกี่ยวข้องกับ AI Admin Console */
@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    @InjectRepository(AiAvailableModel)
    private readonly modelRepo: Repository<AiAvailableModel>,
    @InjectRedis() private readonly redis: Redis
  ) {}

  /** อ่านสถานะเปิด/ปิด AI features โดยใช้ Redis cache ก่อน DB */
  async getAiFeaturesEnabled(): Promise<boolean> {
    try {
      const cachedValue = await this.getCachedValue();
      if (cachedValue !== null) return cachedValue === 'true';
      const setting = await this.settingRepo.findOne({
        where: { settingKey: AI_FEATURES_ENABLED_KEY },
      });
      const enabled = setting ? setting.settingValue === 'true' : true;
      await this.setCachedValue(enabled);
      return enabled;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to retrieve AI features enabled setting from database: ${this.toMessage(error)}`
      );
      return true;
    }
  }

  /** อัปเดตสถานะ AI features ใน transaction แล้ว invalid cache หลัง DB สำเร็จ */
  async setAiFeaturesEnabled(
    enabled: boolean,
    userId: number
  ): Promise<boolean> {
    await this.settingRepo.manager.transaction(
      async (manager: EntityManager): Promise<void> => {
        const repo = manager.getRepository(SystemSetting);
        const existing = await repo.findOne({
          where: { settingKey: AI_FEATURES_ENABLED_KEY },
        });
        const setting =
          existing ??
          repo.create({
            settingKey: AI_FEATURES_ENABLED_KEY,
            dataType: 'boolean',
            category: 'ai',
            description:
              'สถานะเปิด/ปิดการใช้งานฟีเจอร์ AI ทั้งระบบ สำหรับผู้ใช้ทั่วไป',
            isPublic: true,
          });
        setting.settingValue = String(enabled);
        setting.updatedBy = userId;
        await repo.save(setting);
      }
    );
    await this.deleteCachedValue();
    return enabled;
  }

  private async getCachedValue(): Promise<string | null> {
    try {
      return await this.redis.get(AI_FEATURES_ENABLED_CACHE_KEY);
    } catch (error: unknown) {
      this.logger.warn(
        `AI settings cache read failed: ${this.toMessage(error)}`
      );
      return null;
    }
  }

  private async setCachedValue(enabled: boolean): Promise<void> {
    try {
      await this.redis.set(
        AI_FEATURES_ENABLED_CACHE_KEY,
        String(enabled),
        'EX',
        AI_FEATURES_ENABLED_TTL_SECONDS
      );
    } catch (error: unknown) {
      this.logger.warn(
        `AI settings cache write failed: ${this.toMessage(error)}`
      );
    }
  }

  private async deleteCachedValue(): Promise<void> {
    try {
      await this.redis.del(AI_FEATURES_ENABLED_CACHE_KEY);
    } catch (error: unknown) {
      this.logger.warn(
        `AI settings cache invalidation failed: ${this.toMessage(error)}`
      );
    }
  }

  private toMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  // --- AI Model Management (ADR-027) ---

  /** ดึงรายการโมเดล AI ทั้งหมดที่ใช้งานได้ (รวมถึงที่ไม่ active) */
  async getAvailableModels(): Promise<AiAvailableModel[]> {
    return this.modelRepo.find({
      order: { isDefault: 'DESC', modelName: 'ASC' },
    });
  }

  /** ดึงรายการโมเดล AI ที่ active เท่านั้น */
  async getActiveModels(): Promise<AiAvailableModel[]> {
    return this.modelRepo.find({
      where: { isActive: true },
      order: { modelName: 'ASC' },
    });
  }

  /** ดึงโมเดล AI ที่ใช้งานอยู่ปัจจุบัน (active model) */
  async getActiveModel(): Promise<string> {
    try {
      const cachedValue = await this.redis.get(AI_ACTIVE_MODEL_CACHE_KEY);
      if (cachedValue) return cachedValue;

      const setting = await this.settingRepo.findOne({
        where: { settingKey: AI_ACTIVE_MODEL_KEY },
      });

      const activeModel = setting?.settingValue ?? 'gemma4:e2b';
      await this.redis.set(
        AI_ACTIVE_MODEL_CACHE_KEY,
        activeModel,
        'EX',
        AI_ACTIVE_MODEL_TTL_SECONDS
      );
      return activeModel;
    } catch (error: unknown) {
      this.logger.error(`Failed to get active model: ${this.toMessage(error)}`);
      return 'gemma4:e2b';
    }
  }

  /** ตั้งค่าโมเดล AI ที่ใช้งาน (global) */
  async setActiveModel(modelName: string, userId: number): Promise<string> {
    const model = await this.modelRepo.findOne({
      where: { modelName, isActive: true },
    });

    if (!model) {
      throw new NotFoundException('AiAvailableModel', modelName);
    }

    await this.settingRepo.manager.transaction(
      async (manager: EntityManager): Promise<void> => {
        const repo = manager.getRepository(SystemSetting);
        const existing = await repo.findOne({
          where: { settingKey: AI_ACTIVE_MODEL_KEY },
        });

        const setting =
          existing ??
          repo.create({
            settingKey: AI_ACTIVE_MODEL_KEY,
            dataType: 'string',
            category: 'ai',
            description: 'โมเดล AI ที่ใช้งานอยู่ในระบบ (global)',
            isPublic: true,
          });

        setting.settingValue = modelName;
        setting.updatedBy = userId;
        await repo.save(setting);
      }
    );

    await this.redis.del(AI_ACTIVE_MODEL_CACHE_KEY);
    this.logger.log(
      `Active AI model changed to ${modelName} by user ${userId}`
    );
    return modelName;
  }

  /** เพิ่มโมเดล AI ใหม่เข้าระบบ (Superadmin only) */
  async addModel(
    data: {
      modelName: string;
      modelVersion: string;
      description?: string;
      vramGb?: number;
    },
    userId: number
  ): Promise<AiAvailableModel> {
    const existing = await this.modelRepo.findOne({
      where: { modelName: data.modelName },
      withDeleted: true,
    });

    if (existing) {
      throw new Error(`Model ${data.modelName} already exists`);
    }

    const model = this.modelRepo.create({
      ...data,
      isActive: true,
      isDefault: false,
      createdBy: userId,
    });

    const saved = await this.modelRepo.save(model);
    this.logger.log(`New AI model added: ${data.modelName} by user ${userId}`);
    return saved;
  }

  /** ลบโมเดล AI (soft delete) */
  async removeModel(modelName: string, userId: number): Promise<void> {
    const model = await this.modelRepo.findOne({
      where: { modelName },
    });

    if (!model) {
      throw new NotFoundException('AiAvailableModel', modelName);
    }

    if (model.isDefault) {
      throw new Error('Cannot remove default model');
    }

    const activeModel = await this.getActiveModel();
    if (activeModel === modelName) {
      throw new Error('Cannot remove currently active model');
    }

    await this.modelRepo.softRemove(model);
    this.logger.log(`AI model removed: ${modelName} by user ${userId}`);
  }

  /** เปลี่ยนสถานะ active/inactive ของโมเดล */
  async toggleModelActive(
    modelName: string,
    userId: number
  ): Promise<AiAvailableModel> {
    const model = await this.modelRepo.findOne({
      where: { modelName },
    });

    if (!model) {
      throw new NotFoundException('AiAvailableModel', modelName);
    }

    if (model.isDefault && model.isActive) {
      throw new Error('Cannot deactivate default model');
    }

    const activeModel = await this.getActiveModel();
    if (activeModel === modelName && model.isActive) {
      throw new Error('Cannot deactivate currently active model');
    }

    model.isActive = !model.isActive;
    model.updatedBy = userId;

    const saved = await this.modelRepo.save(model);
    this.logger.log(
      `AI model ${modelName} active status changed to ${model.isActive} by user ${userId}`
    );
    return saved;
  }
}
