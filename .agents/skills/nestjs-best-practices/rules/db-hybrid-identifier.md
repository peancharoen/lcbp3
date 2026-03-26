---
title: Hybrid Identifier Strategy (ADR-019)
impact: CRITICAL
impactDescription: Use INT PK internally + UUID for public API per project ADR-019
tags: database, uuid, identifier, adr-019, api-design, typeorm
---

## Hybrid Identifier Strategy (ADR-019)

**This project follows ADR-019: INT Primary Key (internal) + UUIDv7 (public API)**

Unlike standard practices that use UUID as the primary key, this project uses a **hybrid approach** optimized for MariaDB performance and API consistency.

### The Strategy

| Layer | Field | Type | Usage |
|-------|-------|------|-------|
| **Database PK** | `id` | `INT AUTO_INCREMENT` | Internal foreign keys only |
| **Public API** | `uuid` | `MariaDB UUID` (native) | External references, URLs |
| **DTO Input** | `xxxUuid` | `string` | Accept UUID in create/update |
| **DTO Output** | `id` | `string` | API returns UUID as `id` via `@Expose` |

### Why Hybrid IDs?

- **Performance**: INT PK is faster for joins and indexing than UUID
- **Security**: Internal IDs never exposed in API (enumerable IDs are a risk)
- **Compatibility**: UUID works well with distributed systems and external integrations
- **MariaDB Native**: Uses MariaDB's native UUID type (stored as BINARY(16), auto-converts to string)

### Entity Definition

```typescript
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { Exclude, Expose } from 'class-transformer';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn()
  @Exclude() // Never expose in API response
  id: number;  // Internal INT PK - used for FK relationships

  @Column({ type: 'uuid', unique: true })
  @Expose({ name: 'id' }) // Exposed as 'id' in API
  uuid: string;  // Public UUIDv7 - what API consumers see

  @Column()
  contractCode: string;

  @Column()
  contractName: string;
}
```

### DTO Pattern (Accept UUID, Resolve to INT)

```typescript
// dto/create-contract.dto.ts
import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateContractDto {
  @IsNotEmpty()
  @IsUUID('4')
  projectUuid: string;  // Accept UUID from client

  @IsNotEmpty()
  contractCode: string;

  @IsNotEmpty()
  contractName: string;
}

// dto/contract-response.dto.ts
import { Exclude, Expose } from 'class-transformer';

export class ContractResponseDto {
  @Expose({ name: 'id' })
  uuid: string;  // Returned as 'id' field in JSON

  contractCode: string;
  contractName: string;
}
```

### Service/Controller Pattern

```typescript
@Controller('contracts')
export class ContractsController {
  constructor(
    private contractsService: ContractsService,
    private uuidResolver: UuidResolver,  // Helper to convert UUID → INT
  ) {}

  @Post()
  async create(@Body() dto: CreateContractDto) {
    // Resolve UUID to INT PK for database operations
    const projectId = await this.uuidResolver.resolveProject(dto.projectUuid);
    
    // Create with INT FK
    const contract = await this.contractsService.create({
      ...dto,
      projectId,  // INT for database
    });

    // Response automatically transforms via @Expose
    return contract;
  }

  @Get(':id')
  async findOne(@Param('id') uuid: string) {
    // Controller receives UUID string
    // Service handles UUID → INT resolution internally
    return this.contractsService.findByUuid(uuid);
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
    private contractRepo: Repository<Contract>,
  ) {}

  async resolveProject(uuid: string): Promise<number> {
    const project = await this.projectRepo.findOne({
      where: { uuid },
      select: ['id'],  // Only fetch INT PK
    });
    if (!project) throw new NotFoundException('Project not found');
    return project.id;
  }

  async resolveContract(uuid: string): Promise<number> {
    const contract = await this.contractRepo.findOne({
      where: { uuid },
      select: ['id'],
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract.id;
  }
}
```

### TransformInterceptor (Required)

```typescript
// Must be configured globally to handle @Exclude/@Expose
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => instanceToPlain(data)),  // Applies class-transformer decorators
    );
  }
}

// app.module.ts
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
```

### Critical: NEVER ParseInt on UUID

```typescript
// ❌ WRONG - parseInt on UUID gives garbage value
const id = parseInt(projectUuid); // "0195a1b2-..." → 195 (wrong!)

// ❌ WRONG - Number() on UUID
const id = Number(projectUuid); // NaN

// ❌ WRONG - Unary plus on UUID
const id = +projectUuid; // NaN

// ✅ CORRECT - Resolve via database lookup
const projectId = await uuidResolver.resolveProject(projectUuid);

// ✅ CORRECT - Use TypeORM find with UUID column
const project = await projectRepo.findOne({ where: { uuid: projectUuid } });
const id = project.id;  // Get INT PK from entity
```

### Query with UUID (No Resolution Needed)

```typescript
// Direct UUID lookup in TypeORM
const project = await this.projectRepo.findOne({
  where: { uuid: projectUuid },  // Query by UUID column
});

// Relations use INT FK internally
const contracts = await this.contractRepo.find({
  where: { projectId: project.id },  // INT for FK query
});
```

### Reference

- [ADR-019 Hybrid Identifier Strategy](../../../../specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md)
- [UUID Implementation Plan](../../../../specs/05-Engineering-Guidelines/05-07-hybrid-uuid-implementation-plan.md)
- [Data Dictionary](../../../../specs/03-Data-and-Storage/03-01-data-dictionary.md)

> **Warning**: Using `parseInt()`, `Number()`, or unary `+` on UUID values violates ADR-019 and will cause data corruption. Always resolve UUIDs via database lookup.
