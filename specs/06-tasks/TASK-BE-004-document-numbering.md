# Task: Document Numbering Service

**Status:** Not Started
**Priority:** P1 (High - Critical for Documents)
**Estimated Effort:** 5-6 days
**Dependencies:** TASK-BE-001 (Database), TASK-BE-002 (Auth)
**Owner:** Backend Team

---

## 📋 Overview

สร้าง DocumentNumberingService ที่ใช้ Double-Lock mechanism (Redis + DB Optimistic Lock) สำหรับการสร้างเลขที่เอกสารอัตโนมัติ

---

## 🎯 Objectives

- ✅ Template-Based Number Generation
- ✅ Double-Lock Protection (Redis + DB)
- ✅ Concurrent-Safe (No duplicate numbers)
- ✅ Support Disciplines
- ✅ Year-Based Reset

---

## 📝 Acceptance Criteria

1. **Number Generation:**

   - ✅ Generate unique sequential numbers
   - ✅ Support format: `{ORG}-{TYPE}-{DISCIPLINE}-{YEAR}-{SEQ:4}`
   - ✅ No duplicates even with 100+ concurrent requests
   - ✅ Generate within 100ms (p90)

2. **Lock Mechanism:**

   - ✅ Redis lock acquired (TTL: 3 seconds)
   - ✅ DB optimistic lock with version column
   - ✅ Retry on conflict (3 times max)
   - ✅ Exponential backoff

3. **Format Templates:**
   - ✅ Configure per Project/Type
   - ✅ Support all token types
   - ✅ Validate format before use

---

## 🛠️ Implementation Steps

### 1. Entity - Document Number Format

```typescript
// File: backend/src/modules/document-numbering/entities/document-number-format.entity.ts
@Entity('document_number_formats')
export class DocumentNumberFormat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  project_id: number;

  @Column()
  correspondence_type_id: number;

  @Column({ length: 255 })
  format_template: string;
  // Example: '{ORG_CODE}-{TYPE_CODE}-{DISCIPLINE_CODE}-{YEAR}-{SEQ:4}'

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => CorrespondenceType)
  @JoinColumn({ name: 'correspondence_type_id' })
  correspondenceType: CorrespondenceType;
}
```

### 2. Entity - Document Number Counter

```typescript
// File: backend/src/modules/document-numbering/entities/document-number-counter.entity.ts
@Entity('document_number_counters')
export class DocumentNumberCounter {
  @PrimaryColumn()
  project_id: number;

  @PrimaryColumn()
  originator_organization_id: number;

  @PrimaryColumn()
  correspondence_type_id: number;

  @PrimaryColumn({ default: 0 })
  discipline_id: number;

  @PrimaryColumn()
  current_year: number;

  @Column({ default: 0 })
  last_number: number;

  @VersionColumn() // Optimistic Lock
  version: number;

  @UpdateDateColumn()
  updated_at: Date;
}
```

### 3. Numbering Service

```typescript
// File: backend/src/modules/document-numbering/document-numbering.service.ts
import Redlock from 'redlock';

interface NumberingContext {
  projectId: number;
  organizationId: number;
  typeId: number;
  disciplineId?: number;
  year?: number;
}

@Injectable()
export class DocumentNumberingService {
  constructor(
    @InjectRepository(DocumentNumberCounter)
    private counterRepo: Repository<DocumentNumberCounter>,
    @InjectRepository(DocumentNumberFormat)
    private formatRepo: Repository<DocumentNumberFormat>,
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
    @InjectRepository(CorrespondenceType)
    private typeRepo: Repository<CorrespondenceType>,
    @InjectRepository(Discipline)
    private disciplineRepo: Repository<Discipline>,
    private redlock: Redlock,
    private logger: Logger
  ) {}

  async generateNextNumber(context: NumberingContext): Promise<string> {
    const year = context.year || new Date().getFullYear();
    const disciplineId = context.disciplineId || 0;

    // Build Redis lock key
    const lockKey = this.buildLockKey(
      context.projectId,
      context.organizationId,
      context.typeId,
      disciplineId,
      year
    );

    // Retry logic with exponential backoff
    return this.retryWithBackoff(
      async () =>
        await this.generateNumberWithLock(lockKey, context, year, disciplineId),
      3,
      200
    );
  }

  private async generateNumberWithLock(
    lockKey: string,
    context: NumberingContext,
    year: number,
    disciplineId: number
  ): Promise<string> {
    // Step 1: Acquire Redis lock
    const lock = await this.redlock.acquire([lockKey], 3000); // 3 sec TTL

    try {
      // Step 2: Get or create counter
      let counter = await this.counterRepo.findOne({
        where: {
          project_id: context.projectId,
          originator_organization_id: context.organizationId,
          correspondence_type_id: context.typeId,
          discipline_id: disciplineId,
          current_year: year,
        },
      });

      if (!counter) {
        // Initialize new counter
        counter = this.counterRepo.create({
          project_id: context.projectId,
          originator_organization_id: context.organizationId,
          correspondence_type_id: context.typeId,
          discipline_id: disciplineId,
          current_year: year,
          last_number: 0,
          version: 0,
        });
        await this.counterRepo.save(counter);
      }

      const currentVersion = counter.version;
      const nextNumber = counter.last_number + 1;

      // Step 3: Update counter with Optimistic Lock
      const result = await this.counterRepo
        .createQueryBuilder()
        .update(DocumentNumberCounter)
        .set({
          last_number: nextNumber,
        })
        .where({
          project_id: context.projectId,
          originator_organization_id: context.organizationId,
          correspondence_type_id: context.typeId,
          discipline_id: disciplineId,
          current_year: year,
          version: currentVersion, // Optimistic lock check
        })
        .execute();

      if (result.affected === 0) {
        throw new ConflictException('Counter version conflict - retrying...');
      }

      // Step 4: Format number
      const formattedNumber = await this.formatNumber({
        projectId: context.projectId,
        typeId: context.typeId,
        organizationId: context.organizationId,
        disciplineId,
        year,
        sequenceNumber: nextNumber,
      });

      this.logger.log(`Generated number: ${formattedNumber}`);
      return formattedNumber;
    } finally {
      // Step 5: Release lock
      await lock.release();
    }
  }

  private async formatNumber(data: any): Promise<string> {
    // Get format template
    const format = await this.formatRepo.findOne({
      where: {
        project_id: data.projectId,
        correspondence_type_id: data.typeId,
      },
    });

    if (!format) {
      throw new NotFoundException('Document number format not found');
    }

    // Parse and replace tokens
    let result = format.format_template;

    const tokens = await this.buildTokens(data);
    for (const [token, value] of Object.entries(tokens)) {
      result = result.replace(token, value);
    }

    return result;
  }

  private async buildTokens(data: any): Promise<Record<string, string>> {
    const org = await this.orgRepo.findOne({
      where: { id: data.organizationId },
    });
    const type = await this.typeRepo.findOne({ where: { id: data.typeId } });
    let discipline = null;

    if (data.disciplineId > 0) {
      discipline = await this.disciplineRepo.findOne({
        where: { id: data.disciplineId },
      });
    }

    return {
      '{ORG_CODE}': org?.organization_code || 'ORG',
      '{TYPE_CODE}': type?.type_code || 'TYPE',
      '{DISCIPLINE_CODE}': discipline?.discipline_code || 'GEN',
      '{YEAR}': data.year.toString(),
      '{SEQ:4}': data.sequenceNumber.toString().padStart(4, '0'),
      '{SEQ:5}': data.sequenceNumber.toString().padStart(5, '0'),
    };
  }

  private buildLockKey(...parts: Array<number | string>): string {
    return `doc_num:${parts.join(':')}`;
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    initialDelay: number
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (!(error instanceof ConflictException) || attempt === maxRetries) {
          throw error;
        }

        lastError = error;
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        this.logger.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      }
    }

    throw lastError;
  }
}
```

