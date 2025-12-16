# Document Numbering Implementation Guide

---
title: 'Implementation Guide: Document Numbering System'
version: 1.6.1
status: draft
owner: Development Team
last_updated: 2025-12-16
related:

- specs/01-requirements/03.11-document-numbering.md
- specs/04-operations/document-numbering-operations.md

---

## Overview

เอกสารนี้อธิบาย implementation details สำหรับระบบ Document Numbering ตาม requirements ใน [03.11-document-numbering.md](file:///e:/np-dms/lcbp3/specs/01-requirements/03.11-document-numbering.md)

## Technology Stack

- **Backend Framework**: NestJS 10.x
- **ORM**: TypeORM 0.3.x
- **Database**: MariaDB 11.8
- **Cache/Lock**: Redis 7.x + Redlock
- **Message Queue**: BullMQ
- **Monitoring**: Prometheus + Grafana

## 1. Database Implementation

### 1.1. Counter Table Schema

```sql
CREATE TABLE document_number_formats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  correspondence_type_id INT NULL, -- NULL indicates default format for the project
  format_template VARCHAR(100) NOT NULL,
  reset_sequence_yearly TINYINT(1) DEFAULT 1,
  description VARCHAR(255),
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

  UNIQUE KEY idx_unique_project_type (project_id, correspondence_type_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE CASCADE
);

CREATE TABLE document_number_counters (
  project_id INT NOT NULL,
  originator_organization_id INT NOT NULL,
  recipient_organization_id INT NULL,
  correspondence_type_id INT NOT NULL,
  sub_type_id INT DEFAULT 0,
  rfa_type_id INT DEFAULT 0,
  discipline_id INT DEFAULT 0,
  current_year INT NOT NULL,
  version INT DEFAULT 0 NOT NULL,
  last_number INT DEFAULT 0,

  PRIMARY KEY (
    project_id,
    originator_organization_id,
    COALESCE(recipient_organization_id, 0),
    correspondence_type_id,
    sub_type_id,
    rfa_type_id,
    discipline_id,
    current_year
  ),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (originator_organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE CASCADE,

  INDEX idx_counter_lookup (project_id, correspondence_type_id, current_year),
  INDEX idx_counter_org (originator_organization_id, current_year),

  CONSTRAINT chk_last_number_positive CHECK (last_number >= 0),
  CONSTRAINT chk_current_year_valid CHECK (current_year BETWEEN 2020 AND 2100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='ตารางเก็บ Running Number Counters';
```

### 1.2. Audit Table Schema

```sql
CREATE TABLE document_number_audit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NULL COMMENT 'FK to documents (NULL initially, updated after doc creation)',
  generated_number VARCHAR(100) NOT NULL,
  counter_key JSON NOT NULL COMMENT 'Counter key used (JSON format)',
  template_used VARCHAR(200) NOT NULL,
  user_id INT NULL COMMENT 'FK to users (Allow NULL for system generation)',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_success BOOLEAN DEFAULT TRUE COMMENT 'Track success/failure status',

  -- Performance & Error Tracking
  retry_count INT DEFAULT 0,
  lock_wait_ms INT COMMENT 'Lock acquisition time in milliseconds',
  total_duration_ms INT COMMENT 'Total generation time',
  fallback_used ENUM('NONE', 'DB_LOCK', 'RETRY') DEFAULT 'NONE',

  INDEX idx_document_id (document_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB COMMENT='Document Number Generation Audit Trail';
```

### 1.3. Error Log Table

```sql
CREATE TABLE document_number_errors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  error_type ENUM(
    'LOCK_TIMEOUT',
    'VERSION_CONFLICT',
    'DB_ERROR',
    'REDIS_ERROR',
    'VALIDATION_ERROR'
  ) NOT NULL,
  error_message TEXT,
  stack_trace TEXT,
  context_data JSON COMMENT 'Request context (user, project, etc.)',
  user_id INT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,

  INDEX idx_error_type (error_type),
  INDEX idx_created_at (created_at),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB COMMENT='Document Numbering Error Log';
```

## 2. NestJS Implementation

### 2.1. Module Structure

```
src/modules/document-numbering/
├── document-numbering.module.ts
├── controllers/
│   └── document-numbering.controller.ts
├── services/
│   ├── document-numbering.service.ts
│   ├── document-numbering-lock.service.ts
│   ├── counter.service.ts
│   ├── template.service.ts
│   └── audit.service.ts
├── entities/
│   ├── document-number-counter.entity.ts
│   ├── document-number-audit.entity.ts
│   └── document-number-error.entity.ts
├── dto/
│   ├── generate-number.dto.ts
│   └── update-template.dto.ts
├── validators/
│   └── template.validator.ts
├── jobs/
│   └── counter-reset.job.ts
└── metrics/
    └── metrics.service.ts
```

### 2.2. Number Generation Process

#### 2.2.1. Resolve Format Template:
  * Query document_number_formats by project_id + type_id.
  * If no result, query by project_id + NULL (Default Project Format).
  * If still no result, apply System Default Template: `{ORG}-{RECIPIENT}-{SEQ:4}-{YEAR:BE}`.
  * Determine resetSequenceYearly flag from the found format (default: true)

#### 2.2.2. Determine Counter Key:
  * If resetSequenceYearly is True: Use Current Year (e.g., 2025).
  * If resetSequenceYearly is False: Use 0 (Continuous).
  * Use type_id from the resolved format (Specific ID or NULL).

#### 2.2.3. Generate Number:
  * Use format template to generate number.
  * Replace tokens with actual values:
    * {PROJECT} -> Project Code
    * {ORG} -> Originator Organization Code
    * {RECIPIENT} -> Recipient Organization Code
    * {TYPE} -> Type Code
    * {YEAR} -> Current Year
    * {SEQ} -> Sequence Number
    * {REV} -> Revision Number

#### 2.2.4. Validate Number:
  * Check if generated number is unique.
  * If not unique, increment sequence and retry.

#### 2.2.5. Update Counter:
  * Update document_number_counters with new sequence.

#### 2.2.6. Generate Audit Record:
  * Create audit record with:
    * Generated number
    * Counter key used
    * Template used
    * User ID
    * IP Address
    * User Agent

#### 2.2.7. Return Generated Number:
  * Return generated number to caller.

### 2.3. TypeORM Entity

```typescript
// File: src/modules/document-numbering/entities/document-number-counter.entity.ts
import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('document_number_counters')
export class DocumentNumberCounter {
  @PrimaryColumn({ name: 'project_id' })
  projectId: number;

  @PrimaryColumn({ name: 'originator_organization_id' })
  originatorOrganizationId: number;

  @PrimaryColumn({ name: 'recipient_organization_id', nullable: true })
  recipientOrganizationId: number | null;

  @PrimaryColumn({ name: 'correspondence_type_id' })
  correspondenceTypeId: number;

  @PrimaryColumn({ name: 'sub_type_id', default: 0 })
  subTypeId: number;

  @PrimaryColumn({ name: 'rfa_type_id', default: 0 })
  rfaTypeId: number;

  @PrimaryColumn({ name: 'discipline_id', default: 0 })
  disciplineId: number;

  @PrimaryColumn({ name: 'current_year' })
  currentYear: number;

  @VersionColumn({ name: 'version' })
  version: number;

  @Column({ name: 'last_number', default: 0 })
  lastNumber: number;
}
```

### 2.4. Redis Lock Service

```typescript
// File: src/modules/document-numbering/services/document-numbering-lock.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Redlock from 'redlock';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

interface CounterKey {
  projectId: number;
  originatorOrgId: number;
  recipientOrgId: number | null;
  correspondenceTypeId: number;
  subTypeId: number;
  rfaTypeId: number;
  disciplineId: number;
  year: number;
}

@Injectable()
export class DocumentNumberingLockService {
  private readonly logger = new Logger(DocumentNumberingLockService.name);
  private redlock: Redlock;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 5,
      retryDelay: 100,
      retryJitter: 50,
    });
  }

  async acquireLock(counterKey: CounterKey): Promise<Redlock.Lock> {
    const lockKey = this.buildLockKey(counterKey);
    const ttl = 5000; // 5 วินาที

    try {
      const lock = await this.redlock.acquire([lockKey], ttl);
      this.logger.debug(`Acquired lock: ${lockKey}`);
      return lock;
    } catch (error) {
      this.logger.error(`Failed to acquire lock: ${lockKey}`, error);
      throw error;
    }
  }

  async releaseLock(lock: Redlock.Lock): Promise<void> {
    try {
      await lock.release();
      this.logger.debug('Released lock');
    } catch (error) {
      this.logger.warn('Failed to release lock (may have expired)', error);
    }
  }

  private buildLockKey(key: CounterKey): string {
    return `lock:docnum:${key.projectId}:${key.originatorOrgId}:` +
           `${key.recipientOrgId ?? 0}:${key.correspondenceTypeId}:` +
           `${key.subTypeId}:${key.rfaTypeId}:${key.disciplineId}:${key.year}`;
  }
}
```

### 2.4. Counter Service

```typescript
// File: src/modules/document-numbering/services/counter.service.ts
import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DocumentNumberCounter } from '../entities/document-number-counter.entity';
import { OptimisticLockVersionMismatchError } from 'typeorm';

@Injectable()
export class CounterService {
  private readonly logger = new Logger(CounterService.name);

  constructor(
    @InjectRepository(DocumentNumberCounter)
    private counterRepo: Repository<DocumentNumberCounter>,
    private dataSource: DataSource,
  ) {}

  async incrementCounter(counterKey: CounterKey): Promise<number> {
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          // ใช้ Optimistic Locking
          const counter = await manager.findOne(DocumentNumberCounter, {
            where: this.buildWhereClause(counterKey),
          });

          if (!counter) {
            // สร้าง counter ใหม่
            const newCounter = manager.create(DocumentNumberCounter, {
              ...counterKey,
              lastNumber: 1,
              version: 0,
            });
            await manager.save(newCounter);
            return 1;
          }

          counter.lastNumber += 1;
          await manager.save(counter); // Auto-check version
          return counter.lastNumber;
        });
      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          this.logger.warn(
            `Version conflict, retry ${attempt + 1}/${MAX_RETRIES}`,
          );
          if (attempt === MAX_RETRIES - 1) {
            throw new ConflictException('เลขที่เอกสารถูกเปลี่ยน กรุณาลองใหม่');
          }
          continue;
        }
        throw error;
      }
    }
  }

  private buildWhereClause(key: CounterKey) {
    return {
      projectId: key.projectId,
      originatorOrganizationId: key.originatorOrgId,
      recipientOrganizationId: key.recipientOrgId,
      correspondenceTypeId: key.correspondenceTypeId,
      subTypeId: key.subTypeId,
      rfaTypeId: key.rfaTypeId,
      disciplineId: key.disciplineId,
      currentYear: key.year,
    };
  }
}
```

### 2.5. Main Service with Retry Logic

```typescript
// File: src/modules/document-numbering/services/document-numbering.service.ts
import { Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';
import { DocumentNumberingLockService } from './document-numbering-lock.service';
import { CounterService } from './counter.service';
import { AuditService } from './audit.service';
import { RedisConnectionError } from 'ioredis';

@Injectable()
export class DocumentNumberingService {
  private readonly logger = new Logger(DocumentNumberingService.name);

  constructor(
    private lockService: DocumentNumberingLockService,
    private counterService: CounterService,
    private auditService: AuditService,
  ) {}

  async generateDocumentNumber(dto: GenerateNumberDto): Promise<string> {
    const startTime = Date.now();
    let lockWaitMs = 0;
    let retryCount = 0;
    let fallbackUsed = 'NONE';

    try {
      // พยายามใช้ Redis lock ก่อน
      return await this.generateWithRedisLock(dto);
    } catch (error) {
      if (error instanceof RedisConnectionError) {
        // Fallback: ใช้ database lock
        this.logger.warn('Redis unavailable, falling back to DB lock');
        fallbackUsed = 'DB_LOCK';
        return await this.generateWithDbLock(dto);
      }
      throw error;
    } finally {
      // บันทึก audit log
      await this.auditService.logGeneration({
        documentId: dto.documentId,
        counterKey: dto.counterKey,
        lockWaitMs,
        totalDurationMs: Date.now() - startTime,
        fallbackUsed,
        retryCount,
      });
    }
  }

  private async generateWithRedisLock(dto: GenerateNumberDto): Promise<string> {
    const lock = await this.lockService.acquireLock(dto.counterKey);

    try {
      const nextNumber = await this.counterService.incrementCounter(dto.counterKey);
      return this.formatNumber(dto.template, nextNumber, dto.counterKey);
    } finally {
      await this.lockService.releaseLock(lock);
    }
  }

  private async generateWithDbLock(dto: GenerateNumberDto): Promise<string> {
    // ใช้ pessimistic lock
    // Implementation details...
  }

  private formatNumber(template: string, seq: number, key: CounterKey): string {
    // Template formatting logic
    // Example: `คคง.-สคฉ.3-0001-2568`
    return template
      .replace('{SEQ:4}', seq.toString().padStart(4, '0'))
      .replace('{YEAR:B.E.}', (key.year + 543).toString());
      // ... more replacements
  }
}
```

## 3. Template Validation

```typescript
// File: src/modules/document-numbering/validators/template.validator.ts
import { Injectable } from '@nestjs/common';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class TemplateValidator {
  private readonly ALLOWED_TOKENS = [
    'PROJECT', 'ORIGINATOR', 'RECIPIENT', 'CORR_TYPE',
    'SUB_TYPE', 'RFA_TYPE', 'DISCIPLINE', 'SEQ', 'YEAR', 'REV',
  ];

  validate(template: string, correspondenceType: string): ValidationResult {
    const tokens = this.extractTokens(template);
    const errors: string[] = [];

    // ตรวจสอบ Token ที่ไม่รู้จัก
    for (const token of tokens) {
      if (!this.ALLOWED_TOKENS.includes(token.name)) {
        errors.push(`Unknown token: {${token.name}}`);
      }
    }

    // กฎพิเศษสำหรับแต่ละประเภท
    if (correspondenceType === 'RFA') {
      if (!tokens.some((t) => t.name === 'PROJECT')) {
        errors.push('RFA template ต้องมี {PROJECT}');
      }
      if (!tokens.some((t) => t.name === 'DISCIPLINE')) {
        errors.push('RFA template ต้องมี {DISCIPLINE}');
      }
    }

    if (correspondenceType === 'TRANSMITTAL') {
      if (!tokens.some((t) => t.name === 'SUB_TYPE')) {
        errors.push('TRANSMITTAL template ต้องมี {SUB_TYPE}');
      }
    }

    // ทุก template ต้องมี {SEQ}
    if (!tokens.some((t) => t.name.startsWith('SEQ'))) {
      errors.push('Template ต้องมี {SEQ:n}');
    }

    return { valid: errors.length === 0, errors };
  }

  private extractTokens(template: string) {
    const regex = /\{([^}]+)\}/g;
    const tokens: Array<{ name: string; full: string }> = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
      const tokenName = match[1].split(':')[0]; // SEQ:4 → SEQ
      tokens.push({ name: tokenName, full: match[1] });
    }

    return tokens;
  }
}
```

## 4. BullMQ Job for Counter Reset

```typescript
// File: src/modules/document-numbering/jobs/counter-reset.job.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Processor('document-numbering')
@Injectable()
export class CounterResetJob extends WorkerHost {
  private readonly logger = new Logger(CounterResetJob.name);

  @Cron('0 0 1 1 *') // 1 Jan every year at 00:00
  async handleYearlyReset() {
    const newYear = new Date().getFullYear();

    // ไม่ต้อง reset counter เพราะ counter แยกตาม current_year อยู่แล้ว
    // แค่เตรียม counter สำหรับปีใหม่
    this.logger.log(`Year changed to ${newYear}, counters are ready`);

    // สามารถทำ cleanup counter ปีเก่าได้ (optional)
    // await this.cleanupOldCounters(newYear - 5); // เก็บ 5 ปี
  }

  async process() {
    // BullMQ job processing
  }
}
```

## 5. API Controller

```typescript
// File: src/modules/document-numbering/controllers/document-numbering.controller.ts
import { Controller, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Throttle } from '@nestjs/throttler';
import { DocumentNumberingService } from '../services/document-numbering.service';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('document-numbering')
@UseGuards(ThrottlerGuard)
export class DocumentNumberingController {
  constructor(
    private readonly documentNumberingService: DocumentNumberingService,
  ) {}

  @Post('generate')
  @Throttle(10, 60) // 10 requests per 60 seconds
  async generateNumber(@Body() dto: GenerateNumberDto) {
    const number = await this.documentNumberingService.generateDocumentNumber(dto);
    return { documentNumber: number };
  }

  @Put('configs/:configId')
  @Roles('PROJECT_ADMIN')
  async updateTemplate(
    @Param('configId') configId: number,
    @Body() dto: UpdateTemplateDto,
  ) {
    // Update template configuration
  }

  @Post('configs/:configId/reset-counter')
  @Roles('SUPER_ADMIN')
  async resetCounter(
    @Param('configId') configId: number,
    @Body() dto: ResetCounterDto,
  ) {
    // Manual counter reset (requires approval)
  }
}
```

## 6. Module Configuration

```typescript
// File: src/modules/document-numbering/document-numbering.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { DocumentNumberCounter } from './entities/document-number-counter.entity';
import { DocumentNumberAudit } from './entities/document-number-audit.entity';
import { DocumentNumberError } from './entities/document-number-error.entity';
import { DocumentNumberingService } from './services/document-numbering.service';
import { DocumentNumberingLockService } from './services/document-numbering-lock.service';
import { CounterService } from './services/counter.service';
import { AuditService } from './services/audit.service';
import { TemplateValidator } from './validators/template.validator';
import { CounterResetJob } from './jobs/counter-reset.job';
import { DocumentNumberingController } from './controllers/document-numbering.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentNumberCounter,
      DocumentNumberAudit,
      DocumentNumberError,
    ]),
    BullModule.registerQueue({
      name: 'document-numbering',
    }),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10,
    }),
  ],
  controllers: [DocumentNumberingController],
  providers: [
    DocumentNumberingService,
    DocumentNumberingLockService,
    CounterService,
    AuditService,
    TemplateValidator,
    CounterResetJob,
  ],
  exports: [DocumentNumberingService],
})
export class DocumentNumberingModule {}
```

## 7. Environment Configuration

```typescript
// .env.example
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=lcbp3
DB_PASSWORD=
DB_DATABASE=lcbp3_db
DB_POOL_SIZE=20

# Prometheus
PROMETHEUS_PORT=9090
```

## References

- [Requirements](file:///e:/np-dms/lcbp3/specs/01-requirements/03.11-document-numbering.md)
- [Operations Guide](file:///e:/np-dms/lcbp3/specs/04-operations/document-numbering-operations.md)
- [Backend Guidelines](file:///e:/np-dms/lcbp3/specs/03-implementation/backend-guidelines.md)
