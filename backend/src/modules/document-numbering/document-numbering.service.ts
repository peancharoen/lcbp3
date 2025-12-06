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
import { Organization } from '../project/entities/organization.entity';
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

    // 1. ดึงข้อมูล Master Data มาเตรียมไว้ (Tokens) นอก Lock เพื่อ Performance
    const tokens = await this.resolveTokens(ctx, year);

    // 2. ดึง Format Template
    const formatTemplate = await this.getFormatTemplate(
      ctx.projectId,
      ctx.typeId
    );

    // 3. สร้าง Resource Key สำหรับ Lock (ละเอียดถึงระดับ Discipline)
    // Key: doc_num:{projectId}:{typeId}:{disciplineId}:{year}
    const resourceKey = `doc_num:${ctx.projectId}:${ctx.typeId}:${disciplineId}:${year}`;
    const lockTtl = 5000; // 5 วินาที

    let lock;
    try {
      // 🔒 LAYER 1: Acquire Redis Lock
      lock = await this.redlock.acquire([resourceKey], lockTtl);

      // 🔄 LAYER 2: Optimistic Lock Loop
      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        try {
          // A. ดึง Counter ปัจจุบัน
          let counter = await this.counterRepo.findOne({
            where: {
              projectId: ctx.projectId,
              originatorId: ctx.originatorId,
              typeId: ctx.typeId,
              disciplineId: disciplineId,
              year: year,
            },
          });

          // B. ถ้ายังไม่มี ให้เริ่มใหม่ที่ 0
          if (!counter) {
            counter = this.counterRepo.create({
              projectId: ctx.projectId,
              originatorId: ctx.originatorId,
              typeId: ctx.typeId,
              disciplineId: disciplineId,
              year: year,
              lastNumber: 0,
            });
          }

          // C. Increment Sequence
          counter.lastNumber += 1;

          // D. Save (TypeORM จะเช็ค version column ตรงนี้)
          await this.counterRepo.save(counter);

          // E. Format Result
          const generatedNumber = this.replaceTokens(
            formatTemplate,
            tokens,
            counter.lastNumber
          );

          // [P0-4] F. Audit Logging
          await this.logAudit({
            generatedNumber,
            counterKey: resourceKey,
            templateUsed: formatTemplate,
            sequenceNumber: counter.lastNumber,
            userId: ctx.userId,
            ipAddress: ctx.ipAddress,
            retryCount: i,
            lockWaitMs: 0, // TODO: calculate actual wait time
          });

          return generatedNumber;
        } catch (err) {
          // ถ้า Version ไม่ตรง (มีคนแทรกได้ในเสี้ยววินาที) ให้ Retry
          if (err instanceof OptimisticLockVersionMismatchError) {
            this.logger.warn(
              `Optimistic Lock Collision for ${resourceKey}. Retrying...`
            );
            continue;
          }
          throw err;
        }
      }

      throw new InternalServerErrorException(
        'Failed to generate document number after retries.'
      );
    } catch (error: any) {
      this.logger.error(`Error generating number for ${resourceKey}`, error);

      // [P0-4] Log error
      await this.logError({
        counterKey: resourceKey,
        errorType: this.classifyError(error),
        errorMessage: error.message,
        stackTrace: error.stack,
        userId: ctx.userId,
        ipAddress: ctx.ipAddress,
        context: ctx,
      }).catch(() => {}); // Don't throw if error logging fails

      throw error;
    } finally {
      // 🔓 Release Lock
      if (lock) {
        await lock.release().catch(() => {});
      }
    }
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

    let disciplineCode = '000';
    if (ctx.disciplineId) {
      const discipline = await this.disciplineRepo.findOne({
        where: { id: ctx.disciplineId },
      });
      if (discipline) disciplineCode = discipline.disciplineCode;
    }

    let subTypeCode = '00';
    let subTypeNumber = '00';
    if (ctx.subTypeId) {
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

    // [P1-4] Resolve recipient organization
    let recipientCode = '';
    if (ctx.recipientOrgId) {
      const recipient = await this.orgRepo.findOne({
        where: { id: ctx.recipientOrgId },
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

  /**
   * Helper: หา Template จาก DB หรือใช้ Default
   */
  private async getFormatTemplate(
    projectId: number,
    typeId: number
  ): Promise<string> {
    const format = await this.formatRepo.findOne({
      where: { projectId, correspondenceTypeId: typeId },
    });
    // Default Fallback Format (ตาม Req 2.1)
    return format ? format.formatTemplate : '{ORG}-{ORG}-{SEQ:4}-{YEAR}';
  }

  /**
   * Helper: แทนที่ Token ใน Template ด้วยค่าจริง
   */
  private replaceTokens(
    template: string,
    tokens: DecodedTokens,
    seq: number
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

    // 2. Replace Sequence Token {SEQ:n} e.g., {SEQ:4} -> 0001
    result = result.replace(/{SEQ(?::(\d+))?}/g, (_, digits) => {
      const padLength = digits ? parseInt(digits, 10) : 4; // Default padding 4
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
      await this.auditRepo.save(auditData);
    } catch (error) {
      this.logger.error('Failed to log audit', error);
      // Don't throw - audit failure shouldn't block number generation
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
}
