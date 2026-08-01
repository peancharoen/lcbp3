// File: specs/100-Infrastructures/143-mcp-infra-upgrade/spec.md
// Change Log:
// - 2026-08-01: Initial specification for MCP Infrastructure Upgrade (Node 24 + Qdrant v1.18)

# Feature Specification: MCP Infrastructure Upgrade — Host Node.js v24 + Qdrant v1.18

**Feature Branch**: `143-mcp-infra-upgrade`
**Created**: 2026-08-01
**Status**: Draft
**Category**: 100-Infrastructures
**Input**: User description: "Upgrade host Node.js to v24 and Qdrant to v1.18 to enable MCP server installation"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Host Node.js Upgrade to v24 LTS (Priority: P1)

As a system administrator, I need to upgrade the Node.js runtime on the host server from v22.22.1 to v24 LTS so that MCP servers requiring Node >=24 (specifically Gitea MCP) can be launched via npx on the host system.

**Why this priority**: The Gitea MCP server (`@amonstack/gitea-mcp`) requires Node >=24 and runs on the host via npx. Without this upgrade, the Gitea MCP server cannot start, blocking issue tracking integration. Docker containers already run Node 24 (per feature 103-node-upgrade), but the host runtime is still v22.22.1.

**Independent Test**: Can be fully tested by running `node --version` on the host to confirm v24.x, then launching `npx @amonstack/gitea-mcp` to verify the Gitea MCP server starts successfully and can list issues from the Gitea instance.

**Acceptance Scenarios**:

1. **Given** the host server is running Node.js v22.22.1, **When** the upgrade to Node.js v24 LTS is applied, **Then** `node --version` reports v24.x on the host
2. **Given** Node.js v24 is installed on the host, **When** `npx @amonstack/gitea-mcp` is launched with Gitea credentials, **Then** the Gitea MCP server starts without engine warnings and connects to the Gitea instance at `http://192.168.10.11:3003`
3. **Given** Node.js v24 is installed on the host, **When** existing backend and frontend development commands (`pnpm dev`, `pnpm test`) are run locally on the host, **Then** all commands work without Node version-related errors
4. **Given** the host Node.js upgrade is complete, **When** `pnpm install` is re-run in both `backend/` and `frontend/`, **Then** dependency installation completes without errors

---

### User Story 2 - Qdrant Upgrade to v1.18 (Priority: P2)

As a system administrator, I need to upgrade the Qdrant vector database from v1.16.1 to v1.18.x so that the Qdrant MCP server (`@infoinlet/mcp-qdrant`) can connect without client compatibility errors, and the system benefits from named vector management (useful for ADR-023A model migration) and TurboQuant compression.

**Why this priority**: The Qdrant MCP server uses `@qdrant/js-client-rest` v1.18 which is incompatible with Qdrant server v1.16.1 (major version mismatch). Additionally, Qdrant v1.18 introduces named vector add/remove — critical for future embedding model migration per ADR-023A. The Qdrant instance currently has no production data, so the upgrade risk is minimal.

**Independent Test**: Can be fully tested by upgrading the Qdrant Docker container to v1.18.x, verifying the health endpoint responds, confirming the `lcbp3_vectors` collection can be recreated, and validating that the Qdrant MCP server can list collections without compatibility errors.

**Acceptance Scenarios**:

1. **Given** Qdrant is running v1.16.1 in a Docker container, **When** the container image is upgraded to `qdrant/qdrant:v1.18.1`, **Then** the Qdrant health endpoint (`http://192.168.10.11:6333/healthz`) returns "healthz check passed"
2. **Given** Qdrant v1.18.1 is running, **When** the `lcbp3_vectors` collection is recreated via the backend's `ensureCollection()` method, **Then** the collection is created successfully with the correct vector configuration (Dense 1024 + Sparse)
3. **Given** Qdrant v1.18.1 is running with the recreated collection, **When** the Qdrant MCP server (`@infoinlet/mcp-qdrant`) is launched, **Then** `qdrant_list_collections` returns `lcbp3_vectors` without compatibility errors
4. **Given** Qdrant v1.18.1 is running, **When** the backend AI module performs a vector search with `projectPublicId` filter, **Then** search results return correctly (enforcing ADR-023 multi-tenancy)
5. **Given** Qdrant v1.18.1 is running, **When** the backend test suite for the AI module is run, **Then** all Qdrant-related tests pass

---

### User Story 3 - MCP Server Configuration Finalization (Priority: P3)

As a system administrator, I need all five MCP servers (Redis, Qdrant, Memory, Fetch, Gitea) to be properly configured and verified as operational, completing the MCP server installation that motivated this infrastructure upgrade.

**Why this priority**: This is the culmination of the infrastructure upgrade — once Node 24 and Qdrant v1.18 are in place, the MCP servers can be finalized and verified. This delivers the actual value: AI assistant integration with Redis, Qdrant, long-term memory, HTTP fetch, and Gitea issue tracking.

**Independent Test**: Can be fully tested by restarting the Devin CLI session (to pick up the updated `mcp_config.json`) and verifying each MCP server responds to tool calls.

**Acceptance Scenarios**:

1. **Given** Node.js v24 is installed and Qdrant v1.18 is running, **When** the Devin CLI session restarts with the updated `mcp_config.json`, **Then** all 8 MCP servers are listed as available (3 existing + 5 new)
2. **Given** all MCP servers are configured, **When** the Redis MCP server is called, **Then** it connects to `redis://192.168.10.11:6379` and can list keys
3. **Given** all MCP servers are configured, **When** the Qdrant MCP server is called, **Then** it lists collections from `http://192.168.10.11:6333` without compatibility errors
4. **Given** all MCP servers are configured, **When** the Gitea MCP server is called, **Then** it can list issues from the `np-dms/lcbp3` repository
5. **Given** all MCP servers are configured, **When** the Memory MCP server is called, **Then** it can create and search entities in the knowledge graph
6. **Given** all MCP servers are configured, **When** the Fetch MCP server is called, **Then** it can retrieve content from a URL

