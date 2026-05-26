// File: backend/src/modules/ai/prompts/ai-prompts.service.ts
// Change Log
// - 2026-05-25: Created AiPromptsService for dynamic prompt management (ADR-029)
// - 2026-05-25: Fixed BusinessException and NotFoundException constructor signatures
// - 2026-05-25: Cast getRawOne() to resolve TypeScript type assertion error in ESLint

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AiPrompt } from './ai-prompts.entity';
import { AuditLog } from '../../../common/entities/audit-log.entity';
import { CreateAiPromptDto } from './dto/create-ai-prompt.dto';
import {
  BusinessException,
  ValidationException,
  NotFoundException,
} from '../../../common/exceptions';

/**
 * Service สำหรับจัดการ Prompt Versioning และการดึงข้อมูล Prompt ล่าสุดที่พร้อมใช้งาน
 */
@Injectable()
export class AiPromptsService {
  private readonly logger = new Logger(AiPromptsService.name);
  private readonly cachePrefix = 'ai:prompt:active:';

  constructor(
    @InjectRepository(AiPrompt)
    private readonly aiPromptRepo: Repository<AiPrompt>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly dataSource: DataSource
  ) {}

  /**
   * ดึงรายการเวอร์ชันทั้งหมดของ prompt_type ที่กำหนด
   */
  async findAll(promptType: string): Promise<AiPrompt[]> {
    return this.aiPromptRepo.find({
      where: { promptType },
      order: { versionNumber: 'DESC' },
    });
  }

