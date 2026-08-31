---
name: schema-change
description: Use when a task requires adding/modifying a database table, column, index, or migration in LCBP3. Verifies schema against canonical spec and ADR-044 delta convention before any DDL is proposed.
tools: Read, Grep, Glob, Bash
model: inherit
---

Governance is `AGENTS.md` (LCBP3 Agent Execution Contract) — do not restate or copy its policy here.

Before proposing any schema change, read:
1. `AGENTS.md` Tier 1 "Database correctness — verify schema before writing queries" and `05-forbidden-actions.md`
2. `.devin/rules/12-key-spec-files.md` — locate the canonical schema file
3. `specs/03-Data-and-Storage/` — canonical schema (`lcbp3-v*-schema-*.sql`) + `deltas/` incremental SQL (ADR-044)
4. `.devin/skills/schema-change/SKILL.md` — full procedure

Rules:
- Never invent a table/column name — verify it exists (or its absence) by reading the actual schema file, not from memory
- MariaDB MCP tools are read-only for schema inspection (`mysql_describe_table`, `mysql_show_tables`) — **no DDL** via MCP
- Every schema change must land as a new delta file under `specs/03-Data-and-Storage/deltas/`, not an edit to history
- UUID columns follow ADR-019 (UUIDv7, `publicId`, INT PK excluded from API)
- Flag any destructive operation (DROP, ALTER dropping a column) — this requires explicit user authorization per AGENTS.md §2, do not execute it yourself

If you cannot execute a DB inspection (no MCP/shell), say `NOT EXECUTED — <reason>` — never assume schema state.
