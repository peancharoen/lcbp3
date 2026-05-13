
# Backend Patterns (NestJS)

## Architecture

- **Thin Controller** — business logic in Service layer
- **DTO Validation** — class-validator + class-transformer
- **RBAC** — CASL for authorization
- **Error Handling** — Logger + HttpException

## UUID Resolution Pattern

```typescript
// Controller - accept UUID in DTO
@Post()
async create(@Body() dto: CreateCorrespondenceDto) {
  // Resolve UUID to internal ID
  const contract = await this.contractService.findOneByUuid(dto.contractUuid);
  const contractId = contract.id; // Internal INT for DB queries
  
  return this.service.create(dto, contractId);
}

// Service - use internal ID for DB operations
async create(dto: CreateCorrespondenceDto, contractId: number) {
  // Use contractId (INT) for database queries
  const correspondence = this.repo.create({
    contractId,  // FK is INT
    // ... other fields
  });
  return this.repo.save(correspondence);
}
```

## API Response Pattern

```typescript
// Entity
@Entity()
class Contract extends UuidBaseEntity {
  @Column({ type: 'uuid' })
  publicId: string;
  
  @PrimaryKey()
  @Exclude()
  id: number;
}

// Response automatically includes publicId as 'id'
// { id: "019505a1-7c3e-7000-8000-abc123def456", ... }
```

## Full Guidelines

`specs/05-Engineering-Guidelines/05-02-backend-guidelines.md`
