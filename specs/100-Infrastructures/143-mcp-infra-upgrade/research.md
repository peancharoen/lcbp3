# Research: MCP Infrastructure Upgrade — Node 24 Host + Qdrant v1.18

## Research Topics Completed

### RT-001: Node.js v24 Host System Upgrade Method

**Decision**: Install Node.js v24 LTS via NodeSource APT repository

**Rationale**:
- Current system has Node v22.22.1 installed via Ubuntu APT (`nodejs/resolute,now 22.22.1+dfsg+~cs22.19.15-1ubuntu1`)
- Ubuntu APT only provides Node 22 — Node 24 not available in default repos
- NodeSource provides official Node.js APT packages for Debian/Ubuntu
- Node 24.18.1 is the latest LTS (security release 2026-07-29)
- Alternative: nvm — but nvm is not installed and adds shell complexity for a server environment

**Alternatives Considered**:
- nvm (not installed, adds per-shell management overhead)
- n (not installed, simpler but less maintained)
- Build from source (too slow, unnecessary for LTS)
- Docker-only (host needs Node 24 for npx MCP servers)

**Installation Steps**:
1. Add NodeSource APT repository for Node 24
2. `apt install nodejs` (will upgrade from 22 to 24)
3. Verify `node --version` reports v24.x
4. Reinstall pnpm globally: `npm i -g pnpm@10`
5. Re-run `pnpm install` in backend/ and frontend/

### RT-002: Node.js v24 Breaking Changes Impact on Host

**Decision**: Low risk — no breaking changes affect this codebase

**Rationale**:
- Feature 103-node-upgrade already researched v24 breaking changes (see `specs/100-Infrastructures/103-node-upgrade/research.md`)
- No native addons (.node files) found in backend or frontend
- No deprecated APIs used: no `url.parse()`, no `SlowBuffer`, no `createSecurePair`, no `new Buffer()`
- Crypto service uses `scryptSync` + AES (not affected by OpenSSL 3.5 security level 2)
- `engines` field in package.json already allows `>=22.0.0` which includes 24

