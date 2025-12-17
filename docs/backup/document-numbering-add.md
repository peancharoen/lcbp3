# Backend Implementation Guide: Document Numbering

**Version**: 1.0.0
**Last Updated**: 2025-01-16
**Status**: APPROVED
**Related**: [Requirements](../01-requirements/21-document-numbering-requirements.md), [ADR-018](../05-decisions/adr-018-document-numbering.md)

---

## 1. Architecture Overview

### 1.1 Module Structure
```
backend/src/modules/document-numbering/
├── document-numbering.module.ts
├── controllers/
│   ├── numbering.controller.ts
│   ├── numbering-admin.controller.ts
│   └── numbering-metrics.controller.ts
├── services/
│   ├── sequence.service.ts
│   ├── reservation.service.ts
│   ├── manual-override.service.ts
│   ├── void-replace.service.ts
│   ├── format.service.ts
│   ├── metrics.service.ts
│   └── migration.service.ts
├── entities/
│   ├── numbering-config.entity.ts
│   ├── numbering-sequence.entity.ts
│   ├── numbering-audit-log.entity.ts
│   └── numbering-reservation.entity.ts
├── dto/
│   ├── reserve-number.dto.ts
│   ├── confirm-reservation.dto.ts
│   ├── manual-override.dto.ts
│   ├── void-document.dto.ts
│   └── bulk-import.dto.ts
├── guards/
│   └── manual-override.guard.ts
├── decorators/
│   └── audit-numbering.decorator.ts
├── interfaces/
│   └── numbering.interface.ts
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 2. Core Entities

### 2.1 Numbering Configuration
```typescript
// entities/numbering-config.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';

@Entity('document_numbering_configs')
export class NumberingConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  document_type: string;

  @Column({ length: 200 })
  format: string;

  @Column({
    type: 'enum',
    enum: ['GLOBAL', 'PROJECT', 'CONTRACT', 'YEARLY', 'MONTHLY'],
    default: 'GLOBAL'
  })
  scope: string;

  @Column({ default: false })
  allow_manual_override: boolean;

  @Column({ default: 999999 })
  max_value: number;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP'
  })
  updated_at: Date;

  @OneToMany(() => NumberingSequence, sequence => sequence.config)
  sequences: NumberingSequence[];
}
```

### 2.2 Sequence Counter
```typescript
// entities/numbering-sequence.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('document_numbering_sequences')
export class NumberingSequence {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  config_id: number;

  @Column({ length: 50, nullable: true })
  scope_value: string; // project_id, contract_id, year, etc.

  @Column({ default: 0 })
  current_value: number;

  @Column({ type: 'timestamp', nullable: true })
  last_used_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ManyToOne(() => NumberingConfig, config => config.sequences)
  @JoinColumn({ name: 'config_id' })
  config: NumberingConfig;

  // Composite unique constraint
  @Index(['config_id', 'scope_value'], { unique: true })
}
```

### 2.3 Audit Log
```typescript
// entities/numbering-audit-log.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('document_numbering_audit_logs')
export class NumberingAuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: bigint;

  @Column({ length: 50 })
  @Index()
  operation: string; // RESERVE, CONFIRM, CANCEL, MANUAL_OVERRIDE, VOID

  @Column({ length: 50, nullable: true })
  document_type: string;

  @Column({ length: 50, nullable: true })
  @Index()
  document_number: string;

  @Column({ type: 'text', nullable: true })
  old_value: string;

  @Column({ type: 'text', nullable: true })
  new_value: string;

  @Column()
  @Index()
  user_id: number;

  @Column({ length: 45, nullable: true })
  ip_address: string;

  @Column({ length: 500, nullable: true })
  user_agent: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index()
  timestamp: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;
}
```

---

## 3. Core Services

### 3.1 Sequence Service
```typescript
// services/sequence.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Redlock } from 'redlock';
import { NumberingConfig, NumberingSequence } from '../entities';
import { FormatService } from './format.service';

@Injectable()
export class SequenceService {
  private readonly logger = new Logger(SequenceService.name);

  constructor(
    @InjectRepository(NumberingConfig)
    private configRepo: Repository<NumberingConfig>,

    @InjectRepository(NumberingSequence)
    private sequenceRepo: Repository<NumberingSequence>,

    private dataSource: DataSource,
    private redlock: Redlock,
    private formatService: FormatService,
  ) {}

  /**
   * Get next sequence number with distributed locking
   */
  async getNextSequence(
    documentType: string,
    scopeValue?: string,
  ): Promise<string> {
    // 1. Get configuration
    const config = await this.getConfig(documentType);

    // 2. Build lock key
    const lockKey = this.buildLockKey(documentType, scopeValue);

    // 3. Try with Redlock first
    try {
      return await this.getSequenceWithRedlock(config, scopeValue, lockKey);
    } catch (error) {
      if (this.isRedisUnavailable(error)) {
        // Fallback to database-only mode
        this.logger.warn('Redis unavailable, using DB-only mode');
        return await this.getSequenceWithDbLock(config, scopeValue);
      }
      throw error;
    }
  }

