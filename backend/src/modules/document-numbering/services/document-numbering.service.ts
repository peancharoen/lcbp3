import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { DocumentNumberFormat } from '../entities/document-number-format.entity';
import { DocumentNumberAudit } from '../entities/document-number-audit.entity';
import { DocumentNumberError } from '../entities/document-number-error.entity';

// Services
import { CounterService } from './counter.service';
import { ReservationService } from './reservation.service';
import { FormatService } from './format.service';
import { DocumentNumberingLockService } from './document-numbering-lock.service';
import { ManualOverrideService } from './manual-override.service';
import { MetricsService } from './metrics.service';

// DTOs
import { CounterKeyDto } from '../dto/counter-key.dto';
import { GenerateNumberContext } from '../interfaces/document-numbering.interface';
import { ReserveNumberDto } from '../dto/reserve-number.dto';
import { ConfirmReservationDto } from '../dto/confirm-reservation.dto';

@Injectable()
export class DocumentNumberingService {
  private readonly logger = new Logger(DocumentNumberingService.name);

  constructor(
    @InjectRepository(DocumentNumberFormat)
    private formatRepo: Repository<DocumentNumberFormat>,
    @InjectRepository(DocumentNumberAudit)
    private auditRepo: Repository<DocumentNumberAudit>,
    @InjectRepository(DocumentNumberError)
    private errorRepo: Repository<DocumentNumberError>,

    private counterService: CounterService,
    private reservationService: ReservationService,
    private formatService: FormatService,
    private lockService: DocumentNumberingLockService,
    private configService: ConfigService,
    private manualOverrideService: ManualOverrideService,
    private metricsService: MetricsService
  ) {}

  async generateNextNumber(
    ctx: GenerateNumberContext
  ): Promise<{ number: string; auditId: number }> {
    let lock = null;
    try {
      // 0. Check Idempotency (Ideally done in Guard/Middleware, but double check here if passed)
      // Note: If idempotencyKey exists in ctx, check audit log for existing SUCCESS entry?
      // Omitted for brevity as per spec usually handled by middleware or separate check.

      const currentYear = new Date().getFullYear();
      const resetScope = `YEAR_${currentYear}`;

      // 1. Prepare Counter Key
      const key: CounterKeyDto = {
        projectId: ctx.projectId,
        originatorOrganizationId: ctx.originatorOrganizationId,
        recipientOrganizationId: ctx.recipientOrganizationId || 0,
        correspondenceTypeId: ctx.typeId,
        subTypeId: ctx.subTypeId || 0,
        rfaTypeId: ctx.rfaTypeId || 0,
        disciplineId: ctx.disciplineId || 0,
        resetScope: resetScope,
      };

      // 2. Acquire Redis Lock
      try {
        // Map CounterKeyDto to LockCounterKey (names slightly different or cast if same)
        lock = await this.lockService.acquireLock({
          projectId: key.projectId,
          originatorOrgId: key.originatorOrganizationId,
          recipientOrgId: key.recipientOrganizationId,
          correspondenceTypeId: key.correspondenceTypeId,
          subTypeId: key.subTypeId,
          rfaTypeId: key.rfaTypeId,
          disciplineId: key.disciplineId,
          resetScope: key.resetScope,
        });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        this.logger.warn(
          `Failed to acquire Redis lock, falling back to DB lock only: ${errorMessage}`
        );
        this.metricsService.lockFailures.inc({
          project_id: String(key.projectId),
        });
        // Fallback: Proceed without Redlock, relying on CounterService DB optimistic lock
      }

      // 3. Increment Counter
      const sequence = await this.counterService.incrementCounter(key);

      // 4. Format Number
      const generatedNumber = await this.formatService.format({
        projectId: ctx.projectId,
        correspondenceTypeId: ctx.typeId,
        subTypeId: ctx.subTypeId,
        rfaTypeId: ctx.rfaTypeId,
        disciplineId: ctx.disciplineId,
        sequence: sequence,
        resetScope: resetScope,
        year: currentYear,
        originatorOrganizationId: ctx.originatorOrganizationId,
        recipientOrganizationId: ctx.recipientOrganizationId,
      });

      // 5. Audit Log
      const audit = await this.logAudit({
        generatedNumber,
        counterKey: JSON.stringify(key),
        templateUsed: 'DELEGATED_TO_FORMAT_SERVICE',
        context: ctx,
        isSuccess: true,
        operation: 'GENERATE',
        // metadata: { idempotencyKey: ctx.idempotencyKey } // If available
      });

      this.metricsService.numbersGenerated.inc({
        project_id: String(ctx.projectId),
        type_id: String(ctx.typeId),
      });

      return { number: generatedNumber, auditId: audit.id };
    } catch (error: any) {
      await this.logError(error, ctx, 'GENERATE');
      throw error;
    } finally {
      if (lock) {
        await this.lockService.releaseLock(lock);
      }
    }
  }

