---
title: No TypeORM Migrations (ADR-009)
impact: CRITICAL
impactDescription: Edit SQL schema files directly; n8n handles data migration. Do not generate TypeORM migration files.
tags: database, schema, migration, adr-009, sql, n8n
---

## No TypeORM Migrations (ADR-009)

**This project does NOT use TypeORM migration files.**

All schema changes must be made **directly** in the canonical SQL file:

- `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql`

Delta scripts (for incremental rollout to existing environments) go under:

- `specs/03-Data-and-Storage/deltas/YYYY-MM-DD-descriptive-name.sql`

Data migration (e.g., backfilling a new column) is handled by **n8n workflows**, not TypeORM's `QueryRunner`.

---

## Why No Migrations?

1. **Single source of truth** — The full SQL schema is always readable as one file. No need to replay a migration chain to understand current state.
2. **Review friendly** — Schema diff = git diff on the SQL file. Reviewers see the complete picture.
3. **Ops alignment** — DBAs and operators work in SQL, not TypeScript.
4. **n8n for data** — Business-meaningful data transforms live in n8n where they can be versioned, retried, and orchestrated with monitoring.

---

## ✅ Workflow for a Schema Change

1. **Update Data Dictionary** first:
   - `specs/03-Data-and-Storage/03-01-data-dictionary.md` — add field meaning + business rules.
2. **Update the canonical schema**:
   - Edit `lcbp3-v1.8.0-schema-02-tables.sql` — add/alter column, constraint, index.
3. **Add a delta script** (if deploying to existing env):
   - `specs/03-Data-and-Storage/deltas/2026-04-22-add-rfa-revision-column.sql`

   ```sql
   -- Delta: Add revision column to rfa table
   ALTER TABLE rfa
     ADD COLUMN revision INT NOT NULL DEFAULT 1 AFTER status;

   CREATE INDEX idx_rfa_revision ON rfa(revision);
   ```
4. **Update the Entity** (`backend/src/.../entities/rfa.entity.ts`):

   ```typescript
   @Column({ type: 'int', default: 1 })
   revision: number;
   ```
5. **If data backfill needed** → create n8n workflow, not TypeScript migration.

---

## ❌ Forbidden

```bash
# ❌ DO NOT generate migrations
pnpm typeorm migration:generate ./src/migrations/AddRevision

# ❌ DO NOT run migrations
pnpm typeorm migration:run
```

```typescript
// ❌ DO NOT write migration classes
export class AddRevision1730000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> { /* ... */ }
  async down(queryRunner: QueryRunner): Promise<void> { /* ... */ }
}
```

---

## ✅ TypeORM Config (runtime only)

```typescript
// ormconfig.ts
export default {
  type: 'mariadb',
  // ...
  synchronize: false,      // ❗ NEVER true (would auto-sync entity ↔ schema)
  migrationsRun: false,    // ❗ NEVER true
  // ❌ Do NOT specify `migrations:` entries
};
```

`synchronize: false` is mandatory because the canonical SQL file is authoritative — TypeORM should never mutate the schema.

---

## Reference

- [ADR-009 Database Migration Strategy](../../../../specs/06-Decision-Records/ADR-009-database-migration-strategy.md)
- [Data Dictionary](../../../../specs/03-Data-and-Storage/03-01-data-dictionary.md)
- [Schema Tables](../../../../specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql)
