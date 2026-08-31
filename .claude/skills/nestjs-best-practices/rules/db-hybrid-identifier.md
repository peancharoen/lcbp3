---
title: Hybrid Identifier Strategy (ADR-019)
impact: CRITICAL
impactDescription: Use INT PK internally + UUID for public API per project ADR-019
tags: database, uuid, identifier, adr-019, api-design, typeorm
---

## Hybrid Identifier Strategy (ADR-019) — March 2026 Pattern

**This project follows ADR-019: INT Primary Key (internal) + UUIDv7 (public API)**

Unlike standard practices that use UUID as the primary key, this project uses a **hybrid approach** optimized for MariaDB performance and API consistency.

> **Updated pattern (March 2026):** Entities extend `UuidBaseEntity`. The `publicId` column is exposed **directly** in API responses — ห้ามใช้ `@Expose({ name: 'id' })` เพื่อ rename.

### The Strategy

| Layer           | Field      | Type                                | Usage                                             |
| --------------- | ---------- | ----------------------------------- | ------------------------------------------------- |
| **Database PK** | `id`       | `INT AUTO_INCREMENT`                | Internal foreign keys only (marked `@Exclude()`)  |
| **Public API**  | `publicId` | `MariaDB UUID` (native, BINARY(16)) | External references, URLs — exposed as-is         |
| **DTO Input**   | `xxxUuid`  | `string` (UUIDv7)                   | Accept UUID in create/update DTOs                 |
| **DTO Output**  | `publicId` | `string` (UUIDv7)                   | API returns `publicId` field directly (no rename) |

### Why Hybrid IDs?

- **Performance**: INT PK is faster for joins and indexing than UUID
- **Security**: Internal IDs never exposed in API (enumerable IDs are a risk)
- **Compatibility**: UUID works well with distributed systems and external integrations
- **MariaDB Native**: Uses MariaDB's native UUID type (stored as BINARY(16), auto-converts to string)

### Entity Definition (Current Pattern)

```typescript
import { Entity, Column } from 'typeorm';
import { UuidBaseEntity } from '@/common/entities/uuid-base.entity';

@Entity('contracts')
export class Contract extends UuidBaseEntity {
  // publicId (string UUIDv7) + id (INT, @Exclude) สืบทอดจาก UuidBaseEntity
  // API response → { publicId: "019505a1-7c3e-7000-8000-abc123...", contractCode: ..., ... }

  @Column()
  contractCode: string;

  @Column()
  contractName: string;

  @Column({ name: 'project_id' })
  projectId: number; // INT FK — internal, not exposed if marked @Exclude in UuidBaseEntity
}
```

**`UuidBaseEntity` (shared base):**

```typescript
import { PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Exclude } from 'class-transformer';

export abstract class UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude() // ❗ CRITICAL: INT id must never leak to API
  id: number;

  @Column({ type: 'uuid', unique: true, generated: 'uuid' })
  publicId: string; // UUIDv7, exposed as-is

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### DTO Pattern (Accept UUID, Resolve to INT Internally)

```typescript
// dto/create-contract.dto.ts
import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateContractDto {
  @IsNotEmpty()
  @IsUUID('7') // UUIDv7 (MariaDB native)
  projectUuid: string; // Accept UUID from client

  @IsNotEmpty()
  contractCode: string;

  @IsNotEmpty()
  contractName: string;
}

// ❌ NO Response DTO with @Expose rename needed.
// Entity class_transformer via TransformInterceptor will serialize publicId directly.
```

### Service/Controller Pattern

```typescript
@Controller('contracts')
@UseGuards(JwtAuthGuard, CaslAbilityGuard)
export class ContractsController {
  constructor(
    private contractsService: ContractsService,
    private uuidResolver: UuidResolver
  ) {}

  @Post()
  async create(@Body() dto: CreateContractDto) {
    // Resolve UUID → INT PK for FK relationship
    const projectId = await this.uuidResolver.resolveProject(dto.projectUuid);

    const contract = await this.contractsService.create({
      ...dto,
      projectId,
    });

    // Response: TransformInterceptor + @Exclude on id → publicId exposed directly
    return contract;
  }

  @Get(':publicId')
  async findOne(@Param('publicId', ParseUuidPipe) publicId: string) {
    return this.contractsService.findOneByPublicId(publicId);
  }
}
```

### UUID Resolver Helper

```typescript
@Injectable()
export class UuidResolver {
  constructor(
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    @InjectRepository(Contract)
    private contractRepo: Repository<Contract>
  ) {}

  async resolveProject(publicId: string): Promise<number> {
    const project = await this.projectRepo.findOne({
      where: { publicId },
      select: ['id'], // Only INT PK for FK
    });
    if (!project) throw new NotFoundException('Project not found');
    return project.id;
  }

  async resolveContract(publicId: string): Promise<number> {
    const contract = await this.contractRepo.findOne({
      where: { publicId },
      select: ['id'],
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract.id;
  }
}
```

### TransformInterceptor (Required — register ONCE)

```typescript
// Register via APP_INTERCEPTOR in CommonModule — ห้ามซ้ำใน main.ts
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => instanceToPlain(data)) // Applies @Exclude / @Expose
    );
  }
}

// common.module.ts
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class CommonModule {}
```

> **Warning:** ห้ามเรียก `app.useGlobalInterceptors(new TransformInterceptor())` ใน `main.ts` ซ้ำ — จะทำให้ response double-wrap `{ data: { data: ... } }`.

### Critical: NEVER ParseInt on UUID

```typescript
// ❌ WRONG - parseInt on UUID gives garbage value
const id = parseInt(projectPublicId); // "0195a1b2-..." → 195 (wrong!)

// ❌ WRONG - Number() on UUID
const id = Number(projectPublicId); // NaN

// ❌ WRONG - Unary plus on UUID
const id = +projectPublicId; // NaN

// ✅ CORRECT - Resolve via database lookup
const projectId = await uuidResolver.resolveProject(projectPublicId);

// ✅ CORRECT - Use TypeORM find with publicId column
const project = await projectRepo.findOne({ where: { publicId: projectPublicId } });
const id = project.id; // Get INT PK from entity
```

### Query with publicId (No Resolution Needed)

```typescript
// Direct UUID lookup in TypeORM
const project = await this.projectRepo.findOne({
  where: { publicId: projectPublicId },
});

// Relations use INT FK internally
const contracts = await this.contractRepo.find({
  where: { projectId: project.id }, // INT for FK query
});
```

### Reference

- [ADR-019 Hybrid Identifier Strategy](../../../../specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md)
- [UUID Implementation Plan](../../../../specs/05-Engineering-Guidelines/05-07-hybrid-uuid-implementation-plan.md)
- [Data Dictionary](../../../../specs/03-Data-and-Storage/03-01-data-dictionary.md)

> **Warning**: Using `parseInt()`, `Number()`, or unary `+` on UUID values violates ADR-019 and will cause data corruption. Always resolve UUIDs via database lookup.
