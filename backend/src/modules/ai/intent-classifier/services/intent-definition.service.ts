// File: src/modules/ai/intent-classifier/services/intent-definition.service.ts
// Change Log
// - 2026-05-19: สร้าง CRUD service สำหรับ Intent Definitions (Admin, ADR-024).

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntentDefinition } from '../entities/intent-definition.entity';
import { IntentCategory } from '../interfaces/intent-category.enum';

/** Filter options สำหรับ list */
export interface IntentDefinitionFilter {
  category?: IntentCategory;
  isActive?: boolean;
}

/** DTO สำหรับสร้าง Intent Definition */
export interface CreateIntentDefinitionData {
  intentCode: string;
  descriptionTh: string;
  descriptionEn: string;
  category: IntentCategory;
}

/** DTO สำหรับ update Intent Definition */
export interface UpdateIntentDefinitionData {
  descriptionTh?: string;
  descriptionEn?: string;
  isActive?: boolean;
}

/**
 * Service สำหรับจัดการ Intent Definitions (Admin CRUD)
 */
@Injectable()
export class IntentDefinitionService {
  private readonly logger = new Logger(IntentDefinitionService.name);

  constructor(
    @InjectRepository(IntentDefinition)
    private readonly repo: Repository<IntentDefinition>
  ) {}

  /** ดึงรายการ Intent Definitions ทั้งหมด (filter ได้) */
  async findAll(filter?: IntentDefinitionFilter): Promise<IntentDefinition[]> {
    const where: Record<string, unknown> = {};
    if (filter?.category) where.category = filter.category;
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;

    return this.repo.find({
      where,
      order: { intentCode: 'ASC' },
      relations: ['patterns'],
    });
  }

  /** ดึง Intent Definition ตาม intentCode */
  async findByCode(intentCode: string): Promise<IntentDefinition> {
    const entity = await this.repo.findOne({
      where: { intentCode },
      relations: ['patterns'],
    });
    if (!entity) {
      throw new NotFoundException(`Intent "${intentCode}" not found`);
    }
    return entity;
  }

  /** สร้าง Intent Definition ใหม่ */
  async create(data: CreateIntentDefinitionData): Promise<IntentDefinition> {
    // ตรวจสอบ intentCode ซ้ำ
    const exists = await this.repo.findOne({
      where: { intentCode: data.intentCode },
    });
    if (exists) {
      throw new ConflictException(
        `Intent code "${data.intentCode}" already exists`
      );
    }

    const entity = this.repo.create(data);
    const saved = await this.repo.save(entity);
    this.logger.log(`Created intent definition: ${saved.intentCode}`);
    return saved;
  }

  /** อัปเดต Intent Definition */
  async update(
    intentCode: string,
    data: UpdateIntentDefinitionData
  ): Promise<IntentDefinition> {
    const entity = await this.findByCode(intentCode);
    Object.assign(entity, data);
    const saved = await this.repo.save(entity);
    this.logger.log(`Updated intent definition: ${saved.intentCode}`);
    return saved;
  }
}
