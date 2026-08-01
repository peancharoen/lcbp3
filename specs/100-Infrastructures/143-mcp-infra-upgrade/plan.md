// File: specs/100-Infrastructures/143-mcp-infra-upgrade/plan.md
// Change Log:
// - 2026-08-01: Initial implementation plan for MCP Infrastructure Upgrade

# Implementation Plan: MCP Infrastructure Upgrade — Host Node.js v24 + Qdrant v1.18

**Branch**: `143-mcp-infra-upgrade` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification for upgrading host Node.js to v24 LTS and Qdrant to v1.18.1 to enable MCP server installation

## Summary

Upgrade the host server's Node.js runtime from v22.22.1 to v24 LTS (completing the host-side upgrade that feature 103-node-upgrade started for Docker containers) and upgrade the Qdrant vector database container from v1.16.1 to v1.18.1. These two infrastructure upgrades unblock the installation of 5 MCP servers (Redis, Qdrant, Memory, Fetch, Gitea) for AI assistant integration. The Qdrant instance has no production data, simplifying the upgrade to a container image swap and collection recreation. The Node.js upgrade enables the Gitea MCP server which requires Node >=24, while the Qdrant upgrade resolves client-server version compatibility for the Qdrant MCP server and adds named vector management capability for future ADR-023A model migration.

## Technical Context

**Language/Version**: Node.js v24 LTS (host system), Qdrant v1.18.1 (Docker container)
**Primary Dependencies**:
- Host: Node.js v24.x LTS, pnpm 10.33+, npx
- Qdrant: `qdrant/qdrant:v1.18.1` Docker image
- Backend client: `@qdrant/js-client-rest` (currently `^1.17.0`, may need bump to `^1.18.0`)
- MCP servers: `@modelcontextprotocol/server-redis`, `@infoinlet/mcp-qdrant`, `@modelcontextprotocol/server-memory`, `mcp-fetch-server`, `@amonstack/gitea-mcp`

**Storage**: Qdrant vector database (Docker container, no data to migrate)
**Testing**:
- Backend: Jest with Supertest for e2e (`pnpm test` in `backend/`)
- Frontend: Vitest with React Testing Library (`pnpm test` in `frontend/`)
- Qdrant: Health endpoint check + AI module integration tests
- MCP: Manual verification of each server's tool calls

**Target Platform**: Linux (host server at 192.168.10.11), Docker containers
**Project Type**: Infrastructure upgrade (no new application code)
**Performance Goals**: No degradation from pre-upgrade baseline
**Constraints**:
- Qdrant has no production data — no backup/migration needed
- Host Node upgrade must not break existing pnpm installations
- Docker containers already run Node 24 (feature 103 complete)
- Must maintain ADR-023 multi-tenancy (projectPublicId filter) after Qdrant upgrade

**Scale/Scope**:
- 1 host Node.js runtime upgrade
- 1 Docker container upgrade (Qdrant)
- 5 MCP server configurations to verify
- 2 package.json engines fields to update (completing 103's incomplete task)

## Constitution Check

_เช็คกฎ AGENTS.md ก่อนเริ่ม - Infrastructure upgrade กระทบ ADRs เกี่ยวกับ AI boundary และ storage_

| ADR | Applicable | Notes |
|-----|------------|-------|
| ADR-009 (Schema) | ❌ N/A | No database schema changes — Qdrant schema managed by application code |
| ADR-019 (UUID) | ❌ N/A | No identifier changes |
| ADR-016 (Security) | ⚠️ Partial | Verify Gitea MCP token scopes are minimal; verify Qdrant has no API key exposed |
| ADR-007 (Errors) | ❌ N/A | No code changes |
| ADR-008 (BullMQ) | ❌ N/A | No queue changes |
| ADR-023/023A (AI Boundary) | ⚠️ Partial | Qdrant is part of AI infrastructure — verify `projectPublicId` filter still works after upgrade |
| ADR-002 (Numbering) | ❌ N/A | No Redis changes |

**GATE STATUS**: ✅ PASS — Infrastructure upgrade with minimal ADR impact. ADR-023 multi-tenancy must be verified post-upgrade.

## Project Structure

### Documentation (this feature)

```text
specs/100-Infrastructures/143-mcp-infra-upgrade/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: Node 24 host upgrade + Qdrant v1.18 compatibility research
├── data-model.md        # N/A (no data model changes — Qdrant collection recreated by app)
├── quickstart.md        # Developer infrastructure upgrade guide
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
# Infrastructure files to modify
specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/
├── 01-infrastructure/
│   └── docker-compose.yml    # Qdrant image version update
└── .env                      # No changes (QDRANT_URL stays the same)

# Application config to update (completing 103's incomplete task)
backend/
├── package.json              # engines field: >=22.0.0 → >=24.0.0
└── .nvmrc                    # Already set to 24.15.0 by 103

frontend/
├── package.json              # engines field: >=22.0.0 → >=24.0.0
└── .nvmrc                    # Already set to 24.15.0 by 103

# MCP configuration (outside repo — user-level config)
~/.config/devin/
└── mcp_config.json           # Already updated with 5 new MCP servers

# Host system
/usr/bin/node                 # v22.22.1 → v24.x LTS (system-level upgrade)
```

**Structure Decision**: Infrastructure-only changes — no new source code directories. Modifications are limited to Docker Compose image tags, package.json engines fields, and host system Node.js installation.

## Complexity Tracking

> No constitution check violations — table not needed.