  /**
   * ดึง Active prompt จาก Redis cache หรือ DB fallback
   */
  async getActive(promptType: string): Promise<AiPrompt | null> {
    const cacheKey = `${this.cachePrefix}${promptType}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as AiPrompt;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Redis unavailable, falling back to DB query: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    const prompt = await this.aiPromptRepo.findOne({
      where: { promptType, isActive: true },
    });
    if (prompt) {
      try {
        await this.redis.setex(cacheKey, 60, JSON.stringify(prompt));
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to set Redis cache: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    return prompt;
  }

  /**
   * ค้นหา prompt ที่มีผลใช้งานจริง และแทนที่ placeholder {{ocr_text}} ด้วยข้อความ OCR
   */
  async resolveActive(
    promptType: string,
    ocrText: string
  ): Promise<{ resolvedPrompt: string; versionNumber: number }> {
    const prompt = await this.getActive(promptType);
    if (!prompt) {
      throw new BusinessException(
        'NO_ACTIVE_PROMPT',
        `No active prompt found for type: ${promptType}`,
        'ไม่พบ Prompt Version ที่เปิดใช้งานในระบบ'
      );
    }
    const resolvedPrompt = prompt.template.replace('{{ocr_text}}', ocrText);
    return { resolvedPrompt, versionNumber: prompt.versionNumber };
  }

  /**
   * สร้าง Prompt Version ใหม่พร้อมการตรวจสอบ placeholder และ character limit
   */
  async create(
    promptType: string,
    dto: CreateAiPromptDto,
    userId: number
  ): Promise<AiPrompt> {
    if (!dto.template.includes('{{ocr_text}}')) {
      throw new ValidationException('template ต้องมี {{ocr_text}} placeholder');
    }
    if (dto.template.length > 4000) {
      throw new ValidationException('Template exceeds 4,000 character limit');
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const maxVersionResult = await queryRunner.manager
        .createQueryBuilder(AiPrompt, 'prompt')
        .select('MAX(prompt.versionNumber)', 'max')
        .where('prompt.promptType = :promptType', { promptType })
        .setLock('pessimistic_write')
        .getRawOne<{ max: number | string | null }>();
      const nextVersion =
        (maxVersionResult?.max ? Number(maxVersionResult.max) : 0) + 1;
      const newPrompt = this.aiPromptRepo.create({
        promptType,
        versionNumber: nextVersion,
        template: dto.template,
        isActive: false,
        createdBy: userId,
      });
      const savedPrompt = await queryRunner.manager.save(newPrompt);
      await queryRunner.commitTransaction();
      await this.saveAuditLog(
        'AI_PROMPT_CREATED',
        String(savedPrompt.id),
        { promptType, versionNumber: nextVersion, userId },
        userId
      );
      return savedPrompt;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * เปิดใช้งานเวอร์ชันที่กำหนด และยกเลิกการใช้งานเวอร์ชันอื่นทั้งหมดภายใต้ prompt_type เดียวกัน
   */
  async activate(
    promptType: string,
    versionNumber: number,
    userId: number
  ): Promise<AiPrompt> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const promptToActivate = await queryRunner.manager.findOne(AiPrompt, {
        where: { promptType, versionNumber },
        lock: { mode: 'pessimistic_write' },
      });
      if (!promptToActivate) {
        throw new NotFoundException('AiPrompt', versionNumber.toString());
      }
      await queryRunner.manager.find(AiPrompt, {
        where: { promptType, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });
      await queryRunner.manager.update(
        AiPrompt,
        { promptType, isActive: true },
        { isActive: false }
      );
      promptToActivate.isActive = true;
      promptToActivate.activatedAt = new Date();
      const activatedPrompt = await queryRunner.manager.save(promptToActivate);
      await queryRunner.commitTransaction();
      try {
        const cacheKey = `${this.cachePrefix}${promptType}`;
        await this.redis.del(cacheKey);
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to clear Redis cache after activation: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      await this.saveAuditLog(
        'AI_PROMPT_ACTIVATED',
        String(activatedPrompt.id),
        { promptType, versionNumber, userId },
        userId
      );
      return activatedPrompt;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ลบเวอร์ชันที่ไม่ได้ใช้งาน (ห้ามลบเวอร์ชันที่เป็น active)
   */
  async delete(
    promptType: string,
    versionNumber: number,
    userId: number
  ): Promise<void> {
    const prompt = await this.aiPromptRepo.findOne({
      where: { promptType, versionNumber },
    });
    if (!prompt) {
      throw new NotFoundException('AiPrompt', versionNumber.toString());
    }
    if (prompt.isActive) {
      throw new BusinessException(
        'CANNOT_DELETE_ACTIVE_PROMPT',
        'Cannot delete active prompt version',
        'ไม่สามารถลบ active version ได้'
      );
    }
    await this.aiPromptRepo.remove(prompt);
    await this.saveAuditLog(
      'AI_PROMPT_DELETED',
      String(prompt.id),
      { promptType, versionNumber, userId },
      userId
    );
  }

  /**
   * อัปเดต manual note ของเวอร์ชันที่กำหนด
   */
  async updateNote(
    promptType: string,
    versionNumber: number,
    note: string | null
  ): Promise<AiPrompt> {
    const prompt = await this.aiPromptRepo.findOne({
      where: { promptType, versionNumber },
    });
    if (!prompt) {
      throw new NotFoundException('AiPrompt', versionNumber.toString());
    }
    prompt.manualNote = note;
    return this.aiPromptRepo.save(prompt);
  }

  /**
   * บันทึกผลทดสอบของเวอร์ชันหลังจากรัน OCR Sandbox
   */
  async saveTestResult(
    promptType: string,
    versionNumber: number,
    resultJson: Record<string, unknown>
  ): Promise<void> {
    const prompt = await this.aiPromptRepo.findOne({
      where: { promptType, versionNumber },
    });
    if (prompt) {
      prompt.testResultJson = resultJson;
      prompt.lastTestedAt = new Date();
      await this.aiPromptRepo.save(prompt);
    }
  }

  /**
   * บันทึกข้อมูลการปฏิบัติการของผู้ใช้ลงในตารางหลัก audit_logs
   */
  private async saveAuditLog(
    action: string,
    entityId: string,
    detailsJson: Record<string, unknown>,
    userId?: number
  ): Promise<void> {
    try {
      const auditLog = this.auditLogRepo.create({
        action,
        severity: 'INFO',
        entityType: 'AiPrompt',
        entityId,
        detailsJson,
        userId,
      });
      await this.auditLogRepo.save(auditLog);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to save audit log: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
