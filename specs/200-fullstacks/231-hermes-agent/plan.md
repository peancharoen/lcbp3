// File: specs/200-fullstacks/231-hermes-agent/plan.md
// Change Log:
// - 2026-05-29: Initial implementation plan for Hermes Agent (ADR-031 v2.0)

# Implementation Plan: Hermes Agent — Autonomous Dev Orchestrator & Telegram DevOps Bridge

**Branch**: `231-hermes-agent` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/200-fullstacks/231-hermes-agent/spec.md`

---

## Summary

Hermes Agent เป็น standalone NestJS service รันบน ASUSTOR Docker ทำหน้าที่ 2 บทบาทหลัก:
1. **Autonomous Dev Orchestrator** — รับ coding task, delegate ไป Cloud AI sub-agents, รัน self-correction loop, push PR via hermes-bot
2. **Telegram DevOps Bridge** — webhook handler สำหรับ DevOps commands พร้อม allowlist + rate-limit + operations log

Hermes ไม่แตะ DMS production schema หรือ DMS production services ทุกกรณี (FR-017, ADR-031)

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22 LTS
**Primary Dependencies**:
- NestJS 10 (framework)
- BullMQ 5 (queue: hermes-notification-queue + hermes-orchestration-queue)
- `@anthropic-ai/sdk` + `openai` npm packages (Cloud AI clients)
- `better-sqlite3` (hermes_operations_log SQLite)
- `ioredis` (rate limiting + BullMQ)
- `@qdrant/js-client-rest` (Dev Qdrant client)
- `node-telegram-bot-api` or `telegraf` (Telegram Bot SDK)
- `simple-git` (Git operations via hermes-bot)
- `uuid` v7 (UUIDv7 generation — ADR-019)

**Storage**:
- SQLite (`/volume1/docker/hermes/data/ops.db`) — HermesOperationsLog
- Redis (hermes-redis container) — BullMQ queues + rate limiting
- Dev Qdrant (hermes-qdrant container, port 6334) — codebase embeddings
- File volume (`/volume1/docker/hermes/SOUL.md`) — SOUL.md working journal

**Testing**: Jest (unit + integration); no E2E browser tests required

**Target Platform**: ASUSTOR NAS (Linux ARM/x86) — Docker container, non-Swarm
**Performance Goals**:
- Telegram read-only commands: ≤ 10s response (SC-003)
- Coding task PR creation: ≤ 30 min typical (SC-001)
- Self-correction loop: ≤ 3 iterations (SC-002)

**Constraints**:
- CPU ≤ 2.0 cores, RAM ≤ 4096MB (ASUSTOR resource limits)
- LAN/VPN-only exposure (except Telegram webhook via reverse proxy)
- ห้ามใช้ DMS production Redis, DMS Qdrant, DMS audit_logs
- Cloud AI: ห้ามส่ง production DB query results, document content, user data
- Port 8766 สำหรับ hermes proxy เท่านั้น (ห้ามใช้ 8765 ที่ PaddleOCR ใช้อยู่)

**Scale/Scope**: Single DevOps team tool (2-5 concurrent users); not production DMS service

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Rule | Status | Notes |
|------|--------|-------|
| ADR-019: UUIDv7, no parseInt | ✅ PASS | transactionId ใช้ UUIDv7; ไม่มี parseInt บน UUID |
| ADR-016: Auth/RBAC | ✅ PASS | API Key auth + Telegram allowlist; webhook secret verification |
| ADR-007: Error handling | ✅ PASS | BullMQ retry 3x exponential backoff; ADR-007 error classification |
| ADR-008: BullMQ | ✅ PASS | `hermes-notification-queue` + `hermes-orchestration-queue` |
| ADR-023/023A: AI boundary | ✅ PASS | Cloud AI exception (ADR-031 v2.0 Locked) สำหรับ dev orchestration; ไม่ใช่ DMS document path |
| ADR-009: No migration | ✅ PASS | ไม่มี DMS schema delta; Hermes-owned SQLite ไม่ใช่ DMS DB |
| No `any` TypeScript | ✅ PASS | strict mode; all types explicit |
| No `console.log` | ✅ PASS | NestJS Logger ทั้งหมด |
| Forbidden patterns | ✅ PASS | ไม่มี parseInt(UUID), ไม่ expose INT PK, ไม่มี inline notification |
| File headers | ✅ PASS | ทุก TypeScript file เริ่มด้วย `// File: ...` |
| Data Classification | ✅ PASS | Code/Config/ADR ส่ง Cloud AI ได้; Production data ห้ามส่งออก |
| Failure isolation | ✅ PASS | Hermes ไม่ใช่ DMS dependency; DMS ทำงานได้โดยไม่มี Hermes |

