# Forbidden Actions

## ❌ Never Do This

| ❌ Forbidden                                    | ✅ Correct Approach                                     | ⚠️ Why                                               |
| ----------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| SQL Triggers for business logic                 | NestJS Service methods                                  | Untestable; bypasses audit log                       |
| `.env` files in production                      | `docker-compose.yml` environment section                | Secrets exposed in version control                   |
| TypeORM migration files                         | Edit schema SQL directly (ADR-009)                      | Migration drift risk; schema managed via SQL delta   |
| Inventing table/column names                    | Verify against `schema-02-tables.sql`                   | Schema mismatch causes silent runtime errors         |
| `any` TypeScript type                           | Proper types / generics                                 | Defeats strict mode; hides runtime type errors       |
| `console.log` in committed code                 | NestJS Logger (backend) / remove (frontend)             | Log flooding in production; risk of data leakage     |
| `req: any` in controllers                       | `RequestWithUser` typed interface                       | Type safety lost; auth context unreachable           |
| `parseInt()` on UUID values                     | Use UUID string directly (ADR-019)                      | `"0195…"` parsed to integer `19` — silently wrong    |
| Exposing INT PK in API responses                | UUIDv7 `publicId` (ADR-019)                             | Leaks row count; enables DB enumeration attacks      |
| AI accessing DB/storage directly                | AI → DMS API → DB (ADR-023/023A)                        | Bypasses RBAC, audit trail, and validation layer     |
| Direct file operations bypassing StorageService | `StorageService` for all file moves                     | Orphaned files; broken ClamAV scan; no audit trail   |
| Inline email/notification sending               | BullMQ queue job (ADR-008)                              | Blocks request thread; no retry on transient failure |
| Deploying without Release Gates                 | Complete `04-08-release-management-policy.md`           | Unverified deploy risks data loss in production      |
| AI direct cloud API calls                       | On-premises Ollama only (ADR-023/023A)                  | Data privacy violation; no audit control             |
| AI outputs without human validation             | Human-in-the-loop validation required (ADR-023/023A)    | Unvalidated AI metadata corrupts document records    |
| n8n calling Ollama/Qdrant directly              | n8n → DMS API → BullMQ → Ollama (ADR-023A)              | Bypasses audit log, RBAC, and error handling layer   |
| Qdrant query without `projectPublicId` filter   | `QdrantService.search(projectPublicId, ...)` (ADR-023A) | Cross-project data leak via vector search            |

## Schema Changes (ADR-009)

- **NO TypeORM migrations** — edit SQL schema directly
- Always check `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` before writing queries
- Update Data Dictionary when changing fields

## UUID Handling

See `01-adr-019-uuid.md` for complete UUID rules.

Quick reminder:

- ❌ `parseInt(uuid)` → NEVER
- ❌ `Number(uuid)` → NEVER
- ✅ Use UUID string directly
