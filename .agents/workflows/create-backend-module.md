---
description: Create a new NestJS backend feature module following project standards
---

# Create NestJS Backend Module

Use this workflow when creating a new feature module in `backend/src/modules/`.
Follows `specs/05-Engineering-Guidelines/05-02-backend-guidelines.md` and ADR-005.

## Steps

1. **Verify requirements exist** — confirm the feature is in `specs/01-Requirements/` before starting

2. **Check schema** — read `specs/03-Data-and-Storage/lcbp3-v1.7.0-schema.sql` for relevant tables

3. **Scaffold module folder**

```
backend/src/modules/<module-name>/
├── <module-name>.module.ts
├── <module-name>.controller.ts
├── <module-name>.service.ts
├── dto/
│   ├── create-<module-name>.dto.ts
│   └── update-<module-name>.dto.ts
├── entities/
│   └── <module-name>.entity.ts
└── <module-name>.controller.spec.ts
```

4. **Create Entity** — map ONLY columns defined in the schema SQL. Use TypeORM decorators. Add `@VersionColumn()` if the entity needs optimistic locking.

5. **Create DTOs** — use `class-validator` decorators. Never use `any`. Validate all inputs.

6. **Create Service** — inject repository via constructor DI. Use transactions for multi-step writes. Add `Idempotency-Key` guard for POST/PUT/PATCH operations.

7. **Create Controller** — apply `@UseGuards(JwtAuthGuard, CaslAbilityGuard)`. Use proper HTTP status codes. Document with `@ApiTags` and `@ApiOperation`.

8. **Register in Module** — add to `imports`, `providers`, `controllers`, `exports` as needed.

9. **Register in AppModule** — import the new module in `app.module.ts`.

10. **Write unit test** — cover service methods with Jest mocks. Run:

```bash
pnpm test:watch
```

11. **Citation** — confirm implementation references `specs/01-Requirements/` and `specs/05-Engineering-Guidelines/05-02-backend-guidelines.md`
