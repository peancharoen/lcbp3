import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DocumentNumberFormat } from '../entities/document-number-format.entity';
import { Project } from '../../project/entities/project.entity';
import { CorrespondenceType } from '../../correspondence/entities/correspondence-type.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Discipline } from '../../master/entities/discipline.entity';

export interface FormatOptions {
  projectId: number;
  correspondenceTypeId: number;
  subTypeId?: number;
  rfaTypeId?: number;
  disciplineId?: number;
  sequence: number;
  resetScope: string;
  year?: number;
  originatorOrganizationId: number;
  recipientOrganizationId?: number;
}

export interface DecodedTokens {
  [key: string]: string;
}

@Injectable()
export class FormatService {
  constructor(
    @InjectRepository(DocumentNumberFormat)
    private formatRepo: Repository<DocumentNumberFormat>,
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    @InjectRepository(CorrespondenceType)
    private typeRepo: Repository<CorrespondenceType>,
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
    @InjectRepository(Discipline)
    private disciplineRepo: Repository<Discipline>
  ) {}

  async format(
    options: FormatOptions
  ): Promise<{ previewNumber: string; isDefault: boolean }> {
    const { template, isDefault } = await this.resolveFormatAndScope(options);
    const currentYear = options.year || new Date().getFullYear();
    const tokens = await this.resolveTokens(options, currentYear);

    const previewNumber = this.replaceTokens(
      template,
      tokens,
      options.sequence
    );
    //     console.log(
    //       `[FormatService] Generated: "${previewNumber}" | Template: "${template}" | isDefault: ${isDefault}`
    //     );
    return { previewNumber, isDefault };
  }

  // --- Helpers ---

  private async resolveFormatAndScope(options: FormatOptions): Promise<{
    template: string;
    resetSequenceYearly: boolean;
    isDefault: boolean;
  }> {
    // 1. Specific Format
    const specificFormat = await this.formatRepo.findOne({
      where: {
        projectId: options.projectId,
        correspondenceTypeId: options.correspondenceTypeId,
      },
    });
    if (specificFormat)
      return {
        template: specificFormat.formatTemplate,
        resetSequenceYearly: specificFormat.resetSequenceYearly,
        isDefault: false,
      };

    // 2. Default Format
    const defaultFormat = await this.formatRepo.findOne({
      where: { projectId: options.projectId, correspondenceTypeId: IsNull() },
    });
    if (defaultFormat)
      return {
        template: defaultFormat.formatTemplate,
        resetSequenceYearly: defaultFormat.resetSequenceYearly,
        isDefault: true,
      };

    // 3. Fallback
    return {
      template: '{ORG}-{RECIPIENT}-{SEQ:4}-{YEAR:BE}',
      resetSequenceYearly: true,
      isDefault: true,
    };
  }

  private async resolveTokens(
    options: FormatOptions,
    year: number
  ): Promise<DecodedTokens> {
    const [project, type, recipientCode, disciplineCode, orgCode] =
      await Promise.all([
        this.projectRepo.findOne({
          where: { id: options.projectId },
          select: ['projectCode'],
        }),
        this.typeRepo.findOne({
          where: { id: options.correspondenceTypeId },
          select: ['typeCode'],
        }),
        this.resolveRecipientCode(options.recipientOrganizationId),
        this.resolveDisciplineCode(options.disciplineId),
        this.resolveOrgCode(options.originatorOrganizationId),
      ]);

    return {
      '{PROJECT}': project?.projectCode || 'PROJ',
      '{TYPE}': type?.typeCode || 'DOC',
      '{ORG}': orgCode,
      '{RECIPIENT}': recipientCode,
      '{DISCIPLINE}': disciplineCode,
      '{YEAR}': year.toString(),
      '{YEAR:BE}': (year + 543).toString(),
      '{REV}': '0',
    };
  }

  private replaceTokens(
    template: string,
    tokens: DecodedTokens,
    sequence: number
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(tokens)) {
      result = result.replace(
        new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        value
      );
    }
    const seqMatch = result.match(/{SEQ:(\d+)}/);
    if (seqMatch) {
      const padding = Number(seqMatch[1]);
      result = result.replace(
        seqMatch[0],
        sequence.toString().padStart(padding, '0')
      );
    }
    return result;
  }

  private async resolveRecipientCode(recipientId?: number): Promise<string> {
    if (!recipientId) return 'GEN';
    const org = await this.orgRepo.findOne({
      where: { id: recipientId },
      select: ['organizationCode'],
    });
    return org ? org.organizationCode : 'GEN';
  }

  private async resolveOrgCode(orgId?: number): Promise<string> {
    if (!orgId) return 'GEN';
    const org = await this.orgRepo.findOne({
      where: { id: orgId },
      select: ['organizationCode'],
    });
    return org ? org.organizationCode : 'GEN';
  }

  private async resolveDisciplineCode(disciplineId?: number): Promise<string> {
    if (!disciplineId) return 'GEN';
    const discipline = await this.disciplineRepo.findOne({
      where: { id: disciplineId },
      select: ['disciplineCode'],
    });
    return discipline ? discipline.disciplineCode : 'GEN';
  }
}
