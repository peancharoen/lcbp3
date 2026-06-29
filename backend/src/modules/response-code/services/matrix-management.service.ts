// File: src/modules/response-code/services/matrix-management.service.ts
// CRUD สำหรับ ResponseCodeRule (global + project overrides) (T061, FR-022)
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseCodeRule } from '../entities/response-code-rule.entity';
import { ResponseCode } from '../entities/response-code.entity';

export interface UpsertRuleDto {
  documentTypeId: number;
  responseCodePublicId: string;
  projectId?: number;
  isEnabled: boolean;
  requiresComments?: boolean;
  triggersNotification?: boolean;
}

@Injectable()
export class MatrixManagementService {
  private readonly logger = new Logger(MatrixManagementService.name);

  constructor(
    @InjectRepository(ResponseCodeRule)
    private readonly ruleRepo: Repository<ResponseCodeRule>,
    @InjectRepository(ResponseCode)
    private readonly codeRepo: Repository<ResponseCode>
  ) {}

  /**
   * Upsert a rule — สร้างใหม่หรือแก้ไข existing rule (FR-022)
   */
  async upsertRule(dto: UpsertRuleDto): Promise<ResponseCodeRule> {
    const code = await this.codeRepo.findOne({
      where: { publicId: dto.responseCodePublicId },
    });

    if (!code) {
      throw new NotFoundException(
        `ResponseCode not found: ${dto.responseCodePublicId}`
      );
    }

    if (code.isSystem && !dto.isEnabled) {
      throw new BadRequestException('Cannot disable a system response code');
    }

    const existing = await this.ruleRepo.findOne({
      where: {
        documentTypeId: dto.documentTypeId,
        responseCodeId: code.id,
        projectId: dto.projectId ?? undefined,
      },
    });

    if (existing) {
      existing.isEnabled = dto.isEnabled;
      existing.requiresComments =
        dto.requiresComments ?? existing.requiresComments;
      existing.triggersNotification =
        dto.triggersNotification ?? existing.triggersNotification;
      return this.ruleRepo.save(existing);
    }

    const rule = this.ruleRepo.create({
      documentTypeId: dto.documentTypeId,
      responseCodeId: code.id,
      projectId: dto.projectId,
      isEnabled: dto.isEnabled,
      requiresComments: dto.requiresComments ?? false,
      triggersNotification: dto.triggersNotification ?? false,
    } as Partial<ResponseCodeRule>);

    return this.ruleRepo.save(rule);
  }

  /**
   * ดึง rules ทั้งหมดของ document type (global + project)
   */
  async getRulesByDocType(
    documentTypeId: number,
    projectId?: number
  ): Promise<ResponseCodeRule[]> {
    const where: Record<string, unknown> = { documentTypeId };
    if (projectId !== undefined) {
      where['projectId'] = projectId;
    } else {
      where['projectId'] = undefined; // global only
    }

    return this.ruleRepo.find({
      where,
      relations: ['responseCode'],
    });
  }

  /**
   * ลบ project override (หวนกลับใช้ global default)
   */
  async deleteProjectOverride(rulePublicId: string): Promise<void> {
    const rule = await this.ruleRepo.findOne({
      where: { publicId: rulePublicId },
    });
    if (!rule) throw new NotFoundException(rulePublicId);
    if (!rule.projectId) {
      throw new BadRequestException(
        'Cannot delete a global rule — disable it instead'
      );
    }
    await this.ruleRepo.remove(rule);
  }
}
