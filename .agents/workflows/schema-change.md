---
auto_execution_mode: 0
description: Manage database schema changes following ADR-009 (no migrations, modify SQL directly)
---

# Schema Change Workflow

Use this workflow when modifying database schema for LCBP3-DMS.
Follows `specs/06-Decision-Records/ADR-009-database-strategy.md` — **NO TypeORM migrations**.

## Pre-Change Checklist

- [ ] Change is required by a spec in `specs/01-Requirements/`
- [ ] Existing data impact has been assessed
- [ ] No SQL triggers are being added (business logic in NestJS only)

## Steps

1. **Read current schema** — load the full schema file:

```
specs/03-Data-and-Storage/lcbp3-v1.8.0-schema.sql
```

2. **Read data dictionary** — understand current field definitions:

```
specs/03-Data-and-Storage/03-01-data-dictionary.md
```

// turbo 3. **Identify impact scope** — determine which tables, columns, indexes, or constraints are affected. List:

- Tables being modified/created
- Columns being added/renamed/dropped
- Foreign key relationships affected
- Indexes being added/modified
- Seed data impact (if any)

4. **Modify schema SQL** — edit `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema.sql`:
   - Add/modify table definitions
   - Maintain consistent formatting (uppercase SQL keywords, lowercase identifiers)
   - Add inline comments for new columns explaining purpose
   - Ensure `DEFAULT` values and `NOT NULL` constraints are correct
   - Add `version` column with `@VersionColumn()` marker comment if optimistic locking is needed

> [!CAUTION]
> **NEVER use SQL Triggers.** All business logic must live in NestJS services.

5. **Update data dictionary** — edit `specs/03-Data-and-Storage/03-01-data-dictionary.md`:
   - Add new tables/columns with descriptions
   - Update data types and constraints
   - Document business rules for new fields
   - Add enum value definitions if applicable

6. **Update seed data** (if applicable):
   - `specs/03-Data-and-Storage/lcbp3-v1.8.0-seed-basic.sql` — for reference/lookup data
   - `specs/03-Data-and-Storage/lcbp3-v1.8.0-seed-permissions.sql` — for new CASL permissions

7. **Update TypeORM entity** — modify corresponding `backend/src/modules/<module>/entities/*.entity.ts`:
   - Map ONLY columns defined in schema SQL
   - Use correct TypeORM decorators (`@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`, etc.)
   - Add `@VersionColumn()` if optimistic locking is needed

8. **Update DTOs** — if new columns are exposed via API:
   - Add fields to `create-*.dto.ts` and/or `update-*.dto.ts`
   - Add `class-validator` decorators for all new fields
   - Never use `any` type

// turbo 9. **Run type check** — verify no TypeScript errors:

```bash
cd backend && npx tsc --noEmit
```

10. **Generate SQL diff** — create a summary of changes for the user to apply manually:

```
-- Schema Change Summary
-- Date: <current date>
-- Feature: <feature name>
-- Tables affected: <list>
--
-- ⚠️ Apply this SQL to the live database manually:

ALTER TABLE ...;
-- or
CREATE TABLE ...;
```

11. **Notify user** — present the SQL diff and remind them:
    - Apply the SQL change to the live database manually
    - Verify the change doesn't break existing data
    - Run `pnpm test` after applying to confirm entity mappings work

## Common Patterns

| Change Type | Template                                                       |
| ----------- | -------------------------------------------------------------- |
| Add column  | `ALTER TABLE \`table\` ADD COLUMN \`col\` TYPE DEFAULT value;` |
| Add table   | Full `CREATE TABLE` with constraints and indexes               |
| Add index   | `CREATE INDEX \`idx_table_col\` ON \`table\` (\`col\`);`       |
| Add FK      | `ALTER TABLE \`child\` ADD CONSTRAINT ... FOREIGN KEY ...`     |
| Add enum    | Add to data dictionary + `ENUM('val1','val2')` in column def   |

## On Error

- If schema SQL has syntax errors → fix and re-validate with `tsc --noEmit`
- If entity mapping doesn't match schema → compare column-by-column against SQL
- If seed data conflicts → check unique constraints and foreign keys