**No constitution violations. Proceed.**

---

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/231-hermes-agent/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── hermes-api.yaml  # OpenAPI contract
└── tasks.md             # Phase 2 output
```

### Source Code (new Hermes stack — NOT part of backend/ or frontend/)

```text
hermes/
├── src/
│   ├── orchestrator/
│   │   ├── orchestrator.module.ts
│   │   ├── orchestrator.service.ts          # Autonomous dev loop
│   │   ├── context-loader.service.ts        # Selective context loading
│   │   ├── sub-agent.service.ts             # Cloud AI delegation
│   │   ├── self-correction.service.ts       # Lint/tsc/test loop (max 3 iter)
│   │   └── soul.service.ts                  # SOUL.md journal management
│   ├── integrations/
│   │   ├── telegram/
│   │   │   ├── telegram.module.ts
│   │   │   ├── hermes-telegram-gateway.ts   # Inbound webhook handler
│   │   │   ├── hermes-telegram-dispatcher.ts # BullMQ outbound worker
│   │   │   ├── hermes-devops-command-router.ts # Command routing
│   │   │   └── telegram-rate-limiter.service.ts
│   │   ├── gitea/
│   │   │   ├── gitea.module.ts
│   │   │   └── gitea.service.ts             # Gitea API (read-only + write-with-confirmation)
│   │   └── mcp/
│   │       ├── mcp.module.ts
│   │       └── mcp-server.service.ts        # Exposes hermes MCP tools endpoint
│   ├── proxy/
│   │   ├── proxy.module.ts
│   │   └── proxy.service.ts                 # hermes proxy (OpenAI-compatible, port 8766)
│   ├── operations/
│   │   ├── operations.module.ts
│   │   ├── operations-log.service.ts        # SQLite hermes_operations_log
│   │   └── operations.controller.ts         # /operations/logs API
│   ├── qdrant/
│   │   ├── qdrant.module.ts
│   │   └── dev-qdrant.service.ts            # Dev Qdrant client (port 6334)
│   ├── health/
│   │   ├── health.module.ts
│   │   └── health.controller.ts             # /health endpoint
│   ├── common/
│   │   ├── guards/
│   │   │   ├── api-key.guard.ts             # X-API-Key validation
│   │   │   └── telegram-allowlist.guard.ts  # Allowlist check
│   │   ├── interceptors/
│   │   │   └── transaction.interceptor.ts   # Auto-inject transactionId
│   │   └── utils/
│   │       ├── uuid.util.ts                 # UUIDv7 generation (ADR-019)
│   │       └── secret-redactor.util.ts      # Redact secrets from log payload
│   ├── config/
│   │   └── hermes.config.ts                 # All env vars typed
│   ├── app.module.ts
│   └── main.ts
├── test/
│   ├── unit/
│   │   ├── telegram-gateway.spec.ts
│   │   ├── command-router.spec.ts
│   │   ├── orchestrator.spec.ts
│   │   └── secret-redactor.spec.ts
│   └── integration/
│       └── staged-rollout.spec.ts
├── specs/                                   # Docker compose + config
│   └── 04-Infrastructure-OPS/
│       └── 04-00-docker-compose/
│           └── ASUSTOR/
│               └── hermes/
│                   ├── docker-compose.hermes.yml
│                   ├── docker-compose.hermes-redis.yml
│                   ├── docker-compose.hermes-qdrant.yml
│                   ├── hermes.redis.conf
│                   └── .env.example         # เฉพาะ placeholder ห้าม commit secret จริง
├── .env.example
├── Dockerfile
├── nest-cli.json
├── package.json
└── tsconfig.json
```

**Structure Decision**: Standalone NestJS project (`hermes/`) แยกจาก `backend/` และ `frontend/` ทั้งหมด เพราะ Hermes ไม่ใช่ DMS production service และมี deploy target แยก (ASUSTOR NAS) รวมถึงมี Redis/SQLite/Qdrant ของตัวเอง

---

## Implementation Phases

### Phase 1: Setup & Infrastructure Foundation

- สร้าง `hermes/` project structure (NestJS + TypeScript strict)
- Docker Compose files (hermes agent + hermes-redis + hermes-qdrant)
- Config module (typed env vars + secrets validation)
- HealthController + basic API Key guard

### Phase 2: Core Foundational Services

- OperationsLogService (SQLite + create/read/update)
- SecretRedactorUtil (scan + redact sensitive patterns)
- UuidUtil (UUIDv7 generation)
- TransactionInterceptor (auto-inject transactionId per request)

### Phase 3: US1 — Autonomous Dev Orchestrator (P1)

- ContextLoaderService (selective context loading by task type)
- SubAgentService (Claude Haiku/GPT-4o-mini delegation)
- SelfCorrectionService (lint/tsc/test loop, max 3 iterations)
- OrchestratorService (main development loop coordination)
- OrchestratorController (POST /orchestration/tasks, GET /orchestration/tasks/:id)
- SoulService (SOUL.md read/append/rotate)
- DevQdrantService (hermes-qdrant client, code chunk search)

### Phase 4: US2 — Telegram Read-only Commands (P2)

- TelegramRateLimiterService (Redis-based, 10 req/min/user)
- HermesTelegramGateway (webhook verification, allowlist check, rate limit)
- HermesDevOpsCommandRouter (route read-only commands: /status, /ci_status, /repo_summary)
- GiteaService (read-only: repos, issues, PRs, CI status)
- HermesTelegramDispatcher (BullMQ worker, hermes-notification-queue, retry 3x backoff)

### Phase 5: US3 — Telegram Write-with-Confirmation (P3)

- Write action confirmation flow (HermesDevOpsCommandRouter extension)
- GiteaService write methods (create branch/issue/PR/trigger CI — write token scope)
- Forbidden action blocklist enforcement
- hermes-bot Git identity integration (simple-git + hermes-bot service account)
- Branch pattern validation (hermes/{feat,fix,refactor}-*)
- Operations log write action recording (token identity, target repo/branch)

### Phase 6: US4 — Developer AI Proxy (P4)

- ProxyService (OpenAI-compatible API, port 8766)
- Secret payload detection middleware (reject if production data detected)
- MCP server endpoint (/mcp) for agy + Windsurf integration
- HermesMemoryMcpTool (expose DMS context for agy recall)
- HermesToolsMcpTool (expose bash/git execution capability)

### Phase 7: US5 — Staged Rollout Tooling (P5)

- Stage acceptance gate checklist scripts (PowerShell/bash)
- Monitoring alerts (DevOps warning vs. production outage separation)
- Failure isolation verification tests
- Rollback documentation finalization

### Phase 8: Polish & Cross-Cutting

- Structured logging with NestJS Logger (no console.log)
- JSDoc for all public classes (Thai comments per AGENTS.md)
- Secret scan validation in CI pipeline
- Docker resource limit verification script
- SOUL.md rotation cron job

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hermes stack | Standalone NestJS | แยกจาก DMS backend; same tooling; ทีมรู้จักดี |
| Cloud AI | Anthropic SDK + OpenAI SDK | ADR-031 Cloud AI Exception; model flexibility |
| Operations log | SQLite (better-sqlite3) | Simple, no external service, queryable |
| Rate limiting | Redis-based (ioredis) | Stateless container-safe; shares hermes-redis |
| Git operations | simple-git | Lightweight; TypeScript-native |
| Dev Qdrant | Port 6334 (ASUSTOR) | แยกจาก DMS Qdrant port 6333 (QNAP) |
| Telegram SDK | telegraf or node-telegram-bot-api | ต้อง verify ตอน implementation (ADR-031 note) |
