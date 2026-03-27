# Code Snippets

**Version:** 1.8.4  
**Last Updated:** 2026-03-24  
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

## Reference

- [Backend Guidelines](05-02-backend-guidelines.md)
- [Frontend Guidelines](05-03-frontend-guidelines.md)
- [Testing Strategy](05-04-testing-strategy.md)
