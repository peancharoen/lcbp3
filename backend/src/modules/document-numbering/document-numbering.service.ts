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
    const password = this.configService.get<string>('REDIS_PASSWORD');

    this.redisClient = new Redis({
      host,
      port,
      password,
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

  // ============================================================
  // Template Management Methods
  // ============================================================

  /**
   * Get all document numbering templates/formats
   */
  async getTemplates(): Promise<DocumentNumberFormat[]> {
    try {
      return await this.formatRepo.find({
        relations: ['correspondenceType', 'project'],
        order: { projectId: 'ASC', correspondenceTypeId: 'ASC' },
      });
    } catch (error) {
      // Fallback: return without relations if there's an error
      this.logger.warn(
        'Failed to load templates with relations, trying without',
        error
      );
      return this.formatRepo.find({
        order: { projectId: 'ASC', correspondenceTypeId: 'ASC' },
      });
    }
  }

  /**
   * Get templates filtered by project
   */
  async getTemplatesByProject(
    projectId: number
  ): Promise<DocumentNumberFormat[]> {
    return this.formatRepo.find({
      where: { projectId },
      relations: ['correspondenceType'],
      order: { correspondenceTypeId: 'ASC' },
    });
  }

  /**
   * Save (create or update) a template
   */
  async saveTemplate(
    dto: Partial<DocumentNumberFormat>
  ): Promise<DocumentNumberFormat> {
    if (dto.id) {
      // Update existing
      await this.formatRepo.update(dto.id, {
        formatTemplate: dto.formatTemplate,
        correspondenceTypeId: dto.correspondenceTypeId,
        description: dto.description,
        resetSequenceYearly: dto.resetSequenceYearly,
      });
      const updated = await this.formatRepo.findOne({ where: { id: dto.id } });
      if (!updated) throw new Error('Template not found after update');
      return updated;
    } else {
      // Create new
      const template = this.formatRepo.create({
        projectId: dto.projectId,
        correspondenceTypeId: dto.correspondenceTypeId ?? null,
        formatTemplate: dto.formatTemplate,
        description: dto.description,
        resetSequenceYearly: dto.resetSequenceYearly ?? true,
      });
      return this.formatRepo.save(template);
    }
  }

  /**
   * Delete a template by ID
   */
  async deleteTemplate(id: number): Promise<void> {
    await this.formatRepo.delete(id);
  }

  // ============================================================
  // Audit & Error Log Methods
  // ============================================================

  /**
   * Get audit logs for document number generation
   */
  async getAuditLogs(limit = 100): Promise<DocumentNumberAudit[]> {
    return this.auditRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get error logs for document numbering
   */
  async getErrorLogs(limit = 100): Promise<DocumentNumberError[]> {
    return this.errorRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ============================================================
  // Admin Override Methods (Stubs - To be fully implemented)
  // ============================================================

  /**
   * Manually override/set a counter value
   * @param dto { projectId, correspondenceTypeId, year, newValue }
   */
  async manualOverride(dto: {
    projectId: number;
    correspondenceTypeId: number | null;
    year: number;
    newValue: number;
  }): Promise<{ success: boolean; message: string }> {
    this.logger.warn(`Manual override requested: ${JSON.stringify(dto)}`);

    const counter = await this.counterRepo.findOne({
      where: {
        projectId: dto.projectId,
        correspondenceTypeId: dto.correspondenceTypeId ?? undefined,
        currentYear: dto.year,
      },
    });

    if (counter) {
      counter.lastNumber = dto.newValue;
      await this.counterRepo.save(counter);
      return { success: true, message: `Counter updated to ${dto.newValue}` };
    }

    // Create new counter if not exists
    const newCounter = this.counterRepo.create({
      projectId: dto.projectId,
      correspondenceTypeId: dto.correspondenceTypeId,
      currentYear: dto.year,
      lastNumber: dto.newValue,
      version: 0,
    });
    await this.counterRepo.save(newCounter);
    return {
      success: true,
      message: `New counter created with value ${dto.newValue}`,
    };
  }

  /**
   * Void a document number and generate a replacement
   * @param dto { documentId, reason, context }
   */
  async voidAndReplace(dto: {
    documentId: number;
    reason: string;
    context?: GenerateNumberContext;
  }): Promise<{ newNumber: string; auditId: number }> {
    this.logger.warn(
      `Void and replace requested for document: ${dto.documentId}`
    );

    // 1. Find original audit record for this document
    const originalAudit = await this.auditRepo.findOne({
      where: { documentId: dto.documentId },
      order: { createdAt: 'DESC' },
    });

    if (!originalAudit) {
      throw new Error(
        `No audit record found for document ID: ${dto.documentId}`
      );
    }

    // 2. Create void audit record
    const voidAudit = this.auditRepo.create({
      documentId: dto.documentId,
      generatedNumber: originalAudit.generatedNumber,
      counterKey: originalAudit.counterKey,
      templateUsed: originalAudit.templateUsed,
      operation: 'VOID_REPLACE',
      metadata: {
        reason: dto.reason,
        originalAuditId: originalAudit.id,
        voidedAt: new Date().toISOString(),
      },
      userId: dto.context?.userId ?? 0,
      ipAddress: dto.context?.ipAddress,
    });
    await this.auditRepo.save(voidAudit);

    // 3. Generate new number if context is provided
    if (dto.context) {
      const result = await this.generateNextNumber(dto.context);
      return result;
    }

    // If no context, return info about the void operation
    return {
      newNumber: `VOIDED:${originalAudit.generatedNumber}`,
      auditId: voidAudit.id,
    };
  }

  /**
   * Cancel/skip a specific document number
   * @param dto { documentNumber, reason, userId }
   */
  async cancelNumber(dto: {
    documentNumber: string;
    reason: string;
    userId?: number;
    ipAddress?: string;
  }): Promise<{ success: boolean; auditId: number }> {
    this.logger.warn(`Cancel number requested: ${dto.documentNumber}`);

    // Find existing audit record for this number
    const existingAudit = await this.auditRepo.findOne({
      where: { generatedNumber: dto.documentNumber },
      order: { createdAt: 'DESC' },
    });

    // Create cancellation audit record
    const cancelAudit = this.auditRepo.create({
      documentId: existingAudit?.documentId ?? 0,
      generatedNumber: dto.documentNumber,
      counterKey: existingAudit?.counterKey ?? { cancelled: true },
      templateUsed: existingAudit?.templateUsed ?? 'CANCELLED',
      operation: 'CANCEL',
      metadata: {
        reason: dto.reason,
        cancelledAt: new Date().toISOString(),
        originalAuditId: existingAudit?.id,
      },
      userId: dto.userId ?? 0,
      ipAddress: dto.ipAddress,
    });

    const saved = await this.auditRepo.save(cancelAudit);

    return { success: true, auditId: saved.id };
  }

  /**
   * Bulk import counter values
   */
  async bulkImport(
    items: Array<{
      projectId: number;
      correspondenceTypeId: number | null;
      year: number;
      lastNumber: number;
    }>
  ): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    for (const item of items) {
      try {
        await this.manualOverride({
          projectId: item.projectId,
          correspondenceTypeId: item.correspondenceTypeId,
          year: item.year,
          newValue: item.lastNumber,
        });
        imported++;
      } catch (e: any) {
        errors.push(`Failed to import: ${JSON.stringify(item)} - ${e.message}`);
      }
    }

    return { imported, errors };
  }

  // ============================================================
  // Query Methods
  // ============================================================

  /**
   * Get all counter sequences - for admin UI
   */
  async getSequences(projectId?: number): Promise<
    Array<{
      projectId: number;
      originatorId: number;
      recipientOrganizationId: number;
      typeId: number;
      disciplineId: number;
      year: number;
      lastNumber: number;
    }>
  > {
    const whereClause = projectId ? { projectId } : {};

    const counters = await this.counterRepo.find({
      where: whereClause,
      order: { year: 'DESC', lastNumber: 'DESC' },
    });

    return counters.map((c) => ({
      projectId: c.projectId,
      originatorId: c.originatorId,
      recipientOrganizationId: c.recipientOrganizationId,
      typeId: c.typeId,
      disciplineId: c.disciplineId,
      year: c.year,
      lastNumber: c.lastNumber,
    }));
  }

  /**
   * Preview what a document number would look like
   * WITHOUT actually incrementing the counter
   */
  async previewNumber(
    ctx: GenerateNumberContext
  ): Promise<{ previewNumber: string; nextSequence: number }> {
    const currentYear = new Date().getFullYear();

    // 1. Resolve Format
    const { template, resetSequenceYearly } =
      await this.resolveFormatAndScope(ctx);
    const tokens = await this.resolveTokens(ctx, currentYear);

    // 2. Get current counter value (without incrementing)
    const counterYear = resetSequenceYearly ? currentYear : 0;

    const existingCounter = await this.counterRepo.findOne({
      where: {
        projectId: ctx.projectId,
        originatorId: ctx.originatorId,
        typeId: ctx.typeId,
        disciplineId: ctx.disciplineId ?? 0,
        year: counterYear,
      },
    });

    const currentSequence = existingCounter?.lastNumber ?? 0;
    const nextSequence = currentSequence + 1;

    // 3. Generate preview number
    const previewNumber = this.replaceTokens(template, tokens, nextSequence);

    return { previewNumber, nextSequence };
  }

  /**
   * Set counter value directly (for admin use)
   */
  async setCounterValue(counterId: number, newSequence: number): Promise<void> {
    await this.counterRepo.update(counterId, { lastNumber: newSequence });
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
