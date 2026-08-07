// File: backend/src/modules/migration/services/review-threshold.service.ts
// Change Log:
// - 2026-08-06: Initial creation — read/write review thresholds via system_settings (Feature 242, R2, FR-010)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { SystemSetting } from '../../ai/entities/system-setting.entity';
import {
  ReviewThresholdSetting,
  DEFAULT_REVIEW_THRESHOLDS,
  THRESHOLD_VALIDATION,
  THRESHOLD_CACHE_KEY,
  THRESHOLD_CACHE_TTL_SECONDS,
} from '../types/review-threshold.type';
import {
  ValidationException,
  SystemException,
} from '../../../common/exceptions';

/** คีย์ system_settings สำหรับ threshold */
const SETTING_KEY_MAX_MISMATCH = 'MIGRATION_MAX_MISMATCH_FIELDS';
const SETTING_KEY_MIN_CONFIDENCE = 'MIGRATION_MIN_CONFIDENCE';

/**
 * Service สำหรับอ่าน/เขียน review classification thresholds (FR-010, R2)
 * อ่านจาก system_settings พร้อม Redis cache (migration:thresholds, TTL 60s)
 * DEL cache เมื่อมีการอัปเดต — pattern เดียวกับ AiPromptsService
 */
@Injectable()
export class ReviewThresholdService {
  private readonly logger = new Logger(ReviewThresholdService.name);

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly dataSource: DataSource
  ) {}

  /**
   * อ่าน threshold ปัจจุบัน (FR-010)
   * อ่านจาก Redis cache ก่อน; ถ้าไม่มีอ่านจาก DB แล้ว cache ไว้
   */
  async getThresholds(): Promise<ReviewThresholdSetting> {
    try {
      const cached = await this.redis.get(THRESHOLD_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ReviewThresholdSetting;
        if (
          typeof parsed.maxMismatchFields === 'number' &&
          typeof parsed.minConfidence === 'number'
        ) {
          return parsed;
        }
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Redis cache read failed for thresholds: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const maxMismatchFields = await this.readNumberSetting(
      SETTING_KEY_MAX_MISMATCH,
      DEFAULT_REVIEW_THRESHOLDS.maxMismatchFields
    );
    const minConfidence = await this.readNumberSetting(
      SETTING_KEY_MIN_CONFIDENCE,
      DEFAULT_REVIEW_THRESHOLDS.minConfidence
    );
    const thresholds: ReviewThresholdSetting = {
      maxMismatchFields,
      minConfidence,
    };
    await this.cacheThresholds(thresholds);
    return thresholds;
  }

  /**
   * อัปเดต threshold (FR-010a, FR-010b, FR-010d)
   * ตรวจสอบค่าในขอบเขตที่กำหนด, บันทึกลง DB, DEL cache, และ audit log
   * @param updates ค่าที่ต้องการอัปเดต (อย่างน้อย 1 ฟิลด์)
   * @param updatedBy user id ของผู้อัปเดต
   * @returns threshold ใหม่หลังอัปเดต
   */
  async updateThresholds(
    updates: Partial<
      Pick<ReviewThresholdSetting, 'maxMismatchFields' | 'minConfidence'>
    >,
    updatedBy: number
  ): Promise<ReviewThresholdSetting> {
    if (
      updates.maxMismatchFields === undefined &&
      updates.minConfidence === undefined
    ) {
      throw new ValidationException(
        'At least one threshold (maxMismatchFields or minConfidence) must be provided'
      );
    }
    const current = await this.getThresholds();
    const oldValues: ReviewThresholdSetting = {
      maxMismatchFields: current.maxMismatchFields,
      minConfidence: current.minConfidence,
    };
    const newValues: ReviewThresholdSetting = {
      maxMismatchFields: updates.maxMismatchFields ?? current.maxMismatchFields,
      minConfidence: updates.minConfidence ?? current.minConfidence,
    };
    this.validateRange('maxMismatchFields', newValues.maxMismatchFields);
    this.validateRange('minConfidence', newValues.minConfidence);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      if (updates.maxMismatchFields !== undefined) {
        await this.upsertSetting(
          queryRunner.manager,
          SETTING_KEY_MAX_MISMATCH,
          String(newValues.maxMismatchFields),
          updatedBy
        );
      }
      if (updates.minConfidence !== undefined) {
        await this.upsertSetting(
          queryRunner.manager,
          SETTING_KEY_MIN_CONFIDENCE,
          String(newValues.minConfidence),
          updatedBy
        );
      }
      // FR-010d: audit log — บันทึก old/new values และ updated_by ลง audit_logs table
      this.logger.log(
        `Review thresholds updated by user ${updatedBy}: ` +
          `maxMismatchFields ${oldValues.maxMismatchFields} → ${newValues.maxMismatchFields}, ` +
          `minConfidence ${oldValues.minConfidence} → ${newValues.minConfidence}`
      );
      // T058: บันทึก audit log entry ลง audit_logs table
      await queryRunner.manager.query(
        'INSERT INTO audit_logs (user_id, action, severity, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [
          updatedBy,
          'migration.review_thresholds.update',
          'INFO',
          'system_settings',
          'review_thresholds',
          JSON.stringify({
            updatedBy,
            oldValues,
            newValues,
            changedFields: {
              maxMismatchFields:
                updates.maxMismatchFields !== undefined
                  ? {
                      old: oldValues.maxMismatchFields,
                      new: newValues.maxMismatchFields,
                    }
                  : undefined,
              minConfidence:
                updates.minConfidence !== undefined
                  ? {
                      old: oldValues.minConfidence,
                      new: newValues.minConfidence,
                    }
                  : undefined,
            },
          }),
        ]
      );
      await queryRunner.commitTransaction();
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      throw new SystemException(
        `Failed to update thresholds: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      await queryRunner.release();
    }

    // DEL cache เพื่อให้การอ่านครั้งถัดไปดึงค่าใหม่ (FR-010a)
    try {
      await this.redis.del(THRESHOLD_CACHE_KEY);
    } catch (err: unknown) {
      this.logger.warn(
        `Redis cache DEL failed for thresholds: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return newValues;
  }

  /** อ่านค่า number จาก system_settings พร้อม default fallback */
  private async readNumberSetting(
    key: string,
    defaultValue: number
  ): Promise<number> {
    const setting = await this.settingRepo.findOne({
      where: { settingKey: key },
    });
    if (!setting) return defaultValue;
    const parsed = Number(setting.settingValue);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }

  /** cache thresholds ใน Redis พร้อม TTL */
  private async cacheThresholds(
    thresholds: ReviewThresholdSetting
  ): Promise<void> {
    try {
      await this.redis.set(
        THRESHOLD_CACHE_KEY,
        JSON.stringify(thresholds),
        'EX',
        THRESHOLD_CACHE_TTL_SECONDS
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Redis cache write failed for thresholds: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /** ตรวจสอบค่า threshold อยู่ในขอบเขตที่กำหนด (FR-010b) */
  private validateRange(
    field: keyof typeof THRESHOLD_VALIDATION,
    value: number
  ): void {
    const range = THRESHOLD_VALIDATION[field];
    if (value < range.min || value > range.max) {
      throw new ValidationException(
        `${field} must be between ${range.min} and ${range.max}, got ${value}`
      );
    }
  }

  /** upsert system_settings row ใน transaction */
  private async upsertSetting(
    manager: import('typeorm').EntityManager,
    key: string,
    value: string,
    updatedBy: number
  ): Promise<void> {
    const existing = await manager.findOne(SystemSetting, {
      where: { settingKey: key },
    });
    if (existing) {
      existing.settingValue = value;
      existing.updatedBy = updatedBy;
      await manager.save(existing);
    } else {
      const created = manager.create(SystemSetting, {
        settingKey: key,
        settingValue: value,
        dataType: 'number',
        category: 'migration',
        isPublic: false,
        isEncrypted: false,
        updatedBy,
      });
      await manager.save(created);
    }
  }
}
