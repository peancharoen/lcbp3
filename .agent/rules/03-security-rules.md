---
trigger: always_on
---

# 🛡️ Security Rules (Non-Negotiable)

1. **Idempotency:** All critical `POST`/`PUT`/`PATCH` MUST validate `Idempotency-Key` header
2. **Two-Phase File Upload:** Upload → Temp → Commit → Permanent
3. **Race Conditions:** Redis Redlock + TypeORM `@VersionColumn` for Document Numbering
4. **Validation:** Zod (frontend) + class-validator (backend DTO)
5. **AI Isolation (ADR-018):** Ollama on Admin Desktop ONLY — NO direct DB/storage access

## 🚫 Forbidden Actions

| ❌ Forbidden                                    | ✅ Correct Approach                           |
| ----------------------------------------------- | --------------------------------------------- |
| SQL Triggers for business logic                 | NestJS Service methods                        |
| TypeORM migration files                         | Edit schema SQL directly (ADR-009)            |
| `any` TypeScript type                           | Proper types / generics                       |
| `console.log` in committed code                 | NestJS Logger (backend) / remove (frontend)   |
| Direct file operations bypassing StorageService | `StorageService` for all file moves           |
| Inline email/notification sending               | BullMQ queue job                              |
| `parseInt()` on UUID values                     | Use UUID string directly (ADR-019)            |
