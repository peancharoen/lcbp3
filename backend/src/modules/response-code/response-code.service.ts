// File: src/modules/response-code/response-code.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ResponseCode } from './entities/response-code.entity';
import { ResponseCodeRule } from './entities/response-code-rule.entity';
import { ResponseCodeCategory } from '../common/enums/review.enums';

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
   * ตรวจสอบว่า Response Code triggers notification หรือไม่ (FR-007)
   * Code 1C, 1D, 3 → trigger notification
   */
  async getNotifyRoles(responseCodePublicId: string): Promise<string[]> {
    const code = await this.findByPublicId(responseCodePublicId);
    return code.notifyRoles ?? [];
  }
}