  async reserveNumber(
    dto: ReserveNumberDto,
    userId: number,
    ipAddress?: string
  ): Promise<any> {
    try {
      // Delegate completely to ReservationService
      return await this.reservationService.reserve(
        dto,
        userId,
        ipAddress || '0.0.0.0',
        'Unknown' // userAgent not passed in legacy call
      );
    } catch (error: any) {
      this.logger.error('Reservation failed', error);
      throw error;
    }
  }

  async confirmReservation(
    dto: ConfirmReservationDto,
    userId: number
  ): Promise<any> {
    return this.reservationService.confirm(dto, userId);
  }

  async cancelReservation(token: string, userId: number): Promise<void> {
    return this.reservationService.cancel(token, userId);
  }

  async previewNumber(
    ctx: GenerateNumberContext
  ): Promise<{ previewNumber: string; nextSequence: number }> {
    const currentYear = new Date().getFullYear();
    const resetScope = `YEAR_${currentYear}`;

    const key: CounterKeyDto = {
      projectId: ctx.projectId,
      originatorOrganizationId: ctx.originatorOrganizationId,
      recipientOrganizationId: ctx.recipientOrganizationId || 0,
      correspondenceTypeId: ctx.typeId,
      subTypeId: ctx.subTypeId || 0,
      rfaTypeId: ctx.rfaTypeId || 0,
      disciplineId: ctx.disciplineId || 0,
      resetScope: resetScope,
    };

    const currentSeq = await this.counterService.getCurrentCounter(key);
    const nextSequence = currentSeq + 1;

    const previewNumber = await this.formatService.format({
      projectId: ctx.projectId,
      correspondenceTypeId: ctx.typeId,
      subTypeId: ctx.subTypeId,
      rfaTypeId: ctx.rfaTypeId,
      disciplineId: ctx.disciplineId,
      sequence: nextSequence,
      resetScope: resetScope,
      year: currentYear,
      originatorOrganizationId: ctx.originatorOrganizationId,
      recipientOrganizationId: ctx.recipientOrganizationId,
    });

    return { previewNumber, nextSequence };
  }

  /**
   * Generates a new number for a draft when its context changes.
   */
  async updateNumberForDraft(
    currentNumber: string,
    oldCtx: GenerateNumberContext,
    newCtx: GenerateNumberContext
  ): Promise<string> {
    const result = await this.generateNextNumber(newCtx);
    return result.number;
  }

  // --- Admin / Legacy ---

  async getTemplates() {
    return this.formatRepo.find();
  }

  async getTemplatesByProject(projectId: number) {
    return this.formatRepo.find({ where: { projectId } });
  }

  async saveTemplate(dto: any) {
    return this.formatRepo.save(dto);
  }

  async deleteTemplate(id: number) {
    return this.formatRepo.delete(id);
  }

  async getAuditLogs(limit: number) {
    return this.auditRepo.find({ take: limit, order: { createdAt: 'DESC' } });
  }

  async getErrorLogs(limit: number) {
    return this.errorRepo.find({ take: limit, order: { createdAt: 'DESC' } });
  }

  async getSequences(projectId?: number) {
    await Promise.resolve(projectId); // satisfy unused
    return [];
  }

  async setCounterValue(id: number, sequence: number) {
    await Promise.resolve(id); // satisfy unused
    await Promise.resolve(sequence);
    throw new BadRequestException(
      'Updating counter by single ID is not supported with composite keys. Use manualOverride.'
    );
  }

