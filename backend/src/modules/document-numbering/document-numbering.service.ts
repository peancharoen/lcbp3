// File: src/modules/document-numbering/document-numbering.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  OptimisticLockVersionMismatchError,
} from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock from 'redlock';

// Entities
import { DocumentNumberCounter } from './entities/document-number-counter.entity';
import { DocumentNumberFormat } from './entities/document-number-format.entity';
import { Project } from '../project/entities/project.entity'; // สมมติ path
import { Organization } from '../organization/entities/organization.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { Discipline } from '../master/entities/discipline.entity';
import { CorrespondenceSubType } from '../correspondence/entities/correspondence-sub-type.entity';
import { DocumentNumberAudit } from './entities/document-number-audit.entity'; // [P0-4]
import { DocumentNumberError } from './entities/document-number-error.entity'; // [P0-4]

// Interfaces
import {
  GenerateNumberContext,
  DecodedTokens,
} from './interfaces/document-numbering.interface.js';

@Injectable()
export class DocumentNumberingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentNumberingService.name);
  private redisClient!: Redis;
  private redlock!: Redlock;

  constructor(
    @InjectRepository(DocumentNumberCounter)
    private counterRepo: Repository<DocumentNumberCounter>,
    @InjectRepository(DocumentNumberFormat)
    private formatRepo: Repository<DocumentNumberFormat>,

    // Inject Repositories สำหรับดึง Code มาทำ Token Replacement
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(CorrespondenceType)
    private typeRepo: Repository<CorrespondenceType>,
    @InjectRepository(Discipline)
    private disciplineRepo: Repository<Discipline>,
    @InjectRepository(CorrespondenceSubType)
    private subTypeRepo: Repository<CorrespondenceSubType>,
    @InjectRepository(DocumentNumberAudit) // [P0-4]
    private auditRepo: Repository<DocumentNumberAudit>,
    @InjectRepository(DocumentNumberError) // [P0-4]
    private errorRepo: Repository<DocumentNumberError>,

    private configService: ConfigService
  ) {}

  onModuleInit() {
    // 1. Setup Redis Connection & Redlock
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    this.redisClient = new Redis({ host, port, password });

    // Config Redlock สำหรับ Distributed Lock
    this.redlock = new Redlock([this.redisClient], {
      driftFactor: 0.01,
      retryCount: 10, // Retry 10 ครั้ง
      retryDelay: 200, // รอ 200ms ต่อครั้ง
      retryJitter: 200,
    });

    this.logger.log(
      `Document Numbering Service initialized (Redis: ${host}:${port})`
    );
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  /**
   * สร้างเลขที่เอกสารใหม่ (Thread-Safe & Gap-free)
   */
  async generateNextNumber(ctx: GenerateNumberContext): Promise<string> {
    const year = ctx.year || new Date().getFullYear();
    const disciplineId = ctx.disciplineId || 0;

    // 1. Resolve Tokens Outside Lock
    const tokens = await this.resolveTokens(ctx, year);

    // 2. Get Format Template WITH META (Padding)
    const { template, paddingLength } = await this.getFormatTemplateWithMeta(
      ctx.projectId,
      ctx.typeId,
      disciplineId
    );

    // 3. Resource Key
    const resourceKey = `doc_num:${ctx.projectId}:${ctx.typeId}:${disciplineId}:${year}`;
    const lockTtl = 5000;

    let lock;
    try {
      lock = await this.redlock.acquire([resourceKey], lockTtl);

      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        try {
          const recipientId = ctx.recipientOrganizationId ?? -1;
          const subTypeId = ctx.subTypeId ?? 0;
          const rfaTypeId = ctx.rfaTypeId ?? 0;

          let counter = await this.counterRepo.findOne({
            where: {
              projectId: ctx.projectId,
              originatorId: ctx.originatorId,
              recipientOrganizationId: recipientId,
              typeId: ctx.typeId,
              subTypeId: subTypeId,
              rfaTypeId: rfaTypeId,
              disciplineId: disciplineId,
              year: year,
            },
          });

          if (!counter) {
            counter = this.counterRepo.create({
              projectId: ctx.projectId,
              originatorId: ctx.originatorId,
              recipientOrganizationId: recipientId,
              typeId: ctx.typeId,
              subTypeId: subTypeId,
              rfaTypeId: rfaTypeId,
              disciplineId: disciplineId,
              year: year,
              lastNumber: 0,
            });
          }

          counter.lastNumber += 1;
          await this.counterRepo.save(counter);

          const generatedNumber = this.replaceTokens(
            template,
            tokens,
            counter.lastNumber,
            paddingLength // Pass padding from template
          );

          // Audit skipped for brevity in this block, assumed handled or TBD
          return generatedNumber;
        } catch (err) {
          if (err instanceof OptimisticLockVersionMismatchError) {
            continue;
          }
          throw err;
        }
      }
      throw new InternalServerErrorException('Failed to generate number');
    } catch (error: any) {
      // Error logging...
      throw error;
    } finally {
      if (lock) await lock.release().catch(() => {});
    }
  }

  async previewNextNumber(
    ctx: GenerateNumberContext
  ): Promise<{ number: string; isDefaultTemplate: boolean }> {
    const year = ctx.year || new Date().getFullYear();
    const disciplineId = ctx.disciplineId || 0;

    const tokens = await this.resolveTokens(ctx, year);

    const { template, isDefault, paddingLength } =
      await this.getFormatTemplateWithMeta(
        ctx.projectId,
        ctx.typeId,
        disciplineId
      );

    const recipientId = ctx.recipientOrganizationId ?? -1;
    const subTypeId = ctx.subTypeId ?? 0;
    const rfaTypeId = ctx.rfaTypeId ?? 0;

    const counter = await this.counterRepo.findOne({
      where: {
        projectId: ctx.projectId,
        originatorId: ctx.originatorId,
        recipientOrganizationId: recipientId,
        typeId: ctx.typeId,
        subTypeId: subTypeId,
        rfaTypeId: rfaTypeId,
        disciplineId: disciplineId,
        year: year,
      },
    });

    const nextSeq = (counter?.lastNumber || 0) + 1;

    const generatedNumber = this.replaceTokens(
      template,
      tokens,
      nextSeq,
      paddingLength
    );

    return {
      number: generatedNumber,
      isDefaultTemplate: isDefault,
    };
  }

  /**
   * Helper: ดึงข้อมูล Code ต่างๆ จาก ID เพื่อนำมาแทนที่ใน Template
   */
  private async resolveTokens(
    ctx: GenerateNumberContext,
    year: number
  ): Promise<DecodedTokens> {
    const [project, org, type] = await Promise.all([
      this.projectRepo.findOne({ where: { id: ctx.projectId } }),
      this.orgRepo.findOne({ where: { id: ctx.originatorId } }),
      this.typeRepo.findOne({ where: { id: ctx.typeId } }),
    ]);

    if (!project || !org || !type) {
      throw new NotFoundException('Project, Organization, or Type not found');
    }

    // [v1.5.1] Support Custom Tokens Override
    const custom = ctx.customTokens || {};

    let disciplineCode = custom.DISCIPLINE_CODE || '000';
    if (!custom.DISCIPLINE_CODE && ctx.disciplineId) {
      const discipline = await this.disciplineRepo.findOne({
        where: { id: ctx.disciplineId },
      });
      if (discipline) disciplineCode = discipline.disciplineCode;
    }

    let subTypeCode = custom.SUB_TYPE_CODE || '00';
    let subTypeNumber = custom.SUB_TYPE_NUMBER || '00';
    if (!custom.SUB_TYPE_CODE && ctx.subTypeId) {
      const subType = await this.subTypeRepo.findOne({
        where: { id: ctx.subTypeId },
      });
      if (subType) {
        subTypeCode = subType.subTypeCode;
        subTypeNumber = subType.subTypeNumber || '00';
      }
    }

    // Convert Christian Year to Buddhist Year if needed (Req usually uses Christian, but prepared logic)
    // ใน Req 6B ตัวอย่างใช้ 2568 (พ.ศ.) ดังนั้นต้องแปลง
    const yearTh = (year + 543).toString();

    // [v1.5.1] Resolve recipient organization
    let recipientCode = custom.RECIPIENT_CODE || custom.REC_CODE || '';
    if (
      !recipientCode &&
      ctx.recipientOrganizationId &&
      ctx.recipientOrganizationId > 0
    ) {
      const recipient = await this.orgRepo.findOne({
        where: { id: ctx.recipientOrganizationId },
      });
      if (recipient) {
        recipientCode = recipient.organizationCode;
      }
    }

    return {
      projectCode: project.projectCode,
      orgCode: org.organizationCode,
      typeCode: type.typeCode,
      disciplineCode,
      subTypeCode,
      subTypeNumber,
      year: yearTh,
      yearShort: yearTh.slice(-2), // 68
      recipientCode, // [P1-4]
    };
  }

  // --- Template Management ---

  async getTemplates(): Promise<DocumentNumberFormat[]> {
    const templates = await this.formatRepo.find({
      relations: ['project'], // Join project for names if needed
      order: {
        projectId: 'ASC',
        correspondenceTypeId: 'ASC',
        disciplineId: 'ASC',
      },
    });
    // Add documentTypeName via manual join or map if needed.
    // Ideally we should relation to CorrespondenceType too, but for now we might need to fetch manually if relation not strict
    return templates;
  }

  async saveTemplate(
    dto: Partial<DocumentNumberFormat>
  ): Promise<DocumentNumberFormat> {
    if (dto.id) {
      await this.formatRepo.update(dto.id, dto);
      return this.formatRepo.findOneOrFail({ where: { id: dto.id } });
    }
    const newTemplate = this.formatRepo.create(dto);
    return this.formatRepo.save(newTemplate);
  }

  /**
   * Helper: Find Template from DB or use Default (with metadata)
   * Supports Specific Discipline -> Global Discipline Fallback
   */
  private async getFormatTemplateWithMeta(
    projectId: number,
    typeId: number,
    disciplineId: number = 0
  ): Promise<{ template: string; isDefault: boolean; paddingLength: number }> {
    // 1. Try Specific Discipline
    let format = await this.formatRepo.findOne({
      where: {
        projectId,
        correspondenceTypeId: typeId,
        disciplineId: disciplineId,
      },
    });

    // 2. Fallback to All Disciplines (0) if specific not found
    if (!format && disciplineId !== 0) {
      format = await this.formatRepo.findOne({
        where: { projectId, correspondenceTypeId: typeId, disciplineId: 0 },
      });
    }

    if (format) {
      return {
        template: format.formatTemplate,
        isDefault: false,
        paddingLength: format.paddingLength,
      };
    }

    // Default Fallback Format
    return {
      template: '{ORG}-{RECIPIENT}-{SEQ:4}-{YEAR}',
      isDefault: true,
      paddingLength: 4,
    };
  }

  /**
   * Legacy wrapper for backward compatibility
   */
  private async getFormatTemplate(
    projectId: number,
    typeId: number,
    disciplineId: number = 0
  ): Promise<string> {
    const { template } = await this.getFormatTemplateWithMeta(
      projectId,
      typeId,
      disciplineId
    );
    return template;
  }

  /**
   * Helper: แทนที่ Token ใน Template ด้วยค่าจริง
   */
  private replaceTokens(
    template: string,
    tokens: DecodedTokens,
    seq: number,
    defaultPadding: number = 4
  ): string {
    let result = template;

    const replacements: Record<string, string> = {
      '{PROJECT}': tokens.projectCode,
      '{ORG}': tokens.orgCode,
      '{TYPE}': tokens.typeCode,
      '{DISCIPLINE}': tokens.disciplineCode,
      '{SUBTYPE}': tokens.subTypeCode,
      '{SUBTYPE_NUM}': tokens.subTypeNumber, // [Req 6B] For Transmittal/RFA
      '{RECIPIENT}': tokens.recipientCode, // [P1-4] Recipient organization
      '{YEAR}': tokens.year,
      '{YEAR_SHORT}': tokens.yearShort,
    };

    // 1. Replace Standard Tokens
    for (const [key, value] of Object.entries(replacements)) {
      // ใช้ Global Replace
      result = result.split(key).join(value);
    }

    // 2. Replace Sequence Token {SEQ:n} e.g., {SEQ:4}
    // If n is provided in token, use it. If not, use Template Padding setting.
    result = result.replace(/{SEQ(?::(\d+))?}/g, (_, digits) => {
      const padLength = digits ? parseInt(digits, 10) : defaultPadding;
      return seq.toString().padStart(padLength, '0');
    });

    return result;
  }

  /**
   * [P0-4] Log successful number generation to audit table
   */
  private async logAudit(
    auditData: Partial<DocumentNumberAudit>
  ): Promise<void> {
    try {
      // Ensure operation is set, default to CONFIRM if not provided
      const dataToSave = {
        ...auditData,
        operation: auditData.operation || 'CONFIRM',
      };
      await this.auditRepo.save(dataToSave);
    } catch (error) {
      this.logger.error('Failed to log audit', error);
    }
  }

  /**
   * [P0-4] Log error to error table
   */
  private async logError(
    errorData: Partial<DocumentNumberError>
  ): Promise<void> {
    try {
      await this.errorRepo.save(errorData);
    } catch (error) {
      this.logger.error('Failed to log error', error);
    }
  }

  /**
   * [P0-4] Classify error type for logging
   */
  private classifyError(error: any): string {
    if (error.message?.includes('lock') || error.message?.includes('Lock')) {
      return 'LOCK_TIMEOUT';
    }
    if (error instanceof OptimisticLockVersionMismatchError) {
      return 'VERSION_CONFLICT';
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return 'REDIS_ERROR';
    }
    if (error.name === 'QueryFailedError') {
      return 'DB_ERROR';
    }
    return 'VALIDATION_ERROR';
  }

  // --- Log Retrieval for Admin UI ---

  async getAuditLogs(limit = 100): Promise<DocumentNumberAudit[]> {
    return this.auditRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getErrorLogs(limit = 100): Promise<DocumentNumberError[]> {
    return this.errorRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // --- Admin Operations ---

  /**
   * Manual Override: Force set the counter to a specific number.
   * Useful for aligning with legacy systems or skipping numbers.
   */
  async manualOverride(dto: any): Promise<void> {
    const {
      projectId,
      originatorId,
      typeId,
      disciplineId,
      year,
      newSequence,
      reason,
      userId,
    } = dto;

    const resourceKey = `doc_num:${projectId}:${typeId}:${disciplineId || 0}:${year || new Date().getFullYear()}`;
    const lockTtl = 5000;
    let lock;

    try {
      lock = await this.redlock.acquire([resourceKey], lockTtl);

      // Find or Create Counter
      let counter = await this.counterRepo.findOne({
        where: {
          projectId,
          originatorId,
          recipientOrganizationId: dto.recipientOrganizationId ?? -1,
          typeId,
          subTypeId: dto.subTypeId ?? 0,
          rfaTypeId: dto.rfaTypeId ?? 0,
          disciplineId: disciplineId || 0,
          year: year || new Date().getFullYear(),
        },
      });

      if (!counter) {
        counter = this.counterRepo.create({
          projectId,
          originatorId,
          recipientOrganizationId: dto.recipientOrganizationId ?? -1,
          typeId,
          subTypeId: dto.subTypeId ?? 0,
          rfaTypeId: dto.rfaTypeId ?? 0,
          disciplineId: disciplineId || 0,
          year: year || new Date().getFullYear(),
          lastNumber: 0,
        });
      }

      const oldNumber = counter.lastNumber;
      if (newSequence <= oldNumber) {
        // Warning: Manual override to lower number might cause collisions
        this.logger.warn(
          `Manual override to lower sequence: ${oldNumber} -> ${newSequence}`
        );
      }

      counter.lastNumber = newSequence;
      await this.counterRepo.save(counter);

      // Log Audit
      await this.logAudit({
        generatedNumber: `MANUAL-${newSequence}`,
        counterKey: { key: resourceKey },
        templateUsed: 'MANUAL_OVERRIDE',
        documentId: 0,
        userId: userId,
        operation: 'MANUAL_OVERRIDE',
        metadata: { reason, oldNumber, newNumber: newSequence },
      });
    } catch (error) {
      throw error;
    } finally {
      if (lock) await lock.release().catch(() => {});
    }
  }

  /**
   * Bulk Import: Set initial counters for migration.
   */
  async bulkImport(items: any[]): Promise<void> {
    for (const item of items) {
      // Reuse manualOverride logic loosely, or implement bulk specific logic
      // optimizing by not locking if we assume offline migration
      // For safety, let's just update repo directly
      await this.manualOverride(item);
    }
  }

  /**
   * Cancel Number: Mark a number as cancelled/skipped in Audit.
   * Does NOT rollback counter (unless specified).
   */
  async cancelNumber(dto: any): Promise<void> {
    const { userId, generatedNumber, reason } = dto;
    await this.logAudit({
      generatedNumber,
      counterKey: {},
      templateUsed: 'N/A',
      documentId: 0,
      userId,
      operation: 'CANCEL',
      metadata: { reason },
    });
  }

  /**
   * Void and Replace: Mark old number as void, generate new one to replace it.
   * Used when users made a mistake in critical fields.
   */
  async voidAndReplace(dto: any): Promise<string> {
    const { oldNumber, reason, newGenerationContext } = dto;

    // 1. Audit old number as VOID_REPLACE
    await this.logAudit({
      generatedNumber: oldNumber,
      counterKey: {},
      templateUsed: 'N/A',
      documentId: 0, // Should link to doc if possible
      userId: newGenerationContext.userId,
      operation: 'VOID_REPLACE',
      metadata: { reason, replacedByNewGeneration: true },
    });

    // 2. Generate New Number
    return this.generateNextNumber(newGenerationContext);
  }

  /**
   * Update Number for Draft:
   * Handles logic when a Draft document changes critical fields (Project, Type, etc.)
   * - Tries to rollback the old number if it's the latest one.
   * - Otherwise, voids the old number.
   * - Generates a new number for the new context.
   */
  async updateNumberForDraft(
    oldNumber: string,
    oldCtx: GenerateNumberContext,
    newCtx: GenerateNumberContext
  ): Promise<string> {
    const year = oldCtx.year || new Date().getFullYear();
    const disciplineId = oldCtx.disciplineId || 0;
    const resourceKey = `doc_num:${oldCtx.projectId}:${oldCtx.typeId}:${disciplineId}:${year}`;
    const lockTtl = 5000;
    let lock;

    try {
      // 1. Try Rollback Old Number
      lock = await this.redlock.acquire([resourceKey], lockTtl);

      const recipientId = oldCtx.recipientOrganizationId ?? -1;
      const subTypeId = oldCtx.subTypeId ?? 0;
      const rfaTypeId = oldCtx.rfaTypeId ?? 0;

      const counter = await this.counterRepo.findOne({
        where: {
          projectId: oldCtx.projectId,
          originatorId: oldCtx.originatorId,
          recipientOrganizationId: recipientId,
          typeId: oldCtx.typeId,
          subTypeId: subTypeId,
          rfaTypeId: rfaTypeId,
          disciplineId: disciplineId,
          year: year,
        },
      });

      if (counter && counter.lastNumber > 0) {
        // Construct what the number SHOULD be if it matches lastNumber
        const tokens = await this.resolveTokens(oldCtx, year);
        const { template } = await this.getFormatTemplateWithMeta(
          oldCtx.projectId,
          oldCtx.typeId
        );
        const expectedNumber = this.replaceTokens(
          template,
          tokens,
          counter.lastNumber
        );

        if (expectedNumber === oldNumber) {
          // MATCH! We can rollback.
          counter.lastNumber -= 1;
          await this.counterRepo.save(counter);

          await this.logAudit({
            generatedNumber: oldNumber,
            counterKey: { key: resourceKey },
            templateUsed: template,
            documentId: 0,
            userId: newCtx.userId,
            operation: 'RESERVE', // Use RESERVE or CANCEL to indicate rollback/freed up
            metadata: {
              action: 'ROLLBACK_DRAFT',
              reason: 'Critical field changed in Draft',
            },
          });
          this.logger.log(
            `Rolled back number ${oldNumber} (Seq ${counter.lastNumber + 1})`
          );
        } else {
          // NO MATCH. Cannot rollback. Mark as VOID_REPLACE.
          await this.logAudit({
            generatedNumber: oldNumber,
            counterKey: { key: resourceKey },
            templateUsed: 'N/A',
            documentId: 0,
            userId: newCtx.userId,
            operation: 'VOID_REPLACE',
            metadata: {
              reason:
                'Critical field changed in Draft (Rollback failed - not latest)',
            },
          });
        }
      } else {
        // Counter not found or 0. Just Void.
        await this.logAudit({
          generatedNumber: oldNumber,
          counterKey: {},
          templateUsed: 'N/A',
          documentId: 0,
          userId: newCtx.userId,
          operation: 'VOID_REPLACE',
          metadata: { reason: 'Critical field changed (Counter not found)' },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to rollback number ${oldNumber}: ${err as any}`);
      // Fallback: Ensure we at least void it in audit if rollback failed logic
      await this.logAudit({
        generatedNumber: oldNumber,
        counterKey: {},
        templateUsed: 'N/A',
        documentId: 0,
        userId: newCtx.userId,
        operation: 'VOID_REPLACE',
        metadata: { reason: 'Rollback error' },
      });
    } finally {
      if (lock) await lock.release().catch(() => {});
    }

    // 2. Generate New Number
    return this.generateNextNumber(newCtx);
  }
}
