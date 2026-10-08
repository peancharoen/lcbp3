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

## TypeORM FK Update Pattern

```typescript
// ❌ WRONG — entity ที่โหลด relation มาแล้ว + save() ทำให้ relation เก่า
//    cascade เขียนค่าเดิมทับ FK ใหม่กลับคืน (200 OK แต่ DB ไม่เปลี่ยน — PR #32)
const link = await repo.findOne({ where, relations: ['organizationRole'] });
link.roleId = newRoleId;
await repo.save(link); // roleId ถูกเขียนทับกลับเป็นค่าเก่า

// ✅ CORRECT — update scalar FK ตรง ๆ แล้ว refetch ให้ response มี relation ใหม่
await repo.update({ projectId, organizationId }, { roleId: newRoleId });
const saved = await repo.findOneOrFail({ where, relations: ['organizationRole'] });
return toDto(saved);
```

**Rule:** เมื่อเปลี่ยน scalar FK บน entity ที่โหลด many-to-one relation มาแล้ว ให้ใช้ `repo.update()` หรือ query builder เสมอ — ห้าม `save(entity)` (precedent: `updateOrganizationRole` ใน Project/ContractService, PR #32)

## API Response Pattern

```typescript
// Entity
@Entity()
class Contract extends UuidBaseEntity {
  @Column({ type: 'uuid' })
  publicId: string;

  @PrimaryGeneratedColumn()
  @Exclude()
  id: number;
}

// Response automatically includes publicId as 'id'
// { id: "019505a1-7c3e-7000-8000-abc123def456", ... }
```

## Full Guidelines

`specs/05-Engineering-Guidelines/05-02-backend-guidelines.md`