  /**
   * Get sequence with Redlock + Database pessimistic lock
   */
  private async getSequenceWithRedlock(
    config: NumberingConfig,
    scopeValue: string,
    lockKey: string,
  ): Promise<string> {
    // Acquire distributed lock
    const lock = await this.redlock.acquire([lockKey], 5000, {
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 100,
    });

    try {
      return await this.dataSource.transaction(async (manager) => {
        // Get or create sequence with pessimistic lock
        let sequence = await manager.findOne(NumberingSequence, {
          where: {
            config_id: config.id,
            scope_value: scopeValue || null,
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!sequence) {
          sequence = await this.createSequence(manager, config, scopeValue);
        }

        // Increment sequence
        const nextValue = await this.incrementSequence(
          manager,
          sequence,
          config,
        );

        // Format number
        return this.formatService.formatNumber(config.format, nextValue, {
          documentType: config.document_type,
          scopeValue,
        });
      });
    } finally {
      // Always release lock
      await lock.release();
    }
  }

  /**
   * Fallback: Database-only locking (no Redis)
   */
  private async getSequenceWithDbLock(
    config: NumberingConfig,
    scopeValue: string,
  ): Promise<string> {
    return await this.dataSource.transaction(async (manager) => {
      let sequence = await manager.findOne(NumberingSequence, {
        where: {
          config_id: config.id,
          scope_value: scopeValue || null,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sequence) {
        sequence = await this.createSequence(manager, config, scopeValue);
      }

      const nextValue = await this.incrementSequence(
        manager,
        sequence,
        config,
      );

      return this.formatService.formatNumber(config.format, nextValue, {
        documentType: config.document_type,
        scopeValue,
      });
    });
  }

  /**
   * Increment sequence, skip cancelled numbers
   */
  private async incrementSequence(
    manager: EntityManager,
    sequence: NumberingSequence,
    config: NumberingConfig,
  ): Promise<number> {
    let nextValue = sequence.current_value + 1;

    // Skip cancelled numbers
    while (await this.isCancelledNumber(manager, config, nextValue)) {
      this.logger.debug(`Skipping cancelled number: ${nextValue}`);
      nextValue++;
    }

    // Check max value
    if (nextValue > config.max_value) {
      throw new SequenceExhaustedError(
        `Sequence exhausted for ${config.document_type}. Max: ${config.max_value}`,
      );
    }

    // Update sequence
    sequence.current_value = nextValue;
    sequence.last_used_at = new Date();
    await manager.save(sequence);

    return nextValue;
  }

  /**
   * Check if number is cancelled
   */
  private async isCancelledNumber(
    manager: EntityManager,
    config: NumberingConfig,
    value: number,
  ): Promise<boolean> {
    const count = await manager.count(NumberingAuditLog, {
      where: {
        document_type: config.document_type,
        operation: 'CANCEL',
        metadata: { sequence_value: value },
      },
    });
    return count > 0;
  }

  /**
   * Create new sequence
   */
  private async createSequence(
    manager: EntityManager,
    config: NumberingConfig,
    scopeValue: string,
  ): Promise<NumberingSequence> {
    const sequence = manager.create(NumberingSequence, {
      config_id: config.id,
      scope_value: scopeValue || null,
      current_value: 0,
    });
    return await manager.save(sequence);
  }

  /**
   * Build lock key for Redlock
   */
  private buildLockKey(documentType: string, scopeValue?: string): string {
    const parts = ['numbering', documentType];
    if (scopeValue) parts.push(scopeValue);
    return parts.join(':');
  }

  /**
   * Check if error is Redis unavailable
   */
  private isRedisUnavailable(error: any): boolean {
    return error.message?.includes('Redis') ||
           error.message?.includes('ECONNREFUSED');
  }

  /**
   * Get configuration (cached)
   */
  @Cacheable({ ttl: 3600, key: 'numbering:config:{documentType}' })
  private async getConfig(documentType: string): Promise<NumberingConfig> {
    const config = await this.configRepo.findOne({
      where: { document_type: documentType },
    });

    if (!config) {
      throw new ConfigNotFoundError(
        `Numbering config not found for ${documentType}`,
      );
    }

    return config;
  }
}
```

---

### 3.2 Reservation Service
```typescript
// services/reservation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { SequenceService } from './sequence.service';
import { AuditService } from './audit.service';

interface Reservation {
  token: string;
  document_number: string;
  document_type: string;
  scope_value?: string;
  expires_at: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);
  private readonly TTL = 300; // 5 minutes

  constructor(
    private redis: Redis,
    private sequenceService: SequenceService,
    private auditService: AuditService,
  ) {}

  /**
   * Reserve a document number
   */
  async reserve(
    documentType: string,
    scopeValue?: string,
    metadata?: Record<string, any>,
  ): Promise<Reservation> {
    // 1. Generate next number
    const documentNumber = await this.sequenceService.getNextSequence(
      documentType,
      scopeValue,
    );

    // 2. Generate reservation token
    const token = uuidv4();

    // 3. Calculate expiry
    const expiresAt = new Date(Date.now() + this.TTL * 1000);

    // 4. Save reservation to Redis
    const reservation: Reservation = {
      token,
      document_number: documentNumber,
      document_type: documentType,
      scope_value: scopeValue,
      expires_at: expiresAt,
      metadata,
    };

    await this.redis.setex(
      `reservation:${token}`,
      this.TTL,
      JSON.stringify(reservation),
    );

    // 5. Audit log
    await this.auditService.log({
      operation: 'RESERVE',
      document_type: documentType,
      document_number: documentNumber,
      metadata: { token, scope_value: scopeValue },
    });

    this.logger.log(`Reserved number: ${documentNumber}, token: ${token}`);

    return reservation;
  }

  /**
   * Confirm reservation
   */
  async confirm(token: string, userId: number): Promise<string> {
    // 1. Get reservation from Redis
    const reservation = await this.getReservation(token);

    if (!reservation) {
      throw new ReservationExpiredError(
        'Reservation not found or expired. Please reserve a new number.',
      );
    }

    // 2. Save to database (via document creation)
    // Note: Actual document creation happens in the calling service

    // 3. Delete reservation from Redis
    await this.redis.del(`reservation:${token}`);

    // 4. Audit log
    await this.auditService.log({
      operation: 'CONFIRM',
      document_type: reservation.document_type,
      document_number: reservation.document_number,
      user_id: userId,
      metadata: { token },
    });

    this.logger.log(`Confirmed reservation: ${reservation.document_number}`);

    return reservation.document_number;
  }

  /**
   * Cancel reservation
   */
  async cancel(token: string, userId: number): Promise<void> {
    const reservation = await this.getReservation(token);

    if (reservation) {
      // Delete reservation
      await this.redis.del(`reservation:${token}`);

      // Audit log
      await this.auditService.log({
        operation: 'CANCEL',
        document_type: reservation.document_type,
        document_number: reservation.document_number,
        user_id: userId,
        metadata: { token },
      });

      this.logger.log(`Cancelled reservation: ${reservation.document_number}`);
    }
  }

  /**
   * Get reservation from Redis
   */
  private async getReservation(token: string): Promise<Reservation | null> {
    const data = await this.redis.get(`reservation:${token}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Cleanup expired reservations (scheduled job)
   */
  @Cron('0 */5 * * * *') // Every 5 minutes
  async cleanupExpired(): Promise<void> {
    const keys = await this.redis.keys('reservation:*');

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl <= 0) {
        await this.redis.del(key);
        this.logger.debug(`Cleaned up expired reservation: ${key}`);
      }
    }
  }
}
```

---

### 3.3 Manual Override Service
```typescript
// services/manual-override.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NumberingConfig, NumberingSequence } from '../entities';
import { FormatService } from './format.service';
import { AuditService } from './audit.service';

@Injectable()
export class ManualOverrideService {
  private readonly logger = new Logger(ManualOverrideService.name);

  constructor(
    @InjectRepository(NumberingConfig)
    private configRepo: Repository<NumberingConfig>,

    @InjectRepository(NumberingSequence)
    private sequenceRepo: Repository<NumberingSequence>,

    private dataSource: DataSource,
    private formatService: FormatService,
    private auditService: AuditService,
  ) {}

  /**
   * Create document with manual number
   */
  async createWithManualNumber(
    documentType: string,
    manualNumber: string,
    userId: number,
    reason: string,
    skipValidation = false,
  ): Promise<void> {
    // 1. Get configuration
    const config = await this.configRepo.findOne({
      where: { document_type: documentType },
    });

    if (!config) {
      throw new ConfigNotFoundError(`Config not found for ${documentType}`);
    }

    if (!config.allow_manual_override) {
      throw new ManualOverrideNotAllowedError(
        `Manual override not allowed for ${documentType}`,
      );
    }

    // 2. Validate
    if (!skipValidation) {
      await this.validate(manualNumber, config);
    }

    // 3. Check duplicate
    const exists = await this.checkDuplicate(manualNumber);
    if (exists) {
      throw new DuplicateNumberError(
        `Number ${manualNumber} already exists`,
      );
    }

    // 4. Update sequence if higher
    await this.updateSequenceIfHigher(
      documentType,
      manualNumber,
      config,
    );

    // 5. Audit log
    await this.auditService.log({
      operation: 'MANUAL_OVERRIDE',
      document_type: documentType,
      document_number: manualNumber,
      user_id: userId,
      metadata: { reason, skip_validation: skipValidation },
    });

    this.logger.log(`Manual override: ${manualNumber} by user ${userId}`);
  }

  /**
   * Validate manual number format
   */
  private async validate(
    manualNumber: string,
    config: NumberingConfig,
  ): Promise<void> {
    const isValid = this.formatService.matchesFormat(
      manualNumber,
      config.format,
    );

    if (!isValid) {
      throw new InvalidFormatError(
        `Number ${manualNumber} does not match format ${config.format}`,
      );
    }
  }

  /**
   * Check if number already exists
   */
  private async checkDuplicate(number: string): Promise<boolean> {
    // Check in your document tables
    // This is a placeholder - implement based on your schema
    const count = await this.dataSource.query(
      `
      SELECT COUNT(*) as count FROM (
        SELECT document_number FROM correspondences WHERE document_number = ?
        UNION ALL
        SELECT document_number FROM rfas WHERE document_number = ?
        UNION ALL
        SELECT document_number FROM drawings WHERE document_number = ?
      ) AS all_docs
      `,
      [number, number, number],
    );

    return count[0].count > 0;
  }

  /**
   * Update sequence counter if manual number is higher
   */
  private async updateSequenceIfHigher(
    documentType: string,
    manualNumber: string,
    config: NumberingConfig,
  ): Promise<void> {
    // Extract sequence value from manual number
    const sequenceValue = this.formatService.extractSequence(
      manualNumber,
      config.format,
    );

    if (!sequenceValue) {
      this.logger.warn(`Could not extract sequence from ${manualNumber}`);
      return;
    }

    // Update sequence if higher
    await this.dataSource.transaction(async (manager) => {
      const sequence = await manager.findOne(NumberingSequence, {
        where: { config_id: config.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (sequence && sequenceValue > sequence.current_value) {
        sequence.current_value = sequenceValue;
        sequence.last_used_at = new Date();
        await manager.save(sequence);

        this.logger.log(
          `Updated sequence for ${documentType} to ${sequenceValue}`,
        );
      }
    });
  }
}
```

---

## 4. Controllers

### 4.1 Main Numbering Controller
```typescript
// controllers/numbering.controller.ts
import {
  Controller, Post, Body, UseGuards,
  HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards';
import { CurrentUser } from '../../common/decorators';
import { ReservationService } from '../services';
import { ReserveNumberDto, ConfirmReservationDto } from '../dto';

@ApiTags('Document Numbering')
@ApiBearerAuth()
@Controller('document-numbering')
@UseGuards(JwtAuthGuard)
export class NumberingController {
  constructor(
    private reservationService: ReservationService,
  ) {}

  @Post('reserve')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reserve a document number' })
  async reserve(
    @Body() dto: ReserveNumberDto,
    @CurrentUser() user: any,
  ) {
    const reservation = await this.reservationService.reserve(
      dto.document_type,
      dto.scope_value,
      dto.metadata,
    );

    return {
      success: true,
      data: reservation,
    };
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a reservation' })
  async confirm(
    @Body() dto: ConfirmReservationDto,
    @CurrentUser() user: any,
  ) {
    const documentNumber = await this.reservationService.confirm(
      dto.token,
      user.id,
    );

    return {
      success: true,
      data: { document_number: documentNumber },
    };
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a reservation' })
  async cancel(
    @Body() dto: ConfirmReservationDto,
    @CurrentUser() user: any,
  ) {
    await this.reservationService.cancel(dto.token, user.id);

    return {
      success: true,
      message: 'Reservation cancelled',
    };
  }
}
```

---

## 5. Integration with Document Creation

### 5.1 Correspondence Example
```typescript
// modules/correspondence/services/correspondence.service.ts
@Injectable()
export class CorrespondenceService {
  constructor(
    private reservationService: ReservationService,
    private dataSource: DataSource,
  ) {}

  async create(dto: CreateCorrespondenceDto, userId: number) {
    // Phase 1: Reserve number
    const { token, document_number } = await this.reservationService.reserve(
      'COR',
      dto.project_id.toString(),
    );

    try {
      // Phase 2: Create document in transaction
      const correspondence = await this.dataSource.transaction(
        async (manager) => {
          // Create correspondence
          const corr = manager.create(Correspondence, {
            document_number,
            ...dto,
            created_by: userId,
          });

          await manager.save(corr);

          // Confirm reservation
          await this.reservationService.confirm(token, userId);

          return corr;
        },
      );

      return correspondence;
    } catch (error) {
      // Phase 2 failed: Cancel reservation
      await this.reservationService.cancel(token, userId);
      throw error;
    }
  }
}
```

---

## 6. Testing

### 6.1 Unit Tests
```typescript
// tests/unit/sequence.service.spec.ts
describe('SequenceService', () => {
  let service: SequenceService;
  let configRepo: Repository<NumberingConfig>;
  let sequenceRepo: Repository<NumberingSequence>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SequenceService,
        { provide: getRepositoryToken(NumberingConfig), useValue: mockRepo },
        { provide: getRepositoryToken(NumberingSequence), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: Redlock, useValue: mockRedlock },
        { provide: FormatService, useValue: mockFormatService },
      ],
    }).compile();

    service = module.get<SequenceService>(SequenceService);
  });

  it('should generate sequential numbers', async () => {
    const num1 = await service.getNextSequence('COR');
    const num2 = await service.getNextSequence('COR');

    expect(extractSeq(num1)).toBe(1);
    expect(extractSeq(num2)).toBe(2);
  });

  it('should skip cancelled numbers', async () => {
    // Mark sequence 2 as cancelled
    await markAsCancelled('COR', 2);

    const num1 = await service.getNextSequence('COR');
    const num2 = await service.getNextSequence('COR');

    expect(extractSeq(num1)).toBe(1);
    expect(extractSeq(num2)).toBe(3); // Skipped 2
  });

  it('should throw on sequence exhausted', async () => {
    await setSequence('COR', 999999); // Max value

    await expect(
      service.getNextSequence('COR')
    ).rejects.toThrow(SequenceExhaustedError);
  });
});
```

### 6.2 Integration Tests
```typescript
// tests/integration/reservation.spec.ts
describe('Reservation Flow (Integration)', () => {
  let app: INestApplication;
  let redis: Redis;

  beforeAll(async () => {
    app = await createTestingApp();
    redis = app.get(Redis);
  });

  it('should complete two-phase commit successfully', async () => {
    // Phase 1: Reserve
    const { body: reserve } = await request(app.getHttpServer())
      .post('/document-numbering/reserve')
      .send({ document_type: 'COR' })
      .expect(201);

    expect(reserve.data.token).toBeDefined();
    expect(reserve.data.document_number).toMatch(/^COR-\d{4}-\d{5}$/);

    // Verify reservation in Redis
    const cached = await redis.get(`reservation:${reserve.data.token}`);
    expect(cached).toBeDefined();

    // Phase 2: Confirm
    const { body: confirm } = await request(app.getHttpServer())
      .post('/document-numbering/confirm')
      .send({ token: reserve.data.token })
      .expect(200);

    expect(confirm.data.document_number).toBe(reserve.data.document_number);

    // Verify reservation deleted
    const deleted = await redis.get(`reservation:${reserve.data.token}`);
    expect(deleted).toBeNull();
  });

  it('should handle cancel gracefully', async () => {
    const { body: reserve } = await request(app.getHttpServer())
      .post('/document-numbering/reserve')
      .send({ document_type: 'COR' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/document-numbering/cancel')
      .send({ token: reserve.data.token })
      .expect(200);

    // Verify reservation deleted
    const deleted = await redis.get(`reservation:${reserve.data.token}`);
    expect(deleted).toBeNull();
  });
});
```

### 6.3 Load Tests
```typescript
// tests/load/concurrency.spec.ts
describe('Concurrency Test', () => {
  it('should handle 1000 concurrent requests without duplicates', async () => {
    const promises = Array.from({ length: 1000 }, (_, i) =>
      request(app.getHttpServer())
        .post('/document-numbering/reserve')
        .send({ document_type: 'COR' })
    );

    const results = await Promise.all(promises);

    // Extract all document numbers
    const numbers = results.map(r => r.body.data.document_number);

    // Check for duplicates
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(1000);

    // Verify sequential
    const sequences = numbers.map(n => extractSeq(n)).sort((a, b) => a - b);
    expect(sequences[0]).toBe(1);
    expect(sequences[999]).toBe(1000);
  });
});
```

---

## 7. Deployment Checklist

### 7.1 Pre-Deployment
- [ ] Run all tests (unit, integration, E2E)
- [ ] Load test (1000 req/s for 5 min)
- [ ] Setup Redis cluster (3 nodes)
- [ ] Run database migrations
- [ ] Configure environment variables
- [ ] Setup monitoring (Prometheus + Grafana)
- [ ] Configure alerts (PagerDuty/Slack)
- [ ] Review security settings
- [ ] Backup database
- [ ] Document rollback procedure

### 7.2 Deployment Steps
1. Deploy Redis cluster to staging
2. Run migrations on staging database
3. Deploy backend service to staging
4. Run smoke tests on staging
5. Load test staging environment
6. Get approval from stakeholders
7. Deploy to production (blue-green deployment)
8. Monitor for 1 hour
9. Gradual rollout (10% → 50% → 100%)

### 7.3 Post-Deployment
- [ ] Verify all metrics green
- [ ] Check error rates (<0.1%)
- [ ] Validate audit logs working
- [ ] Test critical workflows
- [ ] Monitor performance for 24 hours
- [ ] Collect user feedback
- [ ] Schedule retrospective

---

## 8. Monitoring & Observability

### 8.1 Prometheus Metrics
```typescript
// metrics/numbering.metrics.ts
import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, register } from 'prom-client';

@Injectable()
export class NumberingMetrics {
  // Counter: Total numbers generated
  private readonly numbersGenerated = new Counter({
    name: 'numbering_sequences_total',
    help: 'Total document numbers generated',
    labelNames: ['document_type'],
  });

  // Gauge: Current sequence value
  private readonly sequenceValue = new Gauge({
    name: 'numbering_sequence_current',
    help: 'Current sequence value',
    labelNames: ['document_type', 'scope'],
  });

  // Gauge: Sequence utilization (%)
  private readonly sequenceUtilization = new Gauge({
    name: 'numbering_sequence_utilization',
    help: 'Sequence utilization percentage',
    labelNames: ['document_type'],
  });

  // Histogram: Lock wait time
  private readonly lockWaitTime = new Histogram({
    name: 'numbering_lock_wait_seconds',
    help: 'Time spent waiting for lock acquisition',
    labelNames: ['document_type'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  });

  // Counter: Lock failures
  private readonly lockFailures = new Counter({
    name: 'numbering_lock_failures_total',
    help: 'Total lock acquisition failures',
    labelNames: ['document_type', 'reason'],
  });

  // Counter: Manual overrides
  private readonly manualOverrides = new Counter({
    name: 'numbering_manual_overrides_total',
    help: 'Total manual overrides',
    labelNames: ['document_type'],
  });

  incrementNumbersGenerated(documentType: string) {
    this.numbersGenerated.inc({ document_type: documentType });
  }

  setSequenceValue(documentType: string, scope: string, value: number) {
    this.sequenceValue.set({ document_type: documentType, scope }, value);
  }

  setSequenceUtilization(documentType: string, percent: number) {
    this.sequenceUtilization.set({ document_type: documentType }, percent);
  }

  observeLockWaitTime(documentType: string, seconds: number) {
    this.lockWaitTime.observe({ document_type: documentType }, seconds);
  }

  incrementLockFailures(documentType: string, reason: string) {
    this.lockFailures.inc({ document_type: documentType, reason });
  }

  incrementManualOverrides(documentType: string) {
    this.manualOverrides.inc({ document_type: documentType });
  }
}
```

### 8.2 Grafana Dashboard
```json
{
  "dashboard": {
    "title": "Document Numbering",
    "panels": [
      {
        "title": "Numbers Generated per Minute",
        "targets": [
          {
            "expr": "rate(numbering_sequences_total[1m])"
          }
        ]
      },
      {
        "title": "Sequence Utilization",
        "targets": [
          {
            "expr": "numbering_sequence_utilization"
          }
        ],
        "thresholds": [90, 95]
      },
      {
        "title": "Lock Wait Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, numbering_lock_wait_seconds)"
          }
        ]
      },
      {
        "title": "Lock Failures",
        "targets": [
          {
            "expr": "rate(numbering_lock_failures_total[5m])"
          }
        ]
      }
    ]
  }
}
```

### 8.3 Alert Rules
```yaml
# alerts/numbering.yml
groups:
  - name: numbering_alerts
    interval: 30s
    rules:
      # Critical: Sequence >95% used
      - alert: SequenceCritical
        expr: numbering_sequence_utilization > 95
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Sequence {{ $labels.document_type }} >95% used"
          description: "Current: {{ $value }}%. Extend max_value immediately."

      # Warning: Sequence >90% used
      - alert: SequenceWarning
        expr: numbering_sequence_utilization > 90
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Sequence {{ $labels.document_type }} >90% used"
          description: "Current: {{ $value }}%. Plan to extend max_value."

      # Critical: High lock wait time
      - alert: HighLockWaitTime
        expr: histogram_quantile(0.95, numbering_lock_wait_seconds) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Lock wait time >1s (p95)"
          description: "p95: {{ $value }}s. Check Redis cluster health."

      # Critical: Redis down
      - alert: RedisUnavailable
        expr: up{job="redis-numbering"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis cluster unavailable"
          description: "Numbering system using DB-only fallback mode."

      # Warning: High error rate
      - alert: HighErrorRate
        expr: rate(numbering_errors_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in numbering system"
          description: "{{ $value }} errors/sec. Check logs."
```

---

## 9. Troubleshooting Guide

### 9.1 Common Issues

#### Issue 1: Duplicate Numbers Generated
**Symptoms**: Same document number appears twice

**Diagnosis**:
```sql
-- Find duplicates
SELECT document_number, COUNT(*) as count
FROM (
  SELECT document_number FROM correspondences
  UNION ALL
  SELECT document_number FROM rfas
  UNION ALL
  SELECT document_number FROM drawings
) AS all_docs
GROUP BY document_number
HAVING count > 1;
```

**Root Causes**:
- Redis cluster failure during generation
- Database deadlock
- Bug in locking logic

**Resolution**:
1. Identify affected documents
2. Manually reassign one with new number
3. Update audit log
4. Review lock acquisition logs
5. Add additional monitoring

---

#### Issue 2: Sequence Exhausted
**Symptoms**: Error "Sequence exhausted for COR"

**Diagnosis**:
```sql
-- Check current vs max
SELECT
  c.document_type,
  s.current_value,
  c.max_value,
  (s.current_value * 100.0 / c.max_value) as utilization
FROM document_numbering_sequences s
JOIN document_numbering_configs c ON s.config_id = c.id
WHERE s.current_value >= c.max_value * 0.9;
```

**Resolution**:
```sql
-- Extend max_value
UPDATE document_numbering_configs
SET max_value = max_value * 10
WHERE document_type = 'COR';

-- Or reset yearly sequence (if applicable)
UPDATE document_numbering_sequences
SET current_value = 0,
    scope_value = '2026'  -- New year
WHERE config_id = (
  SELECT id FROM document_numbering_configs
  WHERE document_type = 'COR'
);
```

---

#### Issue 3: Lock Timeout
**Symptoms**: "Failed to acquire lock after 3 retries"

**Diagnosis**:
```bash
# Check Redis cluster health
redis-cli --cluster check localhost:7000

# Check lock contention
redis-cli KEYS "numbering:*"
redis-cli GET "numbering:COR:project-1"
```

**Root Causes**:
- High concurrent load
- Redis node down
- Network latency
- Deadlock in database

**Resolution**:
1. Check Redis cluster health
2. Increase lock timeout (5s → 10s)
3. Add more Redis nodes
4. Review database slow queries
5. Implement exponential backoff

---

#### Issue 4: Reservation Expired
**Symptoms**: User gets "Reservation expired" error

**Diagnosis**:
```bash
# Check Redis TTL
redis-cli TTL "reservation:uuid-here"

# List all reservations
redis-cli KEYS "reservation:*"
```

**Root Causes**:
- User took >5 minutes to complete form
- Network issue during confirmation
- Browser closed/refreshed

**Resolution**:
1. Reserve new number
2. Consider increasing TTL (5 min → 10 min)
3. Add progress auto-save
4. Show countdown timer in UI

---

### 9.2 Debug Commands

```bash
# Check sequence status
npm run cli numbering:status COR

# Manually adjust sequence
npm run cli numbering:set COR 1000

# Validate sequence integrity
npm run cli numbering:validate

# Export audit logs
npm run cli numbering:audit-export \
  --start "2025-01-01" \
  --end "2025-01-31" \
  --format csv \
  --output audit.csv

# Simulate load
npm run cli numbering:load-test \
  --type COR \
  --requests 1000 \
  --concurrency 100

# Check for duplicates
npm run cli numbering:check-duplicates
```

---

## 10. Performance Optimization

### 10.1 Database Indexes
```sql
-- Composite index for faster lookups
CREATE INDEX idx_sequence_lookup
ON document_numbering_sequences(config_id, scope_value);

-- Covering index for metrics
CREATE INDEX idx_audit_metrics
ON document_numbering_audit_logs(document_type, timestamp)
INCLUDE (operation, user_id);

-- Index for duplicate checking
CREATE INDEX idx_doc_number
ON correspondences(document_number);

CREATE INDEX idx_doc_number
ON rfas(document_number);

CREATE INDEX idx_doc_number
ON drawings(document_number);
```

### 10.2 Connection Pooling
```typescript
// config/database.config.ts
export default {
  type: 'mariadb',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,

  // Connection pool settings
  extra: {
    connectionLimit: 20,     // Max connections
    queueLimit: 0,           // Unlimited queue
    waitForConnections: true,
    acquireTimeout: 30000,   // 30s timeout
    idleTimeout: 10000,      // 10s idle timeout
    maxIdle: 5,              // Max idle connections
  },
};
```

### 10.3 Redis Optimization
```typescript
// config/redis.config.ts
export default {
  cluster: [
    { host: 'redis-1', port: 6379 },
    { host: 'redis-2', port: 6379 },
    { host: 'redis-3', port: 6379 },
  ],
  options: {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    maxLoadingRetryTime: 10000,
    lazyConnect: false,

    // Connection pool
    maxRedirections: 16,
    retryDelayOnFailover: 100,
    retryDelayOnClusterDown: 300,

    // Performance
    enableOfflineQueue: true,
    connectTimeout: 10000,
    keepAlive: 30000,
  },
};
```

### 10.4 Caching Strategy
```typescript
// Cache configuration
@Cacheable({
  ttl: 3600,  // 1 hour
  key: 'numbering:config:{documentType}',
  compress: true,
})
async getConfig(documentType: string) {
  return await this.configRepo.findOne({
    where: { document_type: documentType },
  });
}

// Cache invalidation
@CacheEvict({
  key: 'numbering:config:{documentType}',
})
async updateConfig(documentType: string, data: any) {
  return await this.configRepo.update(
    { document_type: documentType },
    data,
  );
}
```

---

## 11. Security Considerations

### 11.1 Access Control
```typescript
// guards/manual-override.guard.ts
@Injectable()
export class ManualOverrideGuard implements CanActivate {
  constructor(private caslAbility: CaslAbilityFactory) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check permission
    const ability = this.caslAbility.createForUser(user);

    return ability.can('manual_override', 'DocumentNumber');
  }
}

// Usage
@Post('manual')
@UseGuards(JwtAuthGuard, ManualOverrideGuard)
async manualOverride(@Body() dto: ManualOverrideDto) {
  // Only admins can access this
}
```

### 11.2 Rate Limiting
```typescript
// Apply rate limit to prevent abuse
@Throttle(100, 60)  // 100 requests per minute
@Post('reserve')
async reserve(@Body() dto: ReserveNumberDto) {
  // ...
}
```

### 11.3 Audit Logging
```typescript
// decorators/audit-numbering.decorator.ts
export function AuditNumbering(operation: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      // Log to audit
      await this.auditService.log({
        operation,
        timestamp: new Date(),
        user_id: args[0]?.user?.id,
        metadata: { args },
      });

      return result;
    };

    return descriptor;
  };
}

// Usage
@AuditNumbering('MANUAL_OVERRIDE')
async manualOverride(dto: ManualOverrideDto, user: User) {
  // Automatically logged
}
```

---

## 12. Migration Scripts

### 12.1 Import Legacy Documents
```typescript
// scripts/import-legacy-numbers.ts
import { DataSource } from 'typeorm';
import * as csv from 'csv-parser';
import * as fs from 'fs';

async function importLegacyNumbers() {
  const dataSource = await createDataSource();
  const results = [];

  // Read CSV
  fs.createReadStream('legacy-documents.csv')
    .pipe(csv())
    .on('data', (row) => results.push(row))
    .on('end', async () => {
      console.log(`Found ${results.length} legacy documents`);

      let success = 0;
      let failed = 0;

      for (const row of results) {
        try {
          await dataSource.transaction(async (manager) => {
            // 1. Create document
            await manager.insert('correspondences', {
              document_number: row.document_number,
              title: row.title,
              created_at: row.created_at,
              is_imported: true,
            });

            // 2. Log audit
            await manager.insert('document_numbering_audit_logs', {
              operation: 'MANUAL_OVERRIDE',
              document_type: 'COR',
              document_number: row.document_number,
              metadata: { imported: true, source: 'legacy' },
            });

            success++;
          });
        } catch (error) {
          console.error(`Failed to import ${row.document_number}:`, error);
          failed++;
        }
      }

      console.log(`Import complete: ${success} success, ${failed} failed`);

      // 3. Update sequence counters
      await updateSequenceCounters(dataSource);
    });
}

async function updateSequenceCounters(dataSource: DataSource) {
  const result = await dataSource.query(`
    SELECT MAX(CAST(SUBSTRING_INDEX(document_number, '-', -1) AS UNSIGNED)) as max_seq
    FROM correspondences
    WHERE document_number LIKE 'COR-2025-%'
  `);

  const maxSeq = result[0].max_seq;

  await dataSource.query(`
    UPDATE document_numbering_sequences
    SET current_value = ?
    WHERE config_id = (
      SELECT id FROM document_numbering_configs
      WHERE document_type = 'COR'
    )
  `, [maxSeq]);

  console.log(`Updated COR sequence to ${maxSeq}`);
}

importLegacyNumbers().catch(console.error);
```

---

## 13. CLI Tools

### 13.1 Status Command
```typescript
// cli/commands/numbering-status.command.ts
import { Command, CommandRunner } from 'nest-commander';
import { SequenceService } from '../../modules/document-numbering/services';

@Command({
  name: 'numbering:status',
  arguments: '[documentType]',
  options: { isDefault: false },
})
export class NumberingStatusCommand extends CommandRunner {
  constructor(private sequenceService: SequenceService) {
    super();
  }

  async run(inputs: string[], options: any): Promise<void> {
    const [documentType] = inputs;

    if (documentType) {
      await this.showTypeStatus(documentType);
    } else {
      await this.showAllStatus();
    }
  }

  private async showTypeStatus(documentType: string) {
    const config = await this.sequenceService.getConfig(documentType);
    const sequence = await this.sequenceService.getSequence(documentType);

    console.log(`\n📊 Status for ${documentType}:\n`);
    console.log(`Format:          ${config.format}`);
    console.log(`Current Value:   ${sequence.current_value}`);
    console.log(`Max Value:       ${config.max_value}`);
    console.log(`Utilization:     ${(sequence.current_value / config.max_value * 100).toFixed(2)}%`);
    console.log(`Last Used:       ${sequence.last_used_at}`);
    console.log(`Manual Override: ${config.allow_manual_override ? 'Yes' : 'No'}`);
  }

  private async showAllStatus() {
    const configs = await this.sequenceService.getAllConfigs();

    console.log('\n📊 Document Numbering Status:\n');
    console.table(
      configs.map((c) => ({
        Type: c.document_type,
        Current: c.sequence?.current_value || 0,
        Max: c.max_value,
        'Utilization (%)': ((c.sequence?.current_value || 0) / c.max_value * 100).toFixed(2),
        'Last Used': c.sequence?.last_used_at || 'Never',
      })),
    );
  }
}
```

---

## 14. Best Practices Summary

### 14.1 DO's ✅
- ✅ Always use two-phase commit (reserve + confirm)
- ✅ Implement fallback to DB-only if Redis fails
- ✅ Log every operation to audit trail
- ✅ Monitor sequence utilization (alert at 90%)
- ✅ Test under concurrent load (1000+ req/s)
- ✅ Use pessimistic locking in database
- ✅ Set reasonable TTL for reservations (5 min)
- ✅ Validate manual override format
- ✅ Skip cancelled numbers (never reuse)
- ✅ Implement exponential backoff on retry

### 14.2 DON'Ts ❌
- ❌ Never skip validation for manual override
- ❌ Never reuse cancelled numbers
- ❌ Never trust client-generated numbers
- ❌ Never increase sequence without transaction
- ❌ Never ignore lock acquisition failures
- ❌ Never deploy without load testing
- ❌ Never extend max_value without planning
- ❌ Never modify sequence table directly
- ❌ Never skip audit logging
- ❌ Never assume Redis is always available

---

## 15. Appendix

### 15.1 Error Codes
```typescript
export enum NumberingErrorCode {
  CONFIG_NOT_FOUND = 'NB001',
  SEQUENCE_EXHAUSTED = 'NB002',
  LOCK_TIMEOUT = 'NB003',
  RESERVATION_EXPIRED = 'NB004',
  DUPLICATE_NUMBER = 'NB005',
  INVALID_FORMAT = 'NB006',
  MANUAL_OVERRIDE_NOT_ALLOWED = 'NB007',
  REDIS_UNAVAILABLE = 'NB008',
}
```

### 15.2 Environment Variables
```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_CLUSTER_NODES=redis-1:6379,redis-2:6379,redis-3:6379

# Numbering Configuration
NUMBERING_LOCK_TIMEOUT=5000       # 5 seconds
NUMBERING_RESERVATION_TTL=300     # 5 minutes
NUMBERING_RETRY_ATTEMPTS=3
NUMBERING_RETRY_DELAY=200         # milliseconds

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
```

### 15.3 Useful Queries
```sql
-- Find next available number
SELECT MAX(CAST(SUBSTRING_INDEX(document_number, '-', -1) AS UNSIGNED)) + 1
FROM correspondences
WHERE document_number LIKE 'COR-2025-%';

-- Check for gaps in sequence
SELECT t1.seq + 1 AS gap_start
FROM (
  SELECT CAST(SUBSTRING_INDEX(document_number, '-', -1) AS UNSIGNED) AS seq
  FROM correspondences
  WHERE document_number LIKE 'COR-2025-%'
) t1
LEFT JOIN (
  SELECT CAST(SUBSTRING_INDEX(document_number, '-', -1) AS UNSIGNED) AS seq
  FROM correspondences
  WHERE document_number LIKE 'COR-2025-%'
) t2 ON t1.seq + 1 = t2.seq
WHERE t2.seq IS NULL
ORDER BY gap_start;

-- Audit trail for specific number
SELECT *
FROM document_numbering_audit_logs
WHERE document_number = 'COR-2025-00042'
ORDER BY timestamp DESC;
```

---

**Document Prepared By**: Backend Team
**Last Review**: 2025-01-16
**Next Review**: 2025-04-16
