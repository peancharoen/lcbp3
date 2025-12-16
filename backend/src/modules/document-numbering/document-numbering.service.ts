// backend/src/modules/document-numbering/document-numbering.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock from 'redlock';

import { DocumentNumberCounter } from './entities/document-number-counter.entity';
import { DocumentNumberFormat } from './entities/document-number-format.entity';
import { DocumentNumberAudit } from './entities/document-number-audit.entity';
import { DocumentNumberError } from './entities/document-number-error.entity';
import { Project } from '../project/entities/project.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Discipline } from '../master/entities/discipline.entity';

import {
  GenerateNumberContext,
  DecodedTokens,
} from './interfaces/document-numbering.interface';

@Injectable()
export class DocumentNumberingService implements OnModuleInit {
  private readonly logger = new Logger(DocumentNumberingService.name);
  private redisClient: Redis;
  private redlock: Redlock;

  constructor(
    @InjectRepository(DocumentNumberCounter)
    private counterRepo: Repository<DocumentNumberCounter>,
    @InjectRepository(DocumentNumberFormat)
    private formatRepo: Repository<DocumentNumberFormat>,
    @InjectRepository(DocumentNumberAudit)
    private auditRepo: Repository<DocumentNumberAudit>,
    @InjectRepository(DocumentNumberError)
    private errorRepo: Repository<DocumentNumberError>,
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    @InjectRepository(CorrespondenceType)
    private typeRepo: Repository<CorrespondenceType>,
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
    @InjectRepository(Discipline)
    private disciplineRepo: Repository<Discipline>,
    private dataSource: DataSource,
    private configService: ConfigService
  ) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    this.redisClient = new Redis({
      host,
      port,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis Client Error', err);
    });

    this.redlock = new Redlock([this.redisClient], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 200,
    });
  }

  async generateNextNumber(
    ctx: GenerateNumberContext
  ): Promise<{ number: string; auditId: number }> {
    const currentYear = new Date().getFullYear();

    // 1. Resolve Format & Determine Counter Scope & Reset Rule
    const { template, counterTypeId, resetSequenceYearly } =
      await this.resolveFormatAndScope(ctx);
    const tokens = await this.resolveTokens(ctx, currentYear);

    // 2. Determine Counter Year Key
    // If resetSequenceYearly is true => Use current year (2025)
    // If resetSequenceYearly is false => Use year 0 (Continuous)
    const counterYear = resetSequenceYearly ? currentYear : 0;

    // 3. Build Lock Key
    const resourceKey = `counter:${ctx.projectId}:${counterTypeId ?? 'shared'}:${counterYear}`;

    let lock: any;
    try {
      try {
        lock = await this.redlock.acquire([`locks:${resourceKey}`], 5000);
      } catch (e) {
        this.logger.warn(
          `Redlock failed for ${resourceKey}, proceeding with DB optimistic lock.`
        );
      }

      // 4. Increment Counter (Atomic Transaction)
      const result = await this.dataSource.transaction(async (manager) => {
        let counter = await manager.findOne(DocumentNumberCounter, {
          where: {
            projectId: ctx.projectId,
            correspondenceTypeId:
              counterTypeId === null ? IsNull() : counterTypeId,
            year: counterYear,
          },
        });

        if (!counter) {
          counter = manager.create(DocumentNumberCounter, {
            projectId: ctx.projectId,
            correspondenceTypeId: counterTypeId, // Can be null
            year: counterYear,
            lastSequence: 0,
          });
        }

        counter.lastSequence += 1;
        return await manager.save(counter);
      });

      // 5. Generate Final String
      const generatedNumber = this.replaceTokens(
        template,
        tokens,
        result.lastSequence
      );

      // 6. Audit Log
      const audit = await this.logAudit({
        generatedNumber,
        counterKey: resourceKey,
        templateUsed: template,
        context: ctx,
        isSuccess: true,
      });

      return { number: generatedNumber, auditId: audit.id };
    } catch (error) {
      await this.logError(error, ctx, resourceKey);
      throw error;
    } finally {
      if (lock) await lock.release().catch((e) => this.logger.error(e));
    }
  }

  // --- Helper Methods ---

  private async resolveFormatAndScope(ctx: GenerateNumberContext): Promise<{
    template: string;
    counterTypeId: number | null;
    resetSequenceYearly: boolean;
  }> {
    // A. Try Specific Format
    const specificFormat = await this.formatRepo.findOne({
      where: { projectId: ctx.projectId, correspondenceTypeId: ctx.typeId },
    });

    if (specificFormat) {
      return {
        template: specificFormat.formatTemplate,
        counterTypeId: ctx.typeId,
        resetSequenceYearly: specificFormat.resetSequenceYearly,
      };
    }

    // B. Try Default Format (Type = NULL)
    const defaultFormat = await this.formatRepo.findOne({
      where: { projectId: ctx.projectId, correspondenceTypeId: IsNull() },
    });

    if (defaultFormat) {
      return {
        template: defaultFormat.formatTemplate,
        counterTypeId: null, // Use shared counter
        resetSequenceYearly: defaultFormat.resetSequenceYearly,
      };
    }

    // C. System Fallback
    return {
      template: '{ORG}-{RECIPIENT}-{SEQ:4}-{YEAR:BE}',
      counterTypeId: null, // Use shared counter
      resetSequenceYearly: true, // Default fallback behavior
    };
  }

  private async resolveTokens(
    ctx: GenerateNumberContext,
    year: number
  ): Promise<DecodedTokens> {
    const [project, type, recipientCode, disciplineCode, orgCode] =
      await Promise.all([
        this.projectRepo.findOne({
          where: { id: ctx.projectId },
          select: ['projectCode'],
        }),
        this.typeRepo.findOne({
          where: { id: ctx.typeId },
          select: ['typeCode'],
        }),
        this.resolveRecipientCode(ctx.recipientOrganizationId),
        this.resolveDisciplineCode(ctx.disciplineId),
        this.resolveOrgCode(ctx.originatorOrganizationId),
      ]);

    return {
      '{PROJECT}': project?.projectCode || 'PROJ',
      '{TYPE}': type?.typeCode || 'DOC',
      '{ORG}': orgCode,
      '{RECIPIENT}': recipientCode,
      '{DISCIPLINE}': disciplineCode,
      '{YEAR}': year.toString().substring(2),
      '{YEAR:BE}': (year + 543).toString().substring(2),
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
      const padding = parseInt(seqMatch[1], 10);
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
      select: ['code'],
    });
    return discipline ? discipline.code : 'GEN';
  }

  private async logAudit(data: any): Promise<DocumentNumberAudit> {
    const audit = this.auditRepo.create({
      ...data,
      projectId: data.context.projectId,
      createdBy: data.context.userId,
      ipAddress: data.context.ipAddress,
    });
    return await this.auditRepo.save(audit);
  }

  private async logError(error: any, ctx: any, key: string) {
    this.logger.error(
      `Document Numbering Error: ${error.message}`,
      error.stack
    );
    try {
      const errorRecord = this.errorRepo.create({
        projectId: ctx.projectId,
        errorType: error.name || 'UnknownError',
        errorMessage: error.message,
        stackTrace: error.stack,
        counterKey: key,
        inputPayload: JSON.stringify(ctx),
      });
      await this.errorRepo.save(errorRecord);
    } catch (e) {
      this.logger.error('Failed to save error log', e);
    }
  }
}
