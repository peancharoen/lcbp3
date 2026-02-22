# Task: Document Numbering Service

**Status:** Ready for Implementation
**Priority:** P1 (High - Critical for Documents)
**Estimated Effort:** 7-8 days
**Dependencies:** TASK-BE-001 (Database), TASK-BE-002 (Auth), TASK-BE-003 (Redis Setup)
**Owner:** Backend Team

---

## 📋 Overview

สร้าง DocumentNumberingService ที่ใช้ Double-Lock mechanism (Redis + DB Optimistic Lock) สำหรับการสร้างเลขที่เอกสารอัตโนมัติ ตาม requirements ใน [03.11-document-numbering.md](file:///e:/np-dms/lcbp3/specs/01-requirements/03.11-document-numbering.md)

### เอกสารอ้างอิง

- **Requirements**: [03.11-document-numbering.md](file:///e:/np-dms/lcbp3/specs/01-requirements/03.11-document-numbering.md)
- **Implementation Guide**: [document-numbering.md](file:///e:/np-dms/lcbp3/specs/03-implementation/document-numbering.md)
- **Operations Guide**: [document-numbering-operations.md](file:///e:/np-dms/lcbp3/specs/04-operations/document-numbering-operations.md)

---

## 🎯 Objectives

- ✅ Template-Based Number Generation (รองรับ 10 token types)
- ✅ Double-Lock Protection (Redis Redlock + DB Optimistic Lock)
- ✅ Concurrent-Safe (No duplicate numbers, tested with 100+ concurrent requests)
- ✅ Support All Document Types (LETTER, RFA, TRANSMITTAL, RFI, MEMO, etc.)
- ✅ Year-Based Auto Reset (ปี ค.ศ.)
- ✅ 4 Error Scenarios with Fallback Strategies
- ✅ Comprehensive Audit Logging
- ✅ Monitoring & Alerting (Prometheus + Grafana)
- ✅ Rate Limiting & Security

---

## 📝 Acceptance Criteria

### 1. Number Generation

- ✅ Generate unique sequential numbers
- ✅ Support all 10 token types: `{PROJECT}`, `{ORIGINATOR}`, `{RECIPIENT}`, `{CORR_TYPE}`, `{SUB_TYPE}`, `{RFA_TYPE}`, `{DISCIPLINE}`, `{SEQ:n}`, `{YEAR:B.E.}`, `{YEAR:A.D.}`, `{REV}`
- ✅ No duplicates even with 100+ concurrent requests
- ✅ Performance: <500ms (normal), <2s (p95), <5s (p99)

### 2. Lock Mechanism

- ✅ Redis Redlock distributed lock (TTL: 5 seconds)
- ✅ DB optimistic lock with `version` column
- ✅ Fallback to DB pessimistic lock when Redis unavailable
- ✅ Retry with exponential backoff (5 retries max for lock, 2 for version conflict, 3 for DB errors)

### 3. Document Types Support & Scoping

- ✅ **General Correspondence** (LETTER / MEMO / etc.) → **Project Level Scope**
  - Counter Key: `(project_id, originator_org_id, recipient_org_id, corr_type_id, 0, 0, 0, year)`
  - *Note*: Templates separate per Project. `{PROJECT}` token is optional in format but counter is partitioned by Project.

- ✅ **Transmittal** → **Project Level Scope** with Sub-Type lookup
  - Counter Key: `(project_id, originator_org_id, recipient_org_id, corr_type_id, sub_type_id, 0, 0, year)`

- ✅ **RFA** → **Contract Level Scope** (Implicit)
  - Counter Key: `(project_id, originator_org_id, NULL, corr_type_id, 0, rfa_type_id, discipline_id, year)`
  - *Mechanism*: `rfa_type_id` and `discipline_id` are linked to specific Contracts in the DB. Different contracts have different Type IDs, ensuring separate counters.

### 4. Error Handling

- ✅ Scenario 1: Redis Unavailable → Fallback to DB pessimistic lock
- ✅ Scenario 2: Lock Timeout → Retry 5x with exponential backoff
- ✅ Scenario 3: Version Conflict → Retry 2x immediately
- ✅ Scenario 4: DB Connection Error → Retry 3x with exponential backoff

### 5. Audit & Monitoring

- ✅ Audit log for every generated number (with performance metrics)
- ✅ Error logging with classification (LOCK_TIMEOUT, VERSION_CONFLICT, etc.)
- ✅ Prometheus metrics collection
- ✅ Alerting on failures >5%

### 6. Security

- ✅ Rate limiting: 10 req/min per user, 50 req/min per IP (using @nestjs/throttler)
- ✅ Authorization checks (JWT + Roles)
- ✅ IP address logging

---

## 🛠️ Implementation Steps

### Step 1: Database Entities

// File: backend/src/modules/document-numbering/entities/document-number-format.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from '../../project/entities/project.entity';
import { CorrespondenceType } from '../../correspondence-type/entities/correspondence-type.entity';

@Entity('document_number_formats')
export class DocumentNumberFormat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  project_id: number;

  @Column({ name: 'correspondence_type_id' })
  correspondenceTypeId: number;

  // Note: Schema currently only has project_id + correspondence_type_id.
  // If we need sub_type/discipline specific templates, we might need schema update or use JSON config.
  // For now, aligning with lcbp3-v1.5.1-schema.sql which has format_template column.

  @Column({ name: 'format_template', length: 255, comment: 'e.g. {PROJECT}-{ORIGINATOR}-{CORR_TYPE}-{SEQ:4}' })
  formatTemplate: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => CorrespondenceType)
  @JoinColumn({ name: 'correspondence_type_id' })
  correspondenceType: CorrespondenceType;
}

#### 1.2 Document Number Counter Entity

```typescript
// File: backend/src/modules/document-numbering/entities/document-number-counter.entity.ts

import { Entity, PrimaryColumn, Column, UpdateDateColumn, VersionColumn } from 'typeorm';

/**
 * ตาราง document_number_counters
 * Composite PK: (project_id, originator_organization_id, recipient_organization_id,
 *                correspondence_type_id, sub_type_id, rfa_type_id, discipline_id, current_year)
 *
 * References: specs/01-requirements/03.11-document-numbering.md#counter-key-components
 */
@Entity('document_number_counters')
export class DocumentNumberCounter {
  @PrimaryColumn({ name: 'project_id' })
  projectId: number;

  @PrimaryColumn({ name: 'originator_organization_id' })
  originatorOrganizationId: number;

  @PrimaryColumn({ name: 'recipient_organization_id', default: -1 })
  recipientOrganizationId: number; // -1 if NULL (standardized for composite key)

  @PrimaryColumn({ name: 'correspondence_type_id' })
  correspondenceTypeId: number;

  @PrimaryColumn({ name: 'sub_type_id', default: 0 })
  subTypeId: number;  // for TRANSMITTAL only

  @PrimaryColumn({ name: 'rfa_type_id', default: 0 })
  rfaTypeId: number;  // for RFA only

  @PrimaryColumn({ name: 'discipline_id', default: 0 })
  disciplineId: number;  // for RFA only

  @PrimaryColumn({ name: 'current_year' })
  currentYear: number;  // ปี ค.ศ.

  @Column({ name: 'last_number', default: 0 })
  lastNumber: number;

  @VersionColumn({ name: 'version', comment: 'Optimistic Lock version' })
  version: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

> **⚠️ หมายเหตุ Schema:**
>
> - Primary Key ใช้ `recipient_organization_id = -1` แทน NULL (ตาม Schema v1.5.1)
> - `sub_type_id`, `rfa_type_id`, `discipline_id` ใช้ `0` แทน NULL
> - Counter reset อัตโนมัติทุกปี (แยก counter ตาม `current_year`)

#### 1.3 Document Number Audit Entity

```typescript
// File: backend/src/modules/document-numbering/entities/document-number-audit.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('document_number_audit')
export class DocumentNumberAudit {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ nullable: true, comment: 'FK to documents (set after doc creation)' })
  document_id: number;

  @Column({ length: 255 })
  @Index('idx_audit_number')
  generated_number: string;

  @Column({ length: 500, comment: 'Redis lock key used' })
  counter_key: string;

  @Column({ length: 255 })
  template_used: string;

  @Column()
  sequence_number: number;

  @Column()
  user_id: number;

  @Column({ length: 45, nullable: true })
  ip_address: string;

  @Column({ default: 0 })
  retry_count: number;

  @Column({ default: 0, comment: 'Time spent waiting for lock in ms' })
  lock_wait_ms: number;

  @CreateDateColumn()
  @Index('idx_audit_created')
  created_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

---

### Step 2: DTOs

#### 2.1 Generate Number Request DTO

```typescript
// File: backend/src/modules/document-numbering/dto/generate-number.dto.ts

import { IsInt, IsOptional, IsEnum, IsIP, Min } from 'class-validator';

export enum RecipientType {
  OWNER = 'OWNER',
  CONTRACTOR = 'CONTRACTOR',
  CONSULTANT = 'CONSULTANT',
  OTHER = 'OTHER',
}

export class GenerateNumberDto {
  @IsInt()
  @Min(1)
  projectId: number;

  @IsInt()
  @Min(1)
  docTypeId: number;

  @IsInt()
  @IsOptional()
  subTypeId?: number;

  @IsInt()
  @IsOptional()
  disciplineId?: number;

  @IsEnum(RecipientType)
  @IsOptional()
  recipientType?: RecipientType;

  @IsInt()
  @IsOptional()
  year?: number;

  @IsInt()
  @Min(1)
  userId: number;

  @IsIP()
  ipAddress: string;
}
```

---

### Step 3: Core Service Implementation

```typescript
// File: backend/src/modules/document-numbering/document-numbering.service.ts

import { Injectable, Logger, ConflictException, ServiceUnavailableException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Redlock from 'redlock';
import Redis from 'ioredis';
import { DocumentNumberCounter } from './entities/document-number-counter.entity';
import { DocumentNumberFormat } from './entities/document-number-format.entity';
import { DocumentNumberAudit } from './entities/document-number-audit.entity';
import { GenerateNumberDto } from './dto/generate-number.dto';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class DocumentNumberingService {
  private readonly logger = new Logger(DocumentNumberingService.name);

  constructor(
    @InjectRepository(DocumentNumberCounter)
    private counterRepo: Repository<DocumentNumberCounter>,
    @InjectRepository(DocumentNumberFormat)
    private formatRepo: Repository<DocumentNumberFormat>,
    @InjectRepository(DocumentNumberAudit)
    private auditRepo: Repository<DocumentNumberAudit>,
    private dataSource: DataSource,
    private redis: Redis,
    private redlock: Redlock,
    private metricsService: MetricsService,
  ) {}

  /**
   * สร้างเลขที่เอกสารใหม่
   * รองรับ 4 error scenarios:
   * 1. Redis unavailable → Fallback to DB lock
   * 2. Lock timeout → Retry 5x with exponential backoff
   * 3. Version conflict → Retry 2x
   * 4. DB connection error → Retry 3x
   */
  async generateNextNumber(dto: GenerateNumberDto): Promise<string> {
    const startTime = Date.now();
    const year = dto.year || new Date().getFullYear() + 543; // พ.ศ. by default
    const subTypeId = dto.subTypeId || 0;  // Fallback for NULL
    const disciplineId = dto.disciplineId || 0;  // Fallback for NULL

    const lockKey = this.buildLockKey(
      dto.projectId,
      dto.docTypeId,
      subTypeId,
      disciplineId,
      dto.recipientType,
      year,
    );

    try {
      // Retry with exponential backoff for Scenarios 2, 3, 4
      const result = await this.retryWithBackoff(
        async () => await this.generateNumberWithLock(
          lockKey,
          dto,
          year,
          subTypeId,
          disciplineId,
          startTime,
        ),
        5, // Max 5 retries for lock acquisition
        1000, // Initial delay 1s
      );

      // Track metrics
      const duration = Date.now() - startTime;
      await this.metricsService.recordDuration('docnum.generate', duration);
      await this.metricsService.incrementCounter('docnum.success');

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.metricsService.recordDuration('docnum.generate', duration);
      await this.metricsService.incrementCounter('docnum.error', {
        type: error.constructor.name,
      });
      throw error;
    }
  }

  /**
   * สร้างเลขที่พร้อม Redis lock
   * Scenario 1: ถ้า Redis unavailable จะ fallback ไป DB lock
   */
  private async generateNumberWithLock(
    lockKey: string,
    dto: GenerateNumberDto,
    year: number,
    subTypeId: number,
    disciplineId: number,
    startTime: number,
  ): Promise<string> {
    let lock: any;
    const lockStartTime = Date.now();

    try {
      // Step 1: Acquire Redis Distributed Lock
      try {
        lock = await this.redlock.acquire([lockKey], 5000); // 5 sec TTL
        await this.metricsService.incrementCounter('docnum.lock.redis.success');
      } catch (redisError) {
        // Scenario 1: Redis Unavailable - Fallback to DB lock
        this.logger.warn(`Redis lock failed, falling back to DB lock: ${redisError.message}`);
        await this.metricsService.incrementCounter('docnum.lock.redis.failed');
        return await this.generateWithDatabaseLock(dto, year, subTypeId, disciplineId);
      }

      const lockWaitMs = Date.now() - lockStartTime;
      await this.metricsService.recordDuration('docnum.lock.wait', lockWaitMs);

      // Step 2: Get or create counter
      let counter = await this.counterRepo.findOne({
        where: {
          project_id: dto.projectId,
          doc_type_id: dto.docTypeId,
          sub_type_id: subTypeId,
          discipline_id: disciplineId,
          recipient_type: dto.recipientType || null,
          year: year,
        },
      });

      if (!counter) {
        counter = this.counterRepo.create({
          project_id: dto.projectId,
          doc_type_id: dto.docTypeId,
          sub_type_id: subTypeId,
          discipline_id: disciplineId,
          recipient_type: dto.recipientType || null,
          year: year,
          last_number: 0,
          version: 0,
        });
        await this.counterRepo.save(counter);
      }

      const currentVersion = counter.version;
      const nextNumber = counter.last_number + 1;

      // Step 3: Update counter with Optimistic Lock (Scenario 3 handling)
      const result = await this.counterRepo
        .createQueryBuilder()
        .update(DocumentNumberCounter)
        .set({
          last_number: nextNumber,
          version: () => 'version + 1',
        })
        .where({
          project_id: dto.projectId,
          doc_type_id: dto.docTypeId,
          sub_type_id: subTypeId,
          discipline_id: disciplineId,
          recipient_type: dto.recipientType || null,
          year: year,
          version: currentVersion, // Optimistic lock check
        })
        .execute();

      if (result.affected === 0) {
        // Scenario 3: Version Conflict
        await this.metricsService.incrementCounter('docnum.conflict.version');
        throw new ConflictException('Counter version conflict - retrying...');
      }

      // Step 4: Get config and format number
      const config = await this.getConfig(dto.projectId, dto.docTypeId);
      const formattedNumber = await this.formatNumber(config.formatTemplate, {
        projectId: dto.projectId,
        docTypeId: dto.docTypeId,
        subTypeId,
        disciplineId,
        year,
        sequenceNumber: nextNumber,
        recipientType: dto.recipientType,
      });

      // Step 5: Audit logging
      await this.auditRepo.save({
        document_id: null, // Will be updated after document creation
        generated_number: formattedNumber,
        counter_key: lockKey,
        template_used: config.template,
        sequence_number: nextNumber,
        user_id: dto.userId,
        ip_address: dto.ipAddress,
        retry_count: 0,
        lock_wait_ms: lockWaitMs,
      });

      this.logger.log(`Generated: ${formattedNumber} (lock wait: ${lockWaitMs}ms, total: ${Date.now() - startTime}ms)`);
      return formattedNumber;

    } finally {
      // Step 6: Release Redis lock
      if (lock) {
        try {
          await lock.release();
        } catch (error) {
          this.logger.warn(`Failed to release lock: ${error.message}`);
        }
      }
    }
  }

  /**
   * Scenario 1: Fallback to Database Pessimistic Lock
   */
  private async generateWithDatabaseLock(
    dto: GenerateNumberDto,
    year: number,
    subTypeId: number,
    disciplineId: number,
  ): Promise<string> {
    return await this.dataSource.transaction(async (manager) => {
      // Pessimistic lock: SELECT ... FOR UPDATE
      const counter = await manager
        .createQueryBuilder(DocumentNumberCounter, 'counter')
        .setLock('pessimistic_write')
        .where({
          project_id: dto.projectId,
          doc_type_id: dto.docTypeId,
          sub_type_id: subTypeId,
          discipline_id: disciplineId,
          recipient_type: dto.recipientType || null,
          year: year,
        })
        .getOne();

      const nextNumber = (counter?.last_number || 0) + 1;

      // Update or create counter
      if (counter) {
        await manager.update(DocumentNumberCounter, {
          project_id: dto.projectId,
          doc_type_id: dto.docTypeId,
          sub_type_id: subTypeId,
          discipline_id: disciplineId,
          recipient_type: dto.recipientType || null,
          year: year,
        }, {
          last_number: nextNumber,
        });
      } else {
        await manager.save(DocumentNumberCounter, {
          project_id: dto.projectId,
          doc_type_id: dto.docTypeId,
          sub_type_id: subTypeId,
          discipline_id: disciplineId,
          recipient_type: dto.recipientType || null,
          year: year,
          last_number: nextNumber,
          version: 0,
        });
      }

      // Format number
      const config = await this.getConfig(dto.projectId, dto.docTypeId);
      const formattedNumber = await this.formatNumber(config.formatTemplate, {
        projectId: dto.projectId,
        docTypeId: dto.docTypeId,
        subTypeId,
        disciplineId,
        year,
        sequenceNumber: nextNumber,
        recipientType: dto.recipientType,
      });

      // Audit log
      await manager.save(DocumentNumberAudit, {
        generated_number: formattedNumber,
        counter_key: `db_lock:${dto.projectId}:${dto.docTypeId}`,
        template_used: config.formatTemplate,
        sequence_number: nextNumber,
        user_id: dto.userId,
        ip_address: dto.ipAddress,
        retry_count: 0,
        lock_wait_ms: 0,
      });

      await this.metricsService.incrementCounter('docnum.lock.db.fallback');
      return formattedNumber;
    });
  }

  /**
   * Format number ด้วย template และ token replacement
   * รองรับ token ทั้งหมด 9 ประเภท
   */
  private async formatNumber(template: string, data: any): Promise<string> {
    const tokens = {
      '{PROJECT}': await this.getProjectCode(data.projectId),
      '{ORIGINATOR}': await this.getOriginatorOrgCode(data.originatorOrganizationId),
      '{RECIPIENT}': await this.getRecipientOrgCode(data.recipientOrganizationId),
      '{CORR_TYPE}': await this.getTypeCode(data.docTypeId),
      '{SUB_TYPE}': await this.getSubTypeCode(data.subTypeId),
      '{DISCIPLINE}': await this.getDisciplineCode(data.disciplineId),
      '{CATEGORY}': await this.getCategoryCode(data.categoryId),
      '{SEQ:4}': data.sequenceNumber.toString().padStart(4, '0'),
      '{SEQ:5}': data.sequenceNumber.toString().padStart(5, '0'),
      '{YEAR:B.E.}': data.year.toString(),
      '{YEAR:A.D.}': (data.year - 543).toString(),
      '{REV}': data.revisionCode || 'A',
    };

    let result = template;
    for (const [token, value] of Object.entries(tokens)) {
      result = result.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Retry with exponential backoff
   * Scenarios 2, 3, 4
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    initialDelay: number,
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const isRetryable =
          error instanceof ConflictException || // Scenario 3
          error.code === 'ECONNREFUSED' ||      // Scenario 4
          error.code === 'ETIMEDOUT' ||         // Scenario 4
          error.message?.includes('Lock timeout'); // Scenario 2

        if (!isRetryable || attempt === maxRetries) {
          if (attempt === maxRetries) {
            // Scenario 2: Max retries reached
            throw new ServiceUnavailableException(
              'ระบบกำลังยุ่ง กรุณาลองใหม่ภายหลัง'
            );
          }
          throw error;
        }

        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        this.logger.warn(
          `Retry ${attempt + 1}/${maxRetries} after ${delay}ms (${error.message})`
        );
        await this.metricsService.incrementCounter('docnum.retry', {
          attempt: attempt + 1,
          reason: error.constructor.name,
        });
      }
    }

    throw new InternalServerErrorException('Unexpected retry loop exit');
  }

  /**
   * Get configuration template (Format)
   */
  private async getConfig(
    projectId: number,
    correspondenceTypeId: number,
  ): Promise<DocumentNumberFormat> {
    // Note: Schema currently only separates by project_id and correspondence_type_id
    // If we need sub-type specific templates, we should check if they are supported in the future schema.
    // Converting old logic slightly to match v1.5.1 schema columns.

    const config = await this.formatRepo.findOne({
      where: {
        project_id: projectId,
        correspondenceTypeId: correspondenceTypeId,
      },
    });

    if (!config) {
      throw new NotFoundException(
        `Document number format not found for project=${projectId}, type=${correspondenceTypeId}`
      );
    }

    return config;
  }

  /**
   * Token helper methods
   */
  private async getProjectCode(projectId: number): Promise<string> {
    // TODO: Fetch from ProjectRepository
    return 'LCBP3';
  }

  private async getOrgCode(organizationId: number): Promise<string> {
    // TODO: Fetch from OrganizationRepository
    return 'C2';
  }

  private async getTypeCode(docTypeId: number): Promise<string> {
    // TODO: Fetch from DocumentTypeRepository
    return 'RFI';
  }

  private async getSubTypeCode(subTypeId: number): Promise<string> {
    if (subTypeId === 0) return '';
    // TODO: Fetch from SubTypeRepository
    return '21';
  }

  private async getDisciplineCode(disciplineId: number): Promise<string> {
    if (disciplineId === 0) return 'GEN';
    // TODO: Fetch from DisciplineRepository
    return 'STR';
  }

  private async getCategoryCode(categoryId: number): Promise<string> {
    if (!categoryId) return '';
    // TODO: Fetch from CategoryRepository
    return 'DRW';
  }

  private buildLockKey(...parts: Array<number | string | null | undefined>): string {
    return `doc_num:${parts.filter(p => p !== null && p !== undefined).join(':')}`;
  }
}
```

---

### Step 4: Controller with Rate Limiting

```typescript
// File: backend/src/modules/document-numbering/document-numbering.controller.ts

import { Controller, Post, Get, Put, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentNumberingService } from './document-numbering.service';
import { GenerateNumberDto } from './dto/generate-number.dto';
import { Request } from 'express';

@ApiTags('Document Numbering')
@Controller('api/v1/document-numbering')
@UseGuards(JwtAuthGuard, RateLimitGuard)
@ApiBearerAuth()
export class DocumentNumberingController {
  constructor(private readonly numberingService: DocumentNumberingService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate document number' })
  @ApiResponse({ status: 201, description: 'Number generated successfully' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  @ApiResponse({ status: 503, description: 'Service unavailable' })
  async generateNumber(
    @Body() dto: GenerateNumberDto,
    @Req() req: Request,
  ): Promise<{ documentNumber: string }> {
    // Add user context from JWT
    const user = req.user as any;
    dto.userId = user.id;
    dto.ipAddress = req.ip;

    const documentNumber = await this.numberingService.generateNextNumber(dto);
    return { documentNumber };
  }

  @Get('configs')
  @ApiOperation({ summary: 'List all numbering configurations' })
  @Roles('admin', 'project_admin')
  @UseGuards(RolesGuard)
  async listConfigs() {
    // TODO: Implement
    return { message: 'List configs' };
  }

  @Put('configs/:id')
  @ApiOperation({ summary: 'Update numbering configuration' })
  @Roles('project_admin')
  @UseGuards(RolesGuard)
  async updateConfig(@Param('id') id: number, @Body() updateDto: any) {
    // TODO: Implement with template validation
    return { message: 'Update config' };
  }

  @Post('configs/:id/reset-counter')
  @ApiOperation({ summary: 'Reset counter (Super Admin only)' })
  @Roles('super_admin')
  @UseGuards(RolesGuard)
  async resetCounter(@Param('id') id: number) {
    // TODO: Implement with audit logging
    return { message: 'Reset counter' };
  }
}
```

---

### Step 5: Rate Limiting Guard

```typescript
// File: backend/src/modules/common/guards/rate-limit.guard.ts

import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private redis: Redis,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ip = request.ip;

    // Rate limit per user: 10 requests/minute
    if (user) {
      const userKey = `rate_limit:user:${user.id}`;
      const userCount = await this.redis.incr(userKey);

      if (userCount === 1) {
        await this.redis.expire(userKey, 60); // 1 minute
      }

      if (userCount > 10) {
        throw new HttpException(
          'Rate limit exceeded: 10 requests per minute per user',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Rate limit per IP: 50 requests/minute
    const ipKey = `rate_limit:ip:${ip}`;
    const ipCount = await this.redis.incr(ipKey);

    if (ipCount === 1) {
      await this.redis.expire(ipKey, 60);
    }

    if (ipCount > 50) {
      throw new HttpException(
        'Rate limit exceeded: 50 requests per minute per IP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
```

---

### Step 6: Module

```typescript
// File: backend/src/modules/document-numbering/document-numbering.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentNumberingService } from './document-numbering.service';
import { DocumentNumberingController } from './document-numbering.controller';
import { DocumentNumberCounter } from './entities/document-number-counter.entity';
import { DocumentNumberConfig } from './entities/document-number-config.entity';
import { DocumentNumberAudit } from './entities/document-number-audit.entity';
import { RedisModule } from '../redis/redis.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentNumberCounter,
      DocumentNumberConfig,
      DocumentNumberAudit,
    ]),
    RedisModule,
    MetricsModule,
  ],
  controllers: [DocumentNumberingController],
  providers: [DocumentNumberingService],
  exports: [DocumentNumberingService],
})
export class DocumentNumberingModule {}
```

---

## ✅ Testing & Verification

### Test 1: Concurrent Number Generation

```typescript
// File: backend/test/document-numbering/concurrent.spec.ts

describe('DocumentNumberingService - Concurrency', () => {
  let service: DocumentNumberingService;
  let counterRepo: Repository<DocumentNumberCounter>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DocumentNumberingModule],
    }).compile();

    service = module.get<DocumentNumberingService>(DocumentNumberingService);
    counterRepo = module.get(getRepositoryToken(DocumentNumberCounter));
  });

  it('should generate 100 unique numbers concurrently', async () => {
    const dto: GenerateNumberDto = {
      projectId: 1,
      docTypeId: 2, // RFA
      disciplineId: 3, // STR
      year: 2568,
      userId: 1,
      ipAddress: '192.168.1.1',
    };

    const promises = Array(100)
      .fill(null)
      .map(() => service.generateNextNumber(dto));

    const results = await Promise.all(promises);

    // Check uniqueness
    const unique = new Set(results);
    expect(unique.size).toBe(100);

    // Check format
    results.forEach(num => {
      expect(num).toMatch(/^LCBP3-C2-RFI-STR-\d{4}-A$/);
    });

    // Verify counter in DB
    const counter = await counterRepo.findOne({
      where: {
        project_id: 1,
        doc_type_id: 2,
        discipline_id: 3,
        year: 2568,
      },
    });
    expect(counter.last_number).toBe(100);
  });
});
```

### Test 2: Error Scenarios

```typescript
// File: backend/test/document-numbering/error-scenarios.spec.ts

describe('DocumentNumberingService - Error Scenarios', () => {
  it('Scenario 1: Should fallback to DB lock when Redis unavailable', async () => {
    jest.spyOn(redlock, 'acquire').mockRejectedValue(new Error('Redis connection error'));

    const result = await service.generateNextNumber(dto);

    expect(result).toBeDefined();
    expect(result).toMatch(/^LCBP3-/);
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('falling back to DB lock'));
    expect(metricsService.incrementCounter).toHaveBeenCalledWith('docnum.lock.db.fallback');
  });

  it('Scenario 2: Should retry on lock timeout and throw 503 after max retries', async () => {
    jest.spyOn(redlock, 'acquire').mockRejectedValue(new Error('Lock timeout'));

    await expect(service.generateNextNumber(dto))
      .rejects
      .toThrow(ServiceUnavailableException);

    expect(metricsService.incrementCounter).toHaveBeenCalledWith('docnum.retry', expect.any(Object));
  });

  it('Scenario 3: Should retry on version conflict and succeed', async () => {
    let attempt = 0;
    jest.spyOn(counterRepo, 'createQueryBuilder').mockImplementation(() => {
      attempt++;
      return {
        update: () => ({
          set: () => ({
            where: () => ({
              execute: async () => ({
                affected: attempt === 1 ? 0 : 1,
              }),
            }),
          }),
        }),
      } as any;
    });

    const result = await service.generateNextNumber(dto);
    expect(result).toBeDefined();
    expect(attempt).toBe(2);
    expect(metricsService.incrementCounter).toHaveBeenCalledWith('docnum.conflict.version');
  });

  it('Scenario 4: Should retry on DB connection error', async () => {
    let attempt = 0;
    jest.spyOn(counterRepo, 'findOne').mockImplementation(async () => {
      attempt++;
      if (attempt === 1) {
        const error: any = new Error('DB connection timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      }
      return mockCounter;
    });

    const result = await service.generateNextNumber(dto);
    expect(result).toBeDefined();
    expect(attempt).toBe(2);
  });
});
```

### Test 3: Document Type Formats

```typescript
// File: backend/test/document-numbering/formats.spec.ts

describe('DocumentNumberingService - Formats', () => {
  it('should format Correspondence correctly', async () => {
    const result = await service.generateNextNumber({
      projectId: 1,
      docTypeId: 1, // Correspondence
      subTypeId: 3, // Letter
      year: 2568,
      userId: 1,
      ipAddress: '192.168.1.1',
    });

    expect(result).toMatch(/^คคง\.-สคฉ\.3-0985-2568$/);
  });

  it('should format Transmittal To Owner correctly', async () => {
    const result = await service.generateNextNumber({
      projectId: 1,
      docTypeId: 3, // Transmittal
      recipientType: 'OWNER',
      year: 2568,
      userId: 1,
      ipAddress: '192.168.1.1',
    });

    expect(result).toMatch(/^คคง\.-สคฉ\.3-03-21-\d{4}-2568$/);
  });

  it('should format RFA correctly', async () => {
    const result = await service.generateNextNumber({
      projectId: 1,
      docTypeId: 2, // RFA
      disciplineId: 3, // STR
      year: 2568,
      userId: 1,
      ipAddress: '192.168.1.1',
    });

    expect(result).toMatch(/^LCBP3-C2-RFI-STR-\d{4}-A$/);
  });

  it('should format Drawing correctly', async () => {
    const result = await service.generateNextNumber({
      projectId: 1,
      docTypeId: 4, // Drawing
      disciplineId: 3, // STR
      categoryId: 1, // DRW
      year: 2568,
      userId: 1,
      ipAddress: '192.168.1.1',
    });

    expect(result).toMatch(/^LCBP3-STR-DRW-\d{4}-A$/);
  });
});
```

### Test 4: Rate Limiting

```typescript
// File: backend/test/document-numbering/rate-limit.spec.ts

describe('RateLimitGuard', () => {
  it('should block after 10 requests per user per minute', async () => {
    const dto = { /* ... */ };

    // Make 10 successful requests
    for (let i = 0; i < 10; i++) {
      await service.generateNextNumber(dto);
    }

    // 11th request should fail
    await expect(service.generateNextNumber(dto))
      .rejects
      .toThrow('Rate limit exceeded');
  });

  it('should block after 50 requests per IP per minute', async () => {
    // Test similar to above but with different users from same IP
    // ...
  });
});
```

### Load Test

```yaml
# File: artillery.yml

config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 50
      name: 'Normal Load (50 req/sec)'
    - duration: 30
      arrivalRate: 100
      name: 'Peak Load (100 req/sec)'

scenarios:
  - name: 'Generate Document Numbers - RFA'
    weight: 40
    flow:
      - post:
          url: '/api/v1/rfa'
          headers:
            Authorization: 'Bearer {{ $processEnvironment.TEST_JWT }}'
          json:
            title: 'Load Test RFA {{ $randomString() }}'
            project_id: 1
            doc_type_id: 2
            discipline_id: 3

  - name: 'Generate Document Numbers - Transmittal'
    weight: 30
    flow:
      - post:
          url: '/api/v1/transmittals'
          headers:
            Authorization: 'Bearer {{ $processEnvironment.TEST_JWT }}'
          json:
            title: 'Load Test Transmittal {{ $randomString() }}'
            project_id: 1
            doc_type_id: 3
            recipient_type: 'OWNER'

  - name: 'Generate Document Numbers - Correspondence'
    weight: 30
    flow:
      - post:
          url: '/api/v1/correspondences'
          headers:
            Authorization: 'Bearer {{ $processEnvironment.TEST_JWT }}'
          json:
            title: 'Load Test Correspondence {{ $randomString() }}'
            project_id: 1
            doc_type_id: 1

expect:
  - statusCode: [200, 201]
  - contentType: json

ensure:
  p50: 500   # 50th percentile < 500ms
  p95: 2000  # 95th percentile < 2s
  p99: 5000  # 99th percentile < 5s
  maxErrorRate: 0.001  # < 0.1% errors
```

---

## 📚 Related Documents

- [ADR-002: Document Numbering Strategy](../05-decisions/ADR-002-document-numbering-strategy.md)
- [Requirements 3.11: Document Numbering](../01-requirements/03.11-document-numbering.md)
- [Backend Guidelines - Document Numbering](../03-implementation/backend-guidelines.md#document-numbering)
- [Data Dictionary](../../docs/4_Data_Dictionary_V1_4_4.md)

---

## 📦 Deliverables

### Core Implementation

- [x] DocumentNumberingService with all 4 error scenarios
- [x] DocumentNumberCounter Entity (with sub_type_id, recipient_type)
- [x] DocumentNumberConfig Entity
- [x] DocumentNumberAudit Entity
- [x] Format Template Parser (9 token types)
- [x] Redis Lock Integration with Fallback
- [x] Retry Logic with Exponential Backoff

### API & Security

- [x] DocumentNumberingController with 4 endpoints
- [x] Rate Limiting Guard (10/min per user, 50/min per IP)
- [x] Authorization Guards
- [x] API Documentation (Swagger)

### Testing

- [x] Unit Tests (targeting 90%+ coverage)
- [x] Concurrent Tests (100+ simultaneous requests)
- [x] Error Scenario Tests (all 4 scenarios)
- [x] Format Tests (all 4 document types)
- [x] Rate Limiting Tests
- [x] Load Tests (Artillery config for 50-100 req/sec)

### Monitoring & Documentation

- [x] Metrics Collection Integration
- [x] Audit Logging
- [x] Implementation Documentation
- [x] API Documentation

---

## 🚨 Risks & Mitigation

| Risk                              | Impact | Probability | Mitigation                                    |
| --------------------------------- | ------ | ----------- | --------------------------------------------- |
| Redis lock failure                | High   | Low         | Automatic fallback to DB lock                 |
| Version conflicts under high load | Medium | Medium      | Exponential backoff retry (2x)                |
| Lock timeout                      | Medium | Low         | Retry 5x with exponential backoff             |
| Performance degradation           | High   | Medium      | Redis caching, connection pooling, monitoring |
| DB connection pool exhaustion     | High   | Low         | Retry 3x, increase pool size, monitoring      |
| Rate limit bypass                 | Medium | Low         | Multi-layer limiting (user + IP + global)     |

---

## 📌 Implementation Notes

### Performance Targets

- **Normal Operation:** <500ms (no conflicts, Redis available)
- **95th Percentile:** <2 seconds (including retries)
- **99th Percentile:** <5 seconds (worst case scenarios)

### Lock Configuration

- **Redis Lock TTL:** 5 seconds (auto-release)
- **Lock Acquisition Timeout:** 10 seconds
- **Max Retries (Lock):** 5 times with exponential backoff (1s, 2s, 4s, 8s, 16s)
- **Max Retries (Version):** 2 times
- **Max Retries (DB Error):** 3 times with exponential backoff (1s, 2s, 4s)

### Rate Limiting

- **Per User:** 10 requests/minute
- **Per IP:** 50 requests/minute
- **Global:** 5000 requests/minute

### Format Templates

Stored in database (`document_number_configs` table), configurable per:

- Project
- Document Type
- Sub Type (optional, use 0 for fallback)
- Discipline (optional, use 0 for fallback)

### Counter Reset

- Automatic reset per year (based on `{YEAR:B.E.}` or `{YEAR:A.D.}` in template)
- Manual reset available (Super Admin only, with audit log)

---

## 🔄 Version History

| Version | Date       | Changes                                                                                                                                                    |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2025-11-30 | Initial task definition                                                                                                                                    |
| 2.0     | 2025-12-02 | Comprehensive update with all 9 tokens, 4 document types, 4 error scenarios, audit logging, monitoring, rate limiting, and complete implementation details |
