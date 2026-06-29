// File: src/modules/response-code/services/inheritance.service.ts
// Resolves project-level overrides inheriting from global defaults (T062, FR-021)
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseCodeRule } from '../entities/response-code-rule.entity';

export interface ResolvedMatrix {
  responseCodeId: number;
  responseCodePublicId: string;
  documentTypeId: number;
  isEnabled: boolean;
  requiresComments: boolean;
  triggersNotification: boolean;
  isOverridden: boolean; // true = project-specific rule overrides global
  parentRuleId?: number;
}

@Injectable()
export class InheritanceService {
  private readonly logger = new Logger(InheritanceService.name);

  constructor(
    @InjectRepository(ResponseCodeRule)
    private readonly ruleRepo: Repository<ResponseCodeRule>
  ) {}

  /**
   * ดึง rules สำหรับ document type โดย merge global + project overrides (FR-021)
   * Project rule ชนะ global rule ของ responseCode เดียวกัน
   *
   * @param documentTypeId  - document type ที่ต้องการ
   * @param projectId       - project ID (NULL = global only)
   */
  async resolveMatrix(
    documentTypeId: number,
    projectId?: number
  ): Promise<ResolvedMatrix[]> {
    // ดึง global rules (projectId IS NULL)
    const globalRules = await this.ruleRepo.find({
      where: { documentTypeId, projectId: undefined },
      relations: ['responseCode'],
    });

    if (!projectId) {
      return globalRules.map((r) => ({
        responseCodeId: r.responseCodeId,
        responseCodePublicId: r.responseCode.publicId,
        documentTypeId: r.documentTypeId,
        isEnabled: r.isEnabled,
        requiresComments: r.requiresComments,
        triggersNotification: r.triggersNotification,
        isOverridden: false,
        parentRuleId: undefined,
      }));
    }

    // ดึง project-specific overrides
    const projectRules = await this.ruleRepo.find({
      where: { documentTypeId, projectId },
      relations: ['responseCode'],
    });

    // Build map: responseCodeId → project rule
    const projectRuleMap = new Map(
      projectRules.map((r) => [r.responseCodeId, r])
    );

    // Merge: project overrides global
    const merged: ResolvedMatrix[] = globalRules.map((global) => {
      const override = projectRuleMap.get(global.responseCodeId);
      if (override) {
        return {
          responseCodeId: override.responseCodeId,
          responseCodePublicId: override.responseCode.publicId,
          documentTypeId: override.documentTypeId,
          isEnabled: override.isEnabled,
          requiresComments: override.requiresComments,
          triggersNotification: override.triggersNotification,
          isOverridden: true,
          parentRuleId: global.id,
        };
      }
      return {
        responseCodeId: global.responseCodeId,
        responseCodePublicId: global.responseCode.publicId,
        documentTypeId: global.documentTypeId,
        isEnabled: global.isEnabled,
        requiresComments: global.requiresComments,
        triggersNotification: global.triggersNotification,
        isOverridden: false,
        parentRuleId: undefined,
      };
    });

    // เพิ่ม project-only rules (ไม่มี global parent)
    for (const projectRule of projectRules) {
      const alreadyMerged = globalRules.some(
        (g) => g.responseCodeId === projectRule.responseCodeId
      );
      if (!alreadyMerged) {
        merged.push({
          responseCodeId: projectRule.responseCodeId,
          responseCodePublicId: projectRule.responseCode.publicId,
          documentTypeId: projectRule.documentTypeId,
          isEnabled: projectRule.isEnabled,
          requiresComments: projectRule.requiresComments,
          triggersNotification: projectRule.triggersNotification,
          isOverridden: true,
          parentRuleId: undefined,
        });
      }
    }

    this.logger.debug(
      `Resolved ${merged.length} rules for docType=${documentTypeId}, project=${projectId}`
    );

    return merged;
  }
}
