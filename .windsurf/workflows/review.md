---
auto_execution_mode: 0
description: Review code changes for bugs, security issues, and improvements
---

You are a senior software engineer performing a thorough code review to identify potential bugs.

Your task is to find all potential bugs and code improvements in the code changes. Focus on:

1. Logic errors and incorrect behavior
2. Edge cases that aren't handled
3. Null/undefined reference issues
4. Race conditions or concurrency issues
5. Security vulnerabilities
6. Improper resource management or resource leaks
7. API contract violations
8. Incorrect caching behavior, including cache staleness issues, cache key-related bugs, incorrect cache invalidation, and ineffective caching
9. Violations of existing code patterns or conventions

## 🔴 Tier 1 Critical Rules (CI Blockers)

The following are **CI-blocking issues** that must be caught in code review. These align with project specs in `specs/05-Engineering-Guidelines/` and `specs/06-Decision-Records/`:

### ADR-019: UUID Handling

- **❌ NEVER use `parseInt()`, `Number()`, or `+` operator on UUID values**
  - Example of violation: `parseInt(projectId)` where `projectId` is UUID string
  - ✅ Correct: Use UUID string directly without conversion
- **❌ NEVER expose internal INT PK in API responses**
  - API must expose only `publicId` (transformed to `id` via `@Expose()`)
  - Verify DTOs have `@Exclude()` on `id: number` field

### TypeScript Strict Rules

- **❌ ZERO `any` types allowed** — use proper types or `unknown` + narrowing
- **❌ ZERO `console.log`** — must use NestJS `Logger` (backend) or remove (frontend)
- **❌ NO `req: any` in controllers** — use `RequestWithUser` typed interface

### Database & Architecture

- **❌ NO SQL Triggers for business logic** — use NestJS Service methods instead
- **❌ NO `.env` files in production** — use Docker environment variables
- **❌ NO direct table/column name invention** — verify against `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`

### Security (ADR-016)

- Idempotency validation for critical `POST`/`PUT`/`PATCH` endpoints
- Two-phase file upload pattern (Upload → Temp → Commit → Permanent)
- Input validation with class-validator (backend) and Zod (frontend)

### Test Coverage Requirements

- **Backend Services:** 80% minimum
- **Backend Overall:** 70% minimum
- **Business Logic:** 80% minimum

Make sure to:

1. If exploring the codebase, call multiple tools in parallel for increased efficiency. Do not spend too much time exploring.
2. If you find any pre-existing bugs in the code, you should also report those since it's important for us to maintain general code quality for the user.
3. Do NOT report issues that are speculative or low-confidence. All your conclusions should be based on a complete understanding of the codebase.
4. Remember that if you were given a specific git commit, it may not be checked out and local code states may be different.
