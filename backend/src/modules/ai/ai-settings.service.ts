// File: src/modules/ai/ai-settings.service.ts
// Change Log
// - 2026-05-21: เพิ่ม service สำหรับอ่าน/เขียน AI feature toggle พร้อม Redis cache.
// - 2026-05-22: เพิ่ม try-catch ใน getAiFeaturesEnabled() เพื่อความยืดหยุ่นในกรณีที่ฐานข้อมูลยังไม่ได้อัปเกรดตาราง system_settings

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { EntityManager, Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity';

const AI_FEATURES_ENABLED_KEY = 'AI_FEATURES_ENABLED';
const AI_FEATURES_ENABLED_CACHE_KEY = 'system_settings:AI_FEATURES_ENABLED';
const AI_FEATURES_ENABLED_TTL_SECONDS = 30;

/** Service สำหรับจัดการ system_settings ที่เกี่ยวข้องกับ AI Admin Console */
@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
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
}
