# Memory Directory

This directory contains project-specific memory and context that is NOT already covered in the specs/ directory.

## Purpose

The `memory/` directory is for:

- MCP Tools documentation (MariaDB, Memory, Redis, Qdrant, Fetch, Gitea)
- Project memory override rules (referencing AGENTS.md)
- Context that doesn't fit into the specs/ structure

## What's NOT Here

The following content has been moved to `specs/88-logs/`:

- Session history logs
- Recent rollouts
- Rules and decisions (now in specs/06-Decision-Records/ ADRs)
- Domain terminology (now in specs/00-overview/00-02-glossary.md)
- Known commands (now in specs/05-Engineering-Guidelines/)
- Environment & Services (now in specs/04-Infrastructure-OPS/)

## Files

- `mcp-tools.md` — MCP Tools documentation (MariaDB, Memory, Redis, Qdrant, Fetch, Gitea)
- `project-memory-override.md` — Project memory override (OS rules, Current Decisions D1-D76, Environment & Services, Next Session Focus)

## Single Source of Truth

For project rules, decisions, and specifications, always refer to:

- `AGENTS.md` — Project context and rules
- `specs/06-Decision-Records/` — Architecture Decision Records (ADRs)
- `specs/00-overview/00-02-glossary.md` — Domain terminology
- `specs/05-Engineering-Guidelines/` — Backend, frontend, and testing guidelines

## MCP Memory Knowledge Graph

In addition to file-based memory above, the project uses MCP Memory server for cross-session context retrieval:

- **Persistence file:** `~/.local/share/devin/mcp-memory/memory.jsonl` (JSONL format)
- **Config:** `~/.config/devin/mcp_config.json` (user-level, not committed)
- **Tools:** `create_entities`, `create_relations`, `add_observations`, `search_nodes`, `read_graph`, `open_nodes`, `delete_entities`, `delete_relations`, `delete_observations`
- **Entity naming:** `Feature-XXX` (features), `D##-Short-Name` (decisions)
- **Relation types:** `produced`, `completes`, `same-as`, `depends-on`, `supersedes`

**⚠️ MCP Memory is a supplementary layer** — file-based memory (session logs + project-memory-override.md) remains the source of truth for persistence and audit trail.