**Action Items**:
- Update `engines` field from `>=22.0.0` to `>=24.0.0` (completing 103's incomplete T005/T006)
- Re-run `pnpm install` to regenerate lockfile if needed
- Run full test suite to verify no regressions

### RT-003: Qdrant v1.16.1 → v1.18.1 Upgrade Path

**Decision**: Direct container image swap — no incremental upgrade needed

**Rationale**:
- Qdrant v1.17 removed RocksDB support, warning that direct upgrade from v1.15 → v1.17+ is not possible
- However, v1.16.1 → v1.18.1 IS supported because v1.16 already uses gridstore (not RocksDB)
- Qdrant has NO production data (confirmed by user) — collection will be recreated by backend's `ensureCollection()`
- No snapshot/backup needed since there is no data to preserve
- Docker image `qdrant/qdrant:v1.18.1` already pulled and verified available

**Upgrade Steps**:
1. Stop Qdrant container: `docker compose stop qdrant`
2. Update image tag in docker-compose.yml: `qdrant/qdrant:v1.16.1` → `qdrant/qdrant:v1.18.1`
3. Remove old container and volume: `docker compose down qdrant` + remove volume (no data to preserve)
4. Start new container: `docker compose up -d qdrant`
5. Verify health: `curl http://192.168.10.11:6333/healthz`
6. Restart backend to trigger `ensureCollection()` (recreates `lcbp3_vectors`)

**Key v1.18 Features Gained**:
- Named vectors add/remove (critical for ADR-023A embedding model migration)
- TurboQuant (8x vector compression)
- Memory monitoring API
- Audit logging improvements

### RT-004: Qdrant Client Compatibility (`@qdrant/js-client-rest`)

**Decision**: Bump from `^1.17.0` to `^1.18.0` if compatibility issues arise

**Rationale**:
- Backend currently uses `@qdrant/js-client-rest: ^1.17.0`
- Qdrant MCP server (`@infoinlet/mcp-qdrant`) uses `@qdrant/js-client-rest: ^1.11.0` (resolved to 1.18.0)
- Client v1.17 should work with server v1.18 (minor version difference), but may show warnings
- Client v1.18 is the matching version for server v1.18
- Codebase uses `client.search()` which is NOT deprecated (deprecated methods were legacy search endpoints)

**Action Items**:
- After Qdrant upgrade, run AI module tests
- If compatibility warnings appear, bump `@qdrant/js-client-rest` to `^1.18.0` in `backend/package.json`
- Re-run `pnpm install` and tests after bumping

### RT-005: MCP Server Package Verification

**Decision**: All 5 MCP server packages verified as functional (with notes)

**Rationale**:
- **Redis MCP** (`@modelcontextprotocol/server-redis@2025.4.25`): Deprecated but functional — connected successfully to `redis://192.168.10.11:6379`. Monitor for replacement package.
- **Qdrant MCP** (`@infoinlet/mcp-qdrant@0.1.1`): Read-only, 6 tools (list_collections, collection_info, scroll, count, search, health). Requires Qdrant v1.18 for client compatibility.
- **Memory MCP** (`@modelcontextprotocol/server-memory@2026.7.4`): Knowledge Graph server — started successfully on stdio. Fulfills the `mcp3_*` tools documented in `.devin/rules/16-mcp-memory-tools.md`.
- **Fetch MCP** (`mcp-fetch-server@1.1.2`): HTTP fetch server — started successfully. Useful for testing DMS API, n8n webhooks, Ollama endpoints.
- **Gitea MCP** (`@amonstack/gitea-mcp@0.4.0`): Requires Node >=24. Gitea API token created (`devin-mcp-token`, scopes: `write:issue`, `read:repository`). Configured with `GITEA_BASE_URL=http://192.168.10.11:3003`.

**Gitea Token Details**:
- Token name: `devin-mcp-token`
- Token ID: 2
- Scopes: `write:issue`, `read:repository`
- Token SHA1: `7f6fa738f5b3cfe6731550ea173dd831a8ea390a`
- Stored in `~/.config/devin/mcp_config.json` (outside repo — safe from git exposure)

### RT-006: Docker Compose Qdrant Configuration

**Decision**: Update image tag in `01-infrastructure/docker-compose.yml` only

**Rationale**:
- Qdrant service is defined in `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure/docker-compose.yml`
- Current image: `qdrant/qdrant:v1.16.1`
- Target image: `qdrant/qdrant:v1.18.1`
- Port mapping (6333->6333, 6334) stays the same
- Environment variables stay the same (`QDRANT__SERVICE__GRPC_PORT: '6334'`, `QDRANT__LOG_LEVEL: 'INFO'`)
- Volume mount stays the same (but will be empty after recreation)

**Verification**:
- `docker pull qdrant/qdrant:v1.18.1` — already confirmed available
- Health check endpoint: `http://192.168.10.11:6333/healthz` — returns "healthz check passed"
- Collections endpoint: `http://192.168.10.11:6333/collections` — currently returns `lcbp3_vectors` (will be empty after upgrade, recreated by backend)

---

## Implementation Deviations (Post-Execution Notes)

### Deviation 1: Qdrant Volume Persisted

**Expected**: Qdrant collections would be empty after upgrade (volume removed).
**Actual**: The `docker compose down qdrant` command removed the container but no named volume was found (Qdrant used an anonymous volume or bind mount that persisted). The `lcbp3_vectors` collection remained after upgrade.
**Impact**: None — collection was recreated by backend's `ensureCollection()` regardless, and there was no production data to lose.

### Deviation 2: @qdrant/js-client-rest Not Bumped

**Expected**: Might need to bump from `^1.17.0` to `^1.18.0` if compatibility issues arose.
**Actual**: Client v1.17.0 works fine with Qdrant server v1.18.1. Backend successfully connected, recreated collection, and all AI module tests passed (321 passed, 0 failed). The only warnings were from mocked test clients unable to check server version (expected in unit tests).
**Impact**: None — no bump needed.

### Deviation 3: pnpm Global Install Permission Error

**Expected**: `npm i -g pnpm@10` would reinstall pnpm.
**Actual**: Permission error when trying to install globally. However, pnpm 10.33.0 was already installed at `/usr/local/bin/pnpm` and functional with Node v24.
**Impact**: None — pnpm was already at the correct version and works with Node v24.

### Deviation 4: Node.js Version Installed is v24.18.1 (not v24.15.0)

**Expected**: Node.js v24.15.0 (as specified in .nvmrc from feature 103).
**Actual**: NodeSource installed v24.18.1 (latest LTS security release as of 2026-07-29).
**Impact**: None — v24.18.1 is a newer patch version within the same LTS line. .nvmrc files still show 24.15.0 (set by feature 103) which is acceptable since nvm will install 24.15.0 for local development, while the host system runs 24.18.1.

