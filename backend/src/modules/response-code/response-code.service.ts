// File: src/modules/response-code/response-code.service.ts
// Change Log:
// - 2026-05-13: Add basic CRUD methods for response codes to support controller mutations.
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ResponseCode } from './entities/response-code.entity';
import { ResponseCodeRule } from './entities/response-code-rule.entity';
import { ResponseCodeCategory } from '../common/enums/review.enums';
import { CreateResponseCodeDto } from './dto/create-response-code.dto';
import { UpdateResponseCodeDto } from './dto/update-response-code.dto';

@Injectable()
export class ResponseCodeService {
  private readonly logger = new Logger(ResponseCodeService.name);

  constructor(
    @InjectRepository(ResponseCode)
    private readonly responseCodeRepo: Repository<ResponseCode>,
    @InjectRepository(ResponseCodeRule)
    private readonly responseCodeRuleRepo: Repository<ResponseCodeRule>
  ) {}

  /**
   * ดึง Response Codes ทั้งหมดที่ active
   */
  async findAll(): Promise<ResponseCode[]> {
    return this.responseCodeRepo.find({
      where: { isActive: true },
      order: { category: 'ASC', code: 'ASC' },
    });
  }

  /**
   * ดึง Response Codes ตาม Category (FR-006)
   * ใช้สำหรับแสดงผลใน Review page ตามประเภทเอกสาร
   */
  async findByCategory(
    category: ResponseCodeCategory
  ): Promise<ResponseCode[]> {
    return this.responseCodeRepo.find({
      where: { category, isActive: true },
      order: { code: 'ASC' },
    });
  }

  /**
   * ดึง Response Codes ที่ใช้ได้กับ document type + project
   * รองรับ Global default + Project override (ADR-019 Q1 clarification)
   */
  async findByDocumentType(
    documentTypeId: number,
    projectId?: number
  ): Promise<ResponseCode[]> {
    // ดึง Rules ระดับ Project (ถ้ามี) หรือ Global default
    const rules = await this.responseCodeRuleRepo.find({
      where: [
        { documentTypeId, projectId: projectId ?? IsNull(), isEnabled: true },
        { documentTypeId, projectId: IsNull(), isEnabled: true },
      ],
      relations: ['responseCode'],
    });

    // Project rules override global rules
    const codeMap = new Map<number, ResponseCode>();
    for (const rule of rules) {
      if (rule.responseCode?.isActive) {
        codeMap.set(rule.responseCodeId, rule.responseCode);
      }
    }

    return Array.from(codeMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code)
    );
  }

  /**
   * ดึง ResponseCode โดย publicId (ADR-019)
   */
  async findByPublicId(publicId: string): Promise<ResponseCode> {
    const code = await this.responseCodeRepo.findOne({
      where: { publicId },
    });

    if (!code) {
      throw new NotFoundException(`Response Code not found: ${publicId}`);
    }

    return code;
  }

  /**
   * สร้าง Response Code ใหม่สำหรับ Master Approval Matrix
   */
  async create(dto: CreateResponseCodeDto): Promise<ResponseCode> {
    const existing = await this.responseCodeRepo.findOne({
      where: {
        code: dto.code,
        category: dto.category,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Response Code already exists for code=${dto.code}, category=${dto.category}`
      );
    }

    const entity = this.responseCodeRepo.create({
      code: dto.code,
      subStatus: dto.subStatus,
      category: dto.category,
      descriptionTh: dto.descriptionTh,
      descriptionEn: dto.descriptionEn,
      implications: dto.implications,
      notifyRoles: dto.notifyRoles,
      isActive: dto.isActive ?? true,
      isSystem: false,
    });

    return this.responseCodeRepo.save(entity);
  }

  /**
   * อัปเดต Response Code ตาม publicId
   */
  async update(
    publicId: string,
    dto: UpdateResponseCodeDto
  ): Promise<ResponseCode> {
    const entity = await this.findByPublicId(publicId);

    if (
      (dto.code && dto.code !== entity.code) ||
      (dto.category && dto.category !== entity.category)
    ) {
      const existing = await this.responseCodeRepo.findOne({
        where: {
          code: dto.code ?? entity.code,
          category: dto.category ?? entity.category,
        },
      });

      if (existing && existing.publicId !== entity.publicId) {
        throw new ConflictException(
          `Response Code already exists for code=${dto.code ?? entity.code}, category=${dto.category ?? entity.category}`
        );
      }
    }

    Object.assign(entity, dto);
    return this.responseCodeRepo.save(entity);
  }

  /**
   * ปิดการใช้งาน Response Code โดยไม่ลบข้อมูล
   */
  async deactivate(publicId: string): Promise<void> {
    const entity = await this.findByPublicId(publicId);

    if (entity.isSystem) {
      throw new BadRequestException('Cannot deactivate a system response code');
    }

    entity.isActive = false;
    await this.responseCodeRepo.save(entity);
  }

  /**
   * ตรวจสอบว่า Response Code triggers notification หรือไม่ (FR-007)
   * Code 1C, 1D, 3 → trigger notification
   */
  async getNotifyRoles(responseCodePublicId: string): Promise<string[]> {
    const code = await this.findByPublicId(responseCodePublicId);
    return code.notifyRoles ?? [];
  }
}
