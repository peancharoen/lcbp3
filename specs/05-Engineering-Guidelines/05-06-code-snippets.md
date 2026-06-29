# Code Snippets

**Version:** 1.8.6
**Last Updated:** 2026-04-10
**Location:** `specs/05-Engineering-Guidelines/05-06-code-snippets.md`

---

## Backend DTO Pattern

```typescript
// [dto-new] → Create DTO with validator
@IsUUID()
@ApiProperty({ description: 'Project UUID (public)' })
projectUuid!: string;

@IsOptional()
@IsInt()
@ApiProperty({ required: false, description: 'Internal project ID' })
projectId?: number; // resolved internally, never from client
```

---

## Frontend Form Pattern

```typescript
// [form-rhf-zod] → Create form schema + hook
const schema = z.object({
  projectUuid: z.string().uuid('รหัสโครงการไม่ถูกต้อง'),
  title: z.string().min(3, 'กรุณากรอกหัวข้ออย่างน้อย 3 ตัวอักษร'),
});
const form = useForm({ resolver: zodResolver(schema) });
```

---

## UUID Safe Pattern

```typescript
// [uuid-safe] → Check UUID before use
const safeUuid = (val: string | number): string => {
  if (typeof val === 'number') {
    Logger.warn(`UUID received as number: ${val}`);
    return String(val); // or throw error per policy
  }
  return val;
};
```

---

## Backend Error Handling Pattern

```typescript
// [backend-error] → Standard error handling
if (!entity) {
  this.logger.warn(`Entity not found: ${uuid}`, 'Service.findOne');
  throw new NotFoundException(`Resource with UUID ${uuid} not found`);
}
```

---

## Frontend Query Pattern

```typescript
// [frontend-query] → TanStack Query v5 standard
const { data, error, isLoading } = useQuery({
  queryKey: ['correspondence', uuid],
  queryFn: () => api.get(`/correspondences/${uuid}`),
});
// v5: onError removed from useQuery — handle error via return value
if (error) toast.error('ไม่สามารถโหลดข้อมูลได้');
```

---

## Redis Cache Pattern

```typescript
// [redis-cache] → Cache-Aside Pattern
const cacheKey = `correspondence:${uuid}`;
const cached = await this.cacheManager.get(cacheKey);
if (cached) return cached;
const entity = await this.repo.findOneBy({ uuid });
if (entity) {
  await this.cacheManager.set(cacheKey, entity, 300); // 5 minutes
}
return entity;
```

---

## Workflow Transition Pattern

```typescript
// [workflow-transition] → Pattern สำหรับการเปลี่ยนสถานะเอกสารอย่างปลอดภัย
// ใช้ใน: WorkflowEngineService

async transitionStatus(
  publicId: string, // รับ UUIDv7 เท่านั้น (ADR-019)
  targetStatus: DocumentStatus,
  actor: RequestWithUser
): Promise<Document> {
  // 1. ค้นหา Entity ด้วย publicId และตรวจสอบการมีอยู่
  const document = await this.repo.findOne({
    where: { publicId },
    relations: ['currentAssignee'],
  });

  if (!document) {
    this.logger.warn(`ไม่พบเอกสาร UUID: ${publicId}`, 'WorkflowService');
    throw new NotFoundException(ErrorCode.DOC_NOT_FOUND);
  }

  // 2. ตรวจสอบว่า transition นี้ถูกต้องตาม DSL (ADR-001)
  await this.workflowEngine.validateTransition(document.workflowState, targetStatus);

  // 3. Business Logic Validation: ตรวจสอบสิทธิ์ผู้รับผิดชอบ
  if (document.currentAssignee?.publicId !== actor.user.publicId) {
    throw new ForbiddenException(ErrorCode.UNAUTHORIZED_TRANSITION);
  }

  // 4. ปรับปรุงสถานะและใช้ @VersionColumn ใน Entity เพื่อทำ Optimistic Locking
  try {
    document.status = targetStatus;
    document.updatedBy = actor.user.publicId;

    const savedDoc = await this.repo.save(document);

    // 5. บันทึก Audit Log
    this.logger.log(
      `เอกสาร ${publicId} เปลี่ยนสถานะเป็น ${targetStatus} โดย ${actor.user.publicId}`
    );

    // 6. ส่งงานเข้า Queue (BullMQ) สำหรับการส่ง Notification/Email (ADR-008)
    await this.notificationQueue.add('status-change', {
      docId: savedDoc.publicId,
      status: targetStatus,
      recipientPublicId: savedDoc.creatorPublicId, // ใช้ publicId ตาม ADR-019
    });

    return savedDoc;
  } catch (error) {
    if (error instanceof OptimisticLockVersionMismatchError) {
      // ป้องกันการแก้ไขซ้ำซ้อนในเวลาเดียวกัน (Race Condition)
      throw new ConflictException('ข้อมูลถูกแก้ไขโดยผู้อื่นไปก่อนหน้าแล้ว กรุณารีเฟรชหน้าจอ');
    }
    throw error;
  }
}
```

---

## Reference

- [Backend Guidelines](05-02-backend-guidelines.md)
- [Frontend Guidelines](05-03-frontend-guidelines.md)
- [Testing Strategy](05-04-testing-strategy.md)
