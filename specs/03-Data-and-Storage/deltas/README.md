# Schema Deltas

Incremental SQL scripts applied to existing environments **after** the canonical schema
(`../lcbp3-v1.9.0-schema-02-tables.sql`) has been updated.

## Naming Convention

```
YYYY-MM-DD-descriptive-name.sql
```

Examples:

- `2026-04-22-add-rfa-revision-column.sql`
- `2026-04-25-index-correspondence-created-at.sql`
- `2026-05-01-add-workflow-step-attachment-table.sql`

## Rules (per ADR-009)

1. **Never replace** the canonical `lcbp3-v1.9.x-schema-02-tables.sql` — update it first, then add the delta here.
2. **Idempotent where possible** — prefer `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, etc.
3. **No TypeORM migrations** — these `.sql` files are the only schema deployment mechanism.
4. **Data backfill** goes through **n8n workflows**, not this directory.
5. **Update Data Dictionary** (`../03-01-data-dictionary.md`) in the same PR that adds a delta.

## Delta Template

```sql
-- Delta: <short description>
-- Date: YYYY-MM-DD
-- Related ADR: ADR-XXX (if applicable)
-- Related Spec: specs/NN-NAME/spec.md (if applicable)
-- Applied in: v1.8.X → v1.8.Y

-- ------------------------------------------------------------
-- Schema changes
-- ------------------------------------------------------------

ALTER TABLE <table>
  ADD COLUMN <col> <type> <constraints>;

-- ------------------------------------------------------------
-- Indexes (if needed)
-- ------------------------------------------------------------

CREATE INDEX idx_<table>_<col> ON <table>(<col>);

-- ------------------------------------------------------------
-- Verification query (optional)
-- ------------------------------------------------------------

-- SELECT COUNT(*) FROM <table> WHERE <col> IS NOT NULL;
```

## Rollback

Every delta should have a reversible companion (`YYYY-MM-DD-descriptive-name.rollback.sql`)
where physically possible. Dropping `NOT NULL` columns with existing data is explicitly
irreversible — document in the delta header when rollback is impossible.

## References

- [ADR-009 Database Migration Strategy](../../06-Decision-Records/ADR-009-database-migration-strategy.md)
- [Canonical Schema](../lcbp3-v1.9.0-schema-02-tables.sql)
- [Data Dictionary](../03-01-data-dictionary.md)