### 4. Module

```typescript
// File: backend/src/modules/document-numbering/document-numbering.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentNumberCounter,
      DocumentNumberFormat,
      Organization,
      CorrespondenceType,
      Discipline,
    ]),
    RedisModule,
  ],
  providers: [DocumentNumberingService],
  exports: [DocumentNumberingService],
})
export class DocumentNumberingModule {}
```

---

## ✅ Testing & Verification

### 1. Concurrent Test

```typescript
describe('DocumentNumberingService - Concurrency', () => {
  it('should generate 100 unique numbers concurrently', async () => {
    const context = {
      projectId: 1,
      organizationId: 3,
      typeId: 1,
      disciplineId: 2,
      year: 2025,
    };

    const promises = Array(100)
      .fill(null)
      .map(() => service.generateNextNumber(context));

    const results = await Promise.all(promises);

    // Check uniqueness
    const unique = new Set(results);
    expect(unique.size).toBe(100);

    // Check format
    results.forEach((num) => {
      expect(num).toMatch(/^TEAM-RFA-STR-2025-\d{4}$/);
    });
  });

  it('should handle Redis lock timeout', async () => {
    // Mock Redis lock to always timeout
    jest.spyOn(redlock, 'acquire').mockRejectedValue(new Error('Lock timeout'));

    await expect(service.generateNextNumber(context)).rejects.toThrow();
  });

  it('should retry on version conflict', async () => {
    // Simulate conflict on first attempt
    let attempt = 0;
    jest.spyOn(counterRepo, 'createQueryBuilder').mockImplementation(() => {
      attempt++;
      return {
        update: () => ({
          set: () => ({
            where: () => ({
              execute: async () => ({
                affected: attempt === 1 ? 0 : 1, // Fail first, succeed second
              }),
            }),
          }),
        }),
      } as any;
    });

    const result = await service.generateNextNumber(context);
    expect(result).toBeDefined();
    expect(attempt).toBe(2);
  });
});
```

### 2. Load Test

```yaml
# artillery.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 30
      arrivalRate: 20 # 20 req/sec

scenarios:
  - name: 'Generate Document Numbers'
    flow:
      - post:
          url: '/correspondences'
          json:
            title: 'Load Test {{ $randomString() }}'
            project_id: 1
            type_id: 1
            discipline_id: 2
```

---

## 📚 Related Documents

- [ADR-002: Document Numbering Strategy](../05-decisions/ADR-002-document-numbering-strategy.md)
- [Backend Guidelines - Document Numbering](../03-implementation/backend-guidelines.md#document-numbering)

---

## 📦 Deliverables

- [ ] DocumentNumberingService
- [ ] DocumentNumberCounter Entity
- [ ] DocumentNumberFormat Entity
- [ ] Format Template Parser
- [ ] Redis Lock Integration
- [ ] Retry Logic with Backoff
- [ ] Unit Tests (90% coverage)
- [ ] Concurrent Tests
- [ ] Load Tests
- [ ] Documentation

---

## 🚨 Risks & Mitigation

| Risk                    | Impact | Mitigation                        |
| ----------------------- | ------ | --------------------------------- |
| Redis lock failure      | High   | Retry + DB fallback               |
| Version conflicts       | Medium | Exponential backoff retry         |
| Lock timeout            | Medium | Increase TTL, optimize queries    |
| Performance degradation | High   | Redis caching, connection pooling |

---

## 📌 Notes

- Redis lock TTL: 3 seconds
- Max retries: 3
- Exponential backoff: 200ms → 400ms → 800ms
- Format template stored in database (configurable)
- Counters reset automatically per year
