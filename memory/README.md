# Memory Directory

This directory contains project-specific memory and context that is NOT already covered in the specs/ directory.

## Purpose

The `memory/` directory is for:
- MCP Tools documentation (MariaDB + Memory tools)
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

- `mcp-tools.md` — MCP MariaDB Tools and MCP Memory Tools documentation
- `project-memory-override.md` — Project memory override rule referencing AGENTS.md

## Single Source of Truth

For project rules, decisions, and specifications, always refer to:
- `AGENTS.md` — Project context and rules
- `specs/06-Decision-Records/` — Architecture Decision Records (ADRs)
- `specs/00-overview/00-02-glossary.md` — Domain terminology
- `specs/05-Engineering-Guidelines/` — Backend, frontend, and testing guidelines
