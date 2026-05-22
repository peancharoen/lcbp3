// File: src/modules/tags/tags.service.ts
// Change Log:
// - 2026-05-22: เริ่มต้นสร้าง TagsService สำหรับจัดการข้อมูลแท็กและเชื่อมโยงกับเอกสารโต้ตอบตาม ADR-028
// - 2026-05-22: แก้ไข type compilation error ของ projectId ใน findOne และ find โดยใช้ IsNull()

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { CorrespondenceTag } from './entities/correspondence-tag.entity';

/**
 * บริการสำหรับจัดการแท็กและการเชื่อมโยงแท็กกับเอกสารโต้ตอบ
 */
@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
    @InjectRepository(CorrespondenceTag)
    private readonly correspondenceTagRepo: Repository<CorrespondenceTag>,
    private readonly dataSource: DataSource
  ) {}

  /**
   * สร้างแท็กใหม่ ป้องกันการสร้างแท็กซ้ำโดยทำการ normalize ชื่อแท็กก่อนเสมอ
   */
  async create(dto: {
    projectId: number | null;
    tagName: string;
    colorCode?: string;
    description?: string | null;
    createdBy?: number | null;
  }): Promise<Tag> {
    const normalizedName = this.normalize(dto.tagName);
    const existing = await this.tagRepo.findOne({
      where: {
        projectId: dto.projectId === null ? IsNull() : dto.projectId,
        tagName: normalizedName,
      },
    });
    if (existing) {
      return existing;
    }
    const tag = this.tagRepo.create({
      projectId: dto.projectId,
      tagName: normalizedName,
      colorCode: dto.colorCode || 'default',
      description: dto.description || null,
      createdBy: dto.createdBy || null,
    });
    return this.tagRepo.save(tag);
  }

  /**
   * ค้นหาแท็กทั้งหมดตาม Project ID
   */
  async findByProject(projectId: number | null): Promise<Tag[]> {
    return this.tagRepo.find({
      where: { projectId: projectId === null ? IsNull() : projectId },
      order: { tagName: 'ASC' },
    });
  }

  /**
   * ค้นหาหรือสร้างแท็กจากชื่อหลายๆ ชื่อพร้อมกัน (ใช้ตอนประมวลผลผลลัพธ์ของ AI)
   */
  async findOrCreateTags(
    projectId: number | null,
    tagNames: string[],
    createdBy?: number | null
  ): Promise<Tag[]> {
    const uniqueNames = Array.from(
      new Set(tagNames.map((name) => this.normalize(name)))
    ).filter(Boolean);
    const result: Tag[] = [];
    for (const name of uniqueNames) {
      const tag = await this.create({
        projectId,
        tagName: name,
        createdBy,
      });
      result.push(tag);
    }
    return result;
  }

  /**
   * ทำความสะอาดและปรับรูปแบบชื่อแท็กให้เป็นตัวพิมพ์เล็กและไม่มีช่องว่างส่วนเกิน
   */
  normalize(tagName: string): string {
    return tagName.trim().toLowerCase();
  }

  /**
   * เชื่อมโยงแท็กกับเอกสารโต้ตอบ (Correspondence) ป้องกันการบันทึกซ้ำซ้อน
   */
  async linkToCorrespondence(
    correspondenceId: number,
    tagId: number,
    options?: {
      isAiSuggested?: boolean;
      confidence?: number;
      createdBy?: number;
    }
  ): Promise<CorrespondenceTag> {
    const exists = await this.correspondenceTagRepo.findOne({
      where: { correspondenceId, tagId },
    });
    if (exists) {
      return exists;
    }
    const link = this.correspondenceTagRepo.create({
      correspondenceId,
      tagId,
      isAiSuggested: options?.isAiSuggested || false,
      confidence: options?.confidence || null,
      createdBy: options?.createdBy || null,
    });
    return this.correspondenceTagRepo.save(link);
  }
}
