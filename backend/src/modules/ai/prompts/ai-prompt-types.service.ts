// File: backend/src/modules/ai/prompts/ai-prompt-types.service.ts
// Change Log:
// - 2026-09-01: Created AiPromptTypesService for master prompt types (Feature 251)

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AiPromptType } from './ai-prompt-types.entity';
import { CreateAiPromptTypeDto } from './dto/create-ai-prompt-type.dto';
import {
  BusinessException,
  ConflictException,
  NotFoundException,
} from '../../../common/exceptions';
import { plainToInstance } from 'class-transformer';
import { AiPromptTypeResponseDto } from './dto/ai-prompt-type-response.dto';

/**
 * บริการจัดการ ai_prompt_types master table
 * รองรับ dynamic prompt type management แทน hardcoded list (Feature 251)
 */
@Injectable()
export class AiPromptTypesService {
  constructor(
    @InjectRepository(AiPromptType)
    private readonly aiPromptTypeRepo: Repository<AiPromptType>
  ) {}

  /**
   * ดึง prompt type ตาม prompt_type string
   * @throws BusinessException เมื่อไม่พบ prompt type (FR-014)
   */
  async findByType(promptType: string): Promise<AiPromptType> {
    const record = await this.aiPromptTypeRepo.findOne({
      where: { promptType, isActive: true },
    });
    if (!record) {
      throw new BusinessException(
        'PROMPT_TYPE_NOT_FOUND',
        `prompt_type "${promptType}" ไม่มีในระบบ ติดต่อ super-admin`,
        `ไม่พบประเภท prompt "${promptType}" กรุณาติดต่อ super-admin เพื่อตรวจสอบ`
      );
    }
    return record;
  }

  /**
   * ดึงรายการ prompt types ทั้งหมดที่ active
   */
  async findAll(): Promise<AiPromptTypeResponseDto[]> {
    const records = await this.aiPromptTypeRepo.find({
      where: { isActive: true },
      order: { promptType: 'ASC' },
    });
    return records.map((record) => this.mapToResponse(record));
  }

  /**
   * สร้าง prompt type ใหม่ (super-admin only) (FR-013)
   */
  async create(
    dto: CreateAiPromptTypeDto,
    _userId: number
  ): Promise<AiPromptTypeResponseDto> {
    const existing = await this.aiPromptTypeRepo.findOne({
      where: { promptType: dto.promptType },
    });
    if (existing) {
      throw new ConflictException(
        'PROMPT_TYPE_DUPLICATE',
        `prompt_type "${dto.promptType}" มีอยู่แล้วในระบบ`
      );
    }

    const newType = this.aiPromptTypeRepo.create({
      publicId: randomUUID(),
      promptType: dto.promptType,
      displayName: dto.displayName,
      description: dto.description ?? null,
      expectedPlaceholders: dto.expectedPlaceholders ?? null,
      isSystemManaged: false, // admin-created types ไม่ใช่ system-managed
      isActive: true,
    });

    const saved = await this.aiPromptTypeRepo.save(newType);
    return this.mapToResponse(saved);
  }

  /**
   * ลบ prompt type (super-admin only) (FR-012, FR-013)
   */
  async delete(promptType: string): Promise<void> {
    const record = await this.aiPromptTypeRepo.findOne({
      where: { promptType },
    });
    if (!record) {
      throw new NotFoundException('prompt_type', promptType);
    }
    if (record.isSystemManaged) {
      throw new BusinessException(
        'CANNOT_DELETE_SYSTEM_PROMPT_TYPE',
        `ไม่สามารถลบ prompt type ที่ระบบจัดการได้ ("${promptType}")`,
        `prompt type "${promptType}" เป็น system-managed ไม่สามารถลบได้`
      );
    }

    // application-level check ก่อน DB FK constraint จะทำงาน
    const promptsCount = await this.aiPromptTypeRepo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('ai_prompts', 'p')
      .where('p.prompt_type = :promptType', { promptType })
      .getRawOne<{ count: string }>();
    const count = Number(promptsCount?.count ?? 0);
    if (count > 0) {
      throw new ConflictException(
        'PROMPT_TYPE_IN_USE',
        `ไม่สามารถลบ prompt type "${promptType}" ได้เพราะมี ai_prompts ${count} รายการอ้างอิงอยู่`
      );
    }

    await this.aiPromptTypeRepo.remove(record);
  }

  private mapToResponse(record: AiPromptType): AiPromptTypeResponseDto {
    return plainToInstance(AiPromptTypeResponseDto, record, {
      excludeExtraneousValues: true,
    });
  }
}
