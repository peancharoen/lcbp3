// File: specs/200-fullstacks/231-hermes-agent/data-model.md
// Change Log:
// - 2026-05-29: Initial data model for Hermes Agent

# Data Model: Hermes Agent

**Feature**: 231-hermes-agent | **Date**: 2026-05-29

> **Important**: Hermes ไม่เพิ่มหรือแก้ DMS production schema ทุกกรณี (ADR-031, FR-017)
> Data model นี้ทั้งหมดอยู่ใน **Hermes-owned storage** (SQLite / container volume) ไม่ใช่ DMS MariaDB

---

## 1. HermesOperationsLog (SQLite table: `hermes_operations_log`)

บันทึก inbound/outbound DevOps operations ทุก transaction ของ Hermes

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT (UUIDv7) | PRIMARY KEY | Transaction ID — ใช้ UUIDv7 ตาม ADR-019 |
| `operator_identity` | TEXT | NOT NULL | Telegram user ID หรือ CLI session identity |
| `command_type` | TEXT | NOT NULL | เช่น `TELEGRAM_INBOUND`, `TELEGRAM_OUTBOUND`, `ORCHESTRATION_TASK`, `GIT_WRITE` |
| `target_system` | TEXT | NOT NULL | เช่น `TELEGRAM`, `GITEA`, `CLOUD_AI`, `DEV_QDRANT` |
| `command_summary` | TEXT | NOT NULL | Redacted command description (ห้ามมี secret/token/sensitive path) |
| `status` | TEXT | NOT NULL | `PENDING` / `IN_PROGRESS` / `COMPLETED` / `FAILED` / `REJECTED` |
| `created_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `completed_at` | DATETIME | NULLABLE | |
| `error_classification` | TEXT | NULLABLE | เช่น `AUTH_FAILURE`, `RATE_LIMIT`, `FORBIDDEN_ACTION`, `EXTERNAL_API_ERROR` |
| `gitea_token_identity` | TEXT | NULLABLE | Token scope/identity สำหรับ Git write actions (ไม่ใช่ token value) |
| `target_repo` | TEXT | NULLABLE | สำหรับ Git write actions |
| `target_branch` | TEXT | NULLABLE | สำหรับ Git write actions |

**Retention**: 90 วัน แล้ว archive/delete ตาม DevOps log policy
**Access**: Read เฉพาะ admin/operator ที่จำเป็น
**Redaction**: `command_summary` ต้องผ่าน secret scanner ก่อน insert

---

## 2. HermesRateLimitState (Redis key pattern)

| Key Pattern | Value | TTL | Description |
|-------------|-------|-----|-------------|
| `hermes:telegram:{telegramUserId}` | INT (request count) | 60s | Rate limit counter per user; expire ทุก 60 วินาที |

---

## 3. HermesBullMQJobs (Redis via `hermes-notification-queue`)

### Job: `telegram-devops-outbound`

| Field | Type | Description |
|-------|------|-------------|
| `transactionId` | string (UUIDv7) | Reference ID for tracking |
| `chatId` | string | Telegram chat ID |
| `message` | string | Outbound message text (ไม่มี secret/PII) |
| `retryCount` | number | Current retry count (max 3) |

---

## 4. HermesOrchestrationTask (Redis via `hermes-orchestration-queue`)

### Job: `orchestration-task`

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string (UUIDv7) | Task tracking ID |
| `taskType` | `DEVOPS` / `DMS_FEATURE` / `SCHEMA_DB` / `BUG_FIX` | กำหนด context loading strategy |
| `description` | string | Task description (no production data) |
| `contextSources` | string[] | Context files to load |
| `maxIterations` | number | Self-correction loop limit (default: 3) |
| `telegramChatId` | string | สำหรับ progress/result notification |
| `createdAt` | string (ISO 8601) | |

---

## 5. SOUL.md (Container File: `/volume1/docker/hermes/SOUL.md`)

ไม่ใช่ DB table แต่เป็น plain Markdown file working journal ใน container volume

**Structure per session entry**:
```markdown
## Session {ISO_DATETIME}
Task: {task description}
TaskType: {DEVOPS|DMS_FEATURE|SCHEMA_DB|BUG_FIX}
Context loaded: {comma-separated context files}
Sub-agents delegated: {count} code generation calls
Iterations: {count} ({result of last iteration})
PR created: {branch} → #{pr_number}
Status: {DONE|ESCALATED|FAILED}
```

**File management**:
- Read at session start for context resumption
- Append only (never overwrite previous entries)
- Rotate (clear and archive) every 30 days or manual clear
- Never synced to repo — container volume only

---

## 6. DevQdrantCollection (`lcbp3_code_chunks` on ASUSTOR:6334)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Chunk ID |
| `repoName` | string | Repository name (e.g., `lcbp3`) |
| `moduleName` | string | Module path (e.g., `backend/src/modules/correspondence`) |
| `filePath` | string | Relative file path |
| `chunkIndex` | number | Chunk position in file |
| `content` | string | Code chunk text |
| `vector` | float[] | nomic-embed-text embedding (768 dimensions) |

> **ไม่ใช้ `projectPublicId` filter** (ซึ่งเป็น DMS document isolation key) — ใช้ `repoName` + `moduleName` แทน ตาม ADR-031 v2.0

---

## Entity Relationships

```
HermesAgent
  ├── orchestrates → HermesOrchestrationTask (via hermes-orchestration-queue)
  │     ├── delegates → HermesSubAgent (Cloud AI: Claude Haiku / GPT-4o-mini)
  │     ├── searches → DevQdrantCollection (code patterns)
  │     └── records → SOUL.md (session journal)
  └── bridges → HermesTelegramGateway
        ├── validates → HermesRateLimitState (Redis)
        ├── records → HermesOperationsLog (SQLite)
        └── dispatches → HermesBullMQJobs (hermes-notification-queue)
              └── sends → Telegram API
```

---

## State Transitions: HermesOperationsLog.status

```
PENDING → IN_PROGRESS → COMPLETED
                      → FAILED
         → REJECTED (allowlist/rate-limit/forbidden-action check)
```

## State Transitions: HermesOrchestrationTask

```
QUEUED → CONTEXT_LOADING → SUB_AGENT_DELEGATED
                         → SELF_CORRECTION (max 3 iterations)
                         → PR_CREATED → DONE
                         → ESCALATED (>3 iterations, notify Developer)
                         → FAILED
```
