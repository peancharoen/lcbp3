// File: src/modules/ai/intent-classifier/services/intent-pattern.service.ts
// Change Log
// - 2026-05-19: สร้าง CRUD service สำหรับ Intent Patterns (Admin, ADR-024).

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntentPattern } from '../entities/intent-pattern.entity';
import { IntentDefinition } from '../entities/intent-definition.entity';
import { IntentPatternCacheService } from './intent-pattern-cache.service';
import {
  PatternLanguage,
  PatternType,
} from '../interfaces/intent-category.enum';

/** DTO สำหรับสร้าง Pattern */
export interface CreateIntentPatternData {
  intentCode: string;
  language?: PatternLanguage;
  patternType: PatternType;
  patternValue: string;
  priority?: number;
}

/** DTO สำหรับ update Pattern */
export interface UpdateIntentPatternData {
  language?: PatternLanguage;
  patternType?: PatternType;
  patternValue?: string;
  priority?: number;
  isActive?: boolean;
}

/**
 * Service สำหรับจัดการ Intent Patterns (Admin CRUD)
 * Invalidate cache ทุกครั้งที่มีการเปลี่ยนแปลง
 */
@Injectable()
export class IntentPatternService {
  private readonly logger = new Logger(IntentPatternService.name);

  constructor(
    @InjectRepository(IntentPattern)
    private readonly repo: Repository<IntentPattern>,
    @InjectRepository(IntentDefinition)
    private readonly definitionRepo: Repository<IntentDefinition>,
    private readonly cacheService: IntentPatternCacheService
  ) {}

  /** ดึง Patterns ตาม intentCode */
  async findByIntentCode(intentCode: string): Promise<IntentPattern[]> {
    return this.repo.find({
      where: { intentCode },
      order: { priority: 'ASC' },
    });
  }

  /** ดึง Pattern ตาม publicId */
  async findByPublicId(publicId: string): Promise<IntentPattern> {
    const entity = await this.repo.findOne({ where: { publicId } });
    if (!entity) {
      throw new NotFoundException(`Pattern "${publicId}" not found`);
    }
    return entity;
  }

  /** สร้าง Pattern ใหม่ + invalidate cache */
  async create(data: CreateIntentPatternData): Promise<IntentPattern> {
    // ตรวจสอบว่า intentCode มีอยู่จริง
    const definition = await this.definitionRepo.findOne({
      where: { intentCode: data.intentCode },
    });
    if (!definition) {
      throw new NotFoundException(
        `Intent "${data.intentCode}" not found — ต้องสร้าง Intent Definition ก่อน`
      );
    }

    // Validate regex ถ้าเป็น regex type
    if (data.patternType === PatternType.REGEX) {
      this.validateRegex(data.patternValue);
    }

    const entity = this.repo.create({
      intentCode: data.intentCode,
      language: data.language ?? PatternLanguage.ANY,
      patternType: data.patternType,
      patternValue: data.patternValue,
      priority: data.priority ?? 100,
    });

    const saved = await this.repo.save(entity);
    await this.cacheService.invalidate();
    this.logger.log(
      `Created pattern for ${saved.intentCode}: "${saved.patternValue}"`
    );
    return saved;
  }

  /** อัปเดต Pattern + invalidate cache */
  async update(
    publicId: string,
    data: UpdateIntentPatternData
  ): Promise<IntentPattern> {
    const entity = await this.findByPublicId(publicId);

    // Validate regex ถ้ามีการเปลี่ยน patternValue เป็น regex
    const newType = data.patternType ?? entity.patternType;
    const newValue = data.patternValue ?? entity.patternValue;
    if (newType === PatternType.REGEX && data.patternValue) {
      this.validateRegex(newValue);
    }

    Object.assign(entity, data);
    const saved = await this.repo.save(entity);
    await this.cacheService.invalidate();
    this.logger.log(`Updated pattern ${publicId}`);
    return saved;
  }

  /** Soft delete Pattern + invalidate cache */
  async remove(publicId: string): Promise<void> {
    const entity = await this.findByPublicId(publicId);
    entity.isActive = false;
    await this.repo.save(entity);
    await this.cacheService.invalidate();
    this.logger.log(`Soft-deleted pattern ${publicId}`);
  }

  /**
   * Validate regex pattern (research decision: try-catch ที่ service layer)
   * @throws BadRequestException ถ้า regex ไม่ถูกต้อง
   */
  private validateRegex(pattern: string): void {
    try {
      new RegExp(pattern);
    } catch (err) {
      throw new BadRequestException(
        `Invalid regex pattern: "${pattern}" — ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}
