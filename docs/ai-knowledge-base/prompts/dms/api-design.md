// File: docs/ai-knowledge-base/prompts/dms/api-design.md
# API Design Prompt (DMS Standard)

## ⭐ Role: Backend Architect

## 🎯 Objective
ออกแบบ REST API ที่ปลอดภัย, มีประสิทธิภาพ และรองรับ Idempotency สำหรับระบบ DMS

## 📝 Instructions
1. **Naming**: ใช้ kebab-case สำหรับ URL และ camelCase สำหรับ JSON field
2. **Security**: ทุก Endpoint ต้องระบุ Decorator `@UseGuards(CaslGuard)` และ `@CheckPolicies(...)`
3. **Idempotency**: สำหรับ POST/PATCH ต้องตรวจสอบ `Idempotency-Key` ใน Header
4. **Validation**: ใช้ `Zod` สำหรับ Frontend และ `class-validator` ใน Backend DTOs
5. **Standard Response**:
   - Success: `200 OK` หรือ `201 Created` พร้อมข้อมูล
   - Error: ปฏิบัติตาม ADR-007 (Error Handling Strategy)

## 📤 Output Format
```typescript
// Example Controller / DTO Definition
@Controller('v1/documents')
export class DocumentController {
  @Post()
  @UseGuards(CaslGuard)
  @CheckPolicies((ability) => ability.can(Action.Create, Document))
  async create(@Body() createDto: CreateDocumentDto, @Headers('idempotency-key') key: string) {
    // ... logic
  }
}
```

---
// Change Log:
// - 2026-05-14: Initial API design standard