---

### Edge Cases

- What happens if the host Node.js upgrade breaks existing pnpm installations? — Mitigation: backup `pnpm-lock.yaml` files before upgrade, verify `pnpm install` works after upgrade
- What happens if Qdrant v1.18 container fails to start after upgrade? — Mitigation: keep the v1.16.1 image tagged, rollback by changing the Docker Compose image tag back
- What happens if the Qdrant client library (`@qdrant/js-client-rest: ^1.17.0`) is incompatible with Qdrant server v1.18? — Mitigation: bump client to `^1.18.0` in `backend/package.json` and re-run tests
- What happens if the Gitea MCP server cannot connect to the Gitea instance? — Mitigation: verify network connectivity and token validity, regenerate token if expired
- What happens if the Redis MCP server package (`@modelcontextprotocol/server-redis`) is deprecated? — Mitigation: note deprecation, monitor for replacement package, functionality still works
- How does the system handle a Qdrant upgrade when there IS data in the future? — Note: current upgrade is safe because Qdrant has no production data; future upgrades must follow snapshot backup procedure

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST upgrade the host Node.js runtime from v22.22.1 to v24 LTS (latest stable)
- **FR-002**: System MUST preserve existing pnpm installation and lockfile compatibility after the Node.js upgrade
- **FR-003**: System MUST update `backend/package.json` and `frontend/package.json` engines field from `>=22.0.0` to `>=24.0.0` (completing the incomplete task from feature 103)
- **FR-004**: System MUST upgrade the Qdrant Docker container from `qdrant/qdrant:v1.16.1` to `qdrant/qdrant:v1.18.1`
- **FR-005**: System MUST recreate the `lcbp3_vectors` collection after the Qdrant upgrade (no data to migrate)
- **FR-006**: System MUST update `@qdrant/js-client-rest` from `^1.17.0` to `^1.18.0` in `backend/package.json` if compatibility issues arise
- **FR-007**: System MUST verify all five new MCP servers (Redis, Qdrant, Memory, Fetch, Gitea) are operational after the infrastructure upgrade
- **FR-008**: System MUST verify existing backend and frontend test suites pass after both upgrades
- **FR-009**: System MUST update the Qdrant version in the Docker Compose file (`specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure/docker-compose.yml`)
- **FR-010**: System MUST verify the AI module's Qdrant integration (search with `projectPublicId` filter) works after the Qdrant upgrade

### Key Entities

- **Host Node.js Runtime**: The Node.js installation on the host server (currently v22.22.1, target v24 LTS) — used by npx to launch MCP servers and by developers for local development
- **Qdrant Container**: The Docker container running Qdrant vector database (currently v1.16.1, target v1.18.1) — stores AI embeddings for the `lcbp3_vectors` collection
- **MCP Configuration**: The `~/.config/devin/mcp_config.json` file defining all MCP servers — already updated with 5 new server entries, pending infrastructure prerequisites

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Host `node --version` reports v24.x LTS after upgrade (verifiable with single command)
- **SC-002**: `npx @amonstack/gitea-mcp` starts without Node engine warnings after upgrade (verifiable by launching the server)
- **SC-003**: Qdrant health endpoint returns "healthz check passed" after upgrade to v1.18.1 (verifiable with `curl http://192.168.10.11:6333/healthz`)
- **SC-004**: Qdrant MCP server lists collections without compatibility errors (verifiable by calling `qdrant_list_collections` tool)
- **SC-005**: All 5 new MCP servers respond to tool calls within 5 seconds (verifiable by testing each server after session restart)
- **SC-006**: Backend test suite passes at the same rate as pre-upgrade baseline (verifiable by running `pnpm test` in `backend/`)
- **SC-007**: Frontend build completes successfully after Node.js upgrade (verifiable by running `pnpm build` in `frontend/`)
- **SC-008**: AI module vector search returns correct results with `projectPublicId` filter after Qdrant upgrade (verifiable by running AI module integration tests)

## Clarifications

### Session 2026-08-01

- Ambiguity scan completed across 12 taxonomy categories — all categories rated Clear or Partial (Non-Functional: downtime window not specified, but immaterial since this is an infrastructure task with no active users during upgrade)
- No clarification questions needed — spec is ready for planning phase

## Assumptions

- Qdrant has no production data to migrate (confirmed by user: "Qdrant ไม่มีข้อมูล")
- Docker containers for backend and frontend already run Node 24 (completed by feature 103-node-upgrade)
- The host server has sufficient disk space for Node.js v24 installation alongside v22
- The Gitea API token created during MCP server setup is still valid
- The Redis MCP server package (`@modelcontextprotocol/server-redis`) is deprecated but functional — no replacement needed at this time
- pnpm 10.33+ is compatible with Node.js v24 (to be verified during implementation)
- The Qdrant upgrade can be done by simply changing the Docker image tag since there is no data to migrate

## Dependencies

- **Feature 103-node-upgrade**: Docker-side Node upgrade is complete; this feature completes the host-side upgrade
- **ADR-023/023A**: AI boundary — Qdrant is part of the AI infrastructure stack
- **ADR-009**: No TypeORM migrations — Qdrant schema is managed by application code (`ensureCollection()`)
- **Docker Compose**: `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure/docker-compose.yml` — Qdrant service definition