  async manualOverride(dto: any, userId: number) {
    return this.manualOverrideService.applyOverride(dto, userId);
  }
  async voidAndReplace(dto: {
    documentNumber: string;
    reason: string;
    replace: boolean;
  }) {
    // 1. Find the audit log for this number to get context
    const lastAudit = await this.auditRepo.findOne({
      where: { generatedNumber: dto.documentNumber },
      order: { createdAt: 'DESC' },
    });

    if (!lastAudit) {
      // If not found in audit, we can't easily regenerate with same context unless passed in dto.
      // For now, log a warning and return error or just log the void decision.
      this.logger.warn(
        `Void request for unknown number: ${dto.documentNumber}`
      );
      // Create a void audit anyway if possible?
      await this.logAudit({
        generatedNumber: dto.documentNumber,
        counterKey: {}, // Unknown
        templateUsed: 'VOID_UNKNOWN',
        context: { userId: 0, ipAddress: '0.0.0.0' }, // System
        isSuccess: true,
        operation: 'VOID',
        status: 'VOID',
        newValue: 'VOIDED',
        metadata: { reason: dto.reason },
      });
      return { status: 'VOIDED_UNKNOWN_CONTEXT' };
    }

    // 2. Log VOID
    await this.logAudit({
      generatedNumber: dto.documentNumber,
      counterKey: lastAudit.counterKey,
      templateUsed: lastAudit.templateUsed,
      context: { userId: 0, ipAddress: '0.0.0.0' }, // TODO: Pass userId from controller
      isSuccess: true,
      operation: 'VOID',
      status: 'VOID',
      oldValue: dto.documentNumber,
      newValue: 'VOIDED',
      metadata: { reason: dto.reason, replace: dto.replace },
    });

    if (dto.replace) {
      // 3. Generate Replacement
      // Parse context from lastAudit.counterKey?
      // GenerateNumberContext needs more than counterKey.
      // But we can reconstruct it.
      let context: GenerateNumberContext;
      try {
        const key =
          typeof lastAudit.counterKey === 'string'
            ? JSON.parse(lastAudit.counterKey)
            : lastAudit.counterKey;

        context = {
          projectId: key.projectId,
          typeId: key.correspondenceTypeId,
          subTypeId: key.subTypeId,
          rfaTypeId: key.rfaTypeId,
          disciplineId: key.disciplineId,
          originatorOrganizationId: key.originatorOrganizationId || 0,
          recipientOrganizationId: key.recipientOrganizationId || 0,
          userId: 0, // System replacement
        };

        const next = await this.generateNextNumber(context);
        return {
          status: 'REPLACED',
          oldNumber: dto.documentNumber,
          newNumber: next.number,
        };
      } catch (e) {
        this.logger.error(`Failed to replace number ${dto.documentNumber}`, e);
        return {
          status: 'VOIDED_REPLACE_FAILED',
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }

    return { status: 'VOIDED' };
  }

  async cancelNumber(dto: {
    documentNumber: string;
    reason: string;
    projectId?: number;
  }) {
    // Similar to VOID but status CANCELLED
    const lastAudit = await this.auditRepo.findOne({
      where: { generatedNumber: dto.documentNumber },
      order: { createdAt: 'DESC' },
    });

    const contextKey = lastAudit?.counterKey;

    await this.logAudit({
      generatedNumber: dto.documentNumber,
      counterKey: contextKey || {},
      templateUsed: lastAudit?.templateUsed || 'CANCEL',
      context: {
        userId: 0,
        ipAddress: '0.0.0.0',
        projectId: dto.projectId || 0,
      },
      isSuccess: true,
      operation: 'CANCEL',
      status: 'CANCELLED',
      metadata: { reason: dto.reason },
    });

    return { status: 'CANCELLED' };
  }

  async bulkImport(items: any[]) {
    const results = { success: 0, failed: 0, errors: [] as string[] };

    // items expected to be ManualOverrideDto[] or similar
    // Actually bulk import usually means "Here is a list of EXISTING numbers used in legacy system"
    // So we should parse them and update counters if they are higher.

    // Implementation: For each item, likely delegate to ManualOverrideService if it fits schema.
    // Or if items is just a number of CSV rows?
    // Assuming items is parsed CSV rows.

    for (const item of items) {
      try {
        // Adapt item to ManualOverrideDto
        /*
          CSV columns: ProjectID, TypeID, OriginatorID, RecipientID, LastNumber
        */
        if (item.newLastNumber && item.correspondenceTypeId) {
          await this.manualOverrideService.applyOverride(item, 0); // 0 = System
          results.success++;
        }
      } catch (e) {
        results.failed++;
        results.errors.push(
          `Failed item ${JSON.stringify(item)}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    return results;
  }

  private async logAudit(data: any): Promise<DocumentNumberAudit> {
    const audit = this.auditRepo.create({
      ...data,
      projectId: data.context.projectId,
      createdBy: data.context.userId,
      ipAddress: data.context.ipAddress,
      // map other fields
    });
    return (await this.auditRepo.save(audit)) as unknown as DocumentNumberAudit;
  }

  private async logError(error: any, ctx: any, operation: string) {
    try {
      const errEntity = this.errorRepo.create({
        errorMessage: error.message || 'Unknown Error',
        errorType: error.name || 'GENERATE_ERROR', // Simple mapping
        contextData: {
          // Mapped from context
          ...ctx,
          operation,
          inputPayload: JSON.stringify(ctx),
        },
      });
      await this.errorRepo.save(errEntity);
    } catch (e) {
      this.logger.error('Failed to log error to DB', e);
    }
  }
}
