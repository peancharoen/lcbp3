# ADR-031: Hermes Agent — Autonomous Dev Orchestrator & Telegram DevOps Bridge (v2.0)

## Status

- **Status:** Draft
- **Date:** 2026-05-28
- **Version:** 2.0 (2026-05-29 — grill-with-docs: Orchestration as primary concern)
- **Deciders:** NAP-DMS Architecture Team
- **Supersedes:** ADR-031 v1.1 (DevOps Bridge only)

### Locked Decisions (v1.x — DevOps Bridge Foundation)

ข้อตกลงด้านล่างถูกล็อคตั้งแต่ v1.x และยังคงบังคับใช้ใน v2.0:

* **Hermes role:** Hermes เป็น Developer Operations Agent / Autonomous Dev Orchestrator ไม่ใช่ production DMS service และไม่ใช่ AI inference boundary ของ DMS
* **Database access:** Hermes เชื่อม MariaDB ได้เฉพาะ read-only account สำหรับ schema inspection, metadata diagnostics เท่านั้น
* **Document storage:** Hermes ห้าม mount, browse, หรืออ่าน permanent document storage ของ production โดยตรง
* **Telegram scope:** Hermes Telegram ใช้สำหรับ DevOps commands เท่านั้น ไม่ใช่ production DMS command channel
* **DMS Telegram:** Telegram command สำหรับ query/mutate เอกสารจริงเป็น future separate ADR/spec
* **Hermes proxy:** `hermes proxy` เป็น Developer AI Proxy only ไม่ใช่ DMS AI runtime
* **Telegram writes:** ต้องมี explicit confirmation; push `main`/`master`, production deploy, schema migration, direct DB writes, storage delete ห้ามทุกกรณี
* **Schema rollout:** ADR-031 ไม่เพิ่มหรือแก้ production DMS schema

### Locked Decisions (v2.0 — Orchestration Layer)

ข้อตกลงใหม่จาก grill session 2026-05-29:

* **Cloud AI Exception:** Hermes Orchestrator layer อนุญาต Cloud AI API (Claude/GPT-4o) ได้ — เป็น exception จาก ADR-023A ที่ใช้เฉพาะ DevOps/Dev Orchestration layer เท่านั้น ไม่ใช่ DMS document processing
* **Data Classification (Dev-Out Policy):** Code, Config, ADR, Stack trace ส่ง Cloud AI ได้ — Production runtime data จาก DB query (document content, user info, project business data) ห้ามส่งออกทุกกรณี
* **Dev Qdrant:** Separate Qdrant instance บน ASUSTOR สำหรับ codebase embedding โดยเฉพาะ — ห้ามใช้ Qdrant instance เดียวกับ DMS document RAG (ADR-023A)
* **SOUL.md:** Hermes working journal อยู่ใน container เท่านั้น (`/volume1/docker/hermes/SOUL.md`) ไม่ sync กลับ repo
* **Context Source:** Hermes ดึง project context จาก `specs/06-Decision-Records/CONTEXT-ADR-031.md` + `AGENTS.md` โดยตรง ไม่ใช้ Obsidian หรือ external knowledge base
* **Sub-agent Delegation:** Hermes orchestrate โดย (1) Cloud sub-agents ใช้ model เล็กกว่า (Claude Haiku/GPT-4o-mini) สำหรับ code generation tasks และ (2) MCP invocations ไปยัง Windsurf/agy ที่มีอยู่แล้ว
* **Git Identity:** Hermes ใช้ Gitea service account (`hermes-bot`) push เฉพาะ `hermes/*` branches — ห้าม push ตรง `main`/`develop` ทุกกรณี — ทุก change ต้องผ่าน PR ที่ human approve

## Context

การตั้งค่าระบบ **Hermes Agent** ในโปรเจกต์ **NAP-DMS (LCBP3)** เพื่อทำหน้าที่เป็น **Autonomous Development Loop Orchestrator** — ควบคุมงาน AI Coding ทั้งหมด วาง Roadmap จ่ายงานให้ sub-agents ตรวจสอบผลลัพธ์ และสร้าง PR สำหรับ human review

ใน v2.0 Hermes มี 2 primary roles:
1. **Autonomous Dev Orchestrator** (primary) — คุม development loop ตั้งแต่ requirement จนถึง PR
2. **Telegram DevOps Bridge** (subsystem) — DevOps commands, CI status, Gitea notifications

Hermes ไม่ใช่ production DMS service และไม่ใช่ DMS AI inference boundary (ADR-023/ADR-023A) แต่ได้รับ **Cloud AI exception** สำหรับ dev orchestration layer โดยเฉพาะ พร้อม Data Classification Policy ที่ชัดเจน

## Decision

ใช้ Approach B (Local Development Network) พร้อมควบคุมทรัพยากร (CPU/RAM) และใช้ API Key Authentication สำหรับ CLI Tools

## Consequences

### Infrastructure Setup (Approach B - Local Development)

* **Hermes Agent:** รันบน ASUSTOR NAS ภายใน Docker Network `lcbp3` โดยมีการจำกัดทรัพยากร (Resource Limits) เพื่อป้องกันผลกระทบต่อระบบหลักของ NAS และทำหน้าที่เป็น Developer Operations Agent / Integration Assistant เท่านั้น
* **Resource Allocation:**
  * CPU Limit: 2.0 Cores
  * RAM Memory: 2GB (Reservation) / 4GB (Limit)

* **Environment:** เน้นการพัฒนาในรูปแบบ Local Development โดยให้ Agent สื่อสารกับ Gitea และแหล่งข้อมูลตรวจสอบแบบ read-only ภายในเครือข่ายเท่านั้น
* **Database Access Boundary:** Hermes สามารถเชื่อมต่อ MariaDB เพื่อการตรวจสอบแบบ read-only ได้เฉพาะผ่าน read-only replica หรือ read-only DB account ที่ฐานข้อมูลบังคับสิทธิ์เอง ใช้สำหรับ schema inspection, metadata diagnostics, และ query verification เท่านั้น ห้ามเขียน production DB ทุกกรณี
* **Data Minimization Boundary:** read-only DB account ของ Hermes ต้องเห็นเฉพาะ schema metadata และข้อมูล operational/devops ที่จำเป็น หากต้อง query ตาราง DMS จริงต้องใช้ masked read-only replica หรือ database view ที่ redact PII/document-sensitive fields เช่น เนื้อหาเอกสาร, storage path, token, password hash, และข้อมูลผู้ใช้ละเอียด
* **Storage Access Boundary:** Hermes ห้าม mount, browse, หรืออ่าน permanent document storage ของ production โดยตรง หากต้องตรวจสอบเอกสารจริงต้องเรียกผ่าน DMS Backend API ที่ผ่าน RBAC, audit, และ project isolation controls เท่านั้น

### Security & Access Control Strategy

* **Authentication:** ใช้ระบบ **API Key** ในการเข้าถึง Hermes Agent จาก CLI Tools (Antigravity/Codex) บน Local Desktop
* **Hermes Proxy Boundary:** `hermes proxy` เป็น Developer AI Proxy สำหรับ coding/devops assistance เท่านั้น ไม่ใช่ DMS AI runtime, ไม่ใช่ document intelligence path, และห้ามใช้กับ production document payload, secrets, หรือข้อมูลเอกสารจริง
* **Network Exposure Boundary:** Hermes services (`:8080`, `:8766`, `/mcp`, และ internal tool endpoints) ต้อง expose เฉพาะ LAN/VPN ที่จำเป็น ห้ามเปิด public internet โดยตรง หาก Telegram webhook ต้องรับ traffic จาก internet ให้ terminate ผ่าน reverse proxy ที่มี TLS, Telegram secret token verification, IP/rate limit, และ request logging
* **Secret Management Boundary:** `HERMES_PROXY_API_KEY`, Telegram bot token, webhook secret, Gitea token, และ read-only DB credential ห้ามอยู่ใน repo/spec/plain `.env` ที่ commit ได้ ต้องเก็บใน ASUSTOR secret store หรือไฟล์ environment นอก repo ที่จำกัด permission และมี rotation plan
* **Gitea Token Boundary:** Hermes ต้องใช้ Gitea token แบบ least privilege โดย default เป็น read-only สำหรับ repo/issue/PR status และใช้ write token แยกเฉพาะ action ที่ผ่าน confirmation แล้ว ห้ามใช้ admin token หรือ token ที่ push ไป `main`/`master` ได้
* **Operations Log Boundary:** `hermes_operations_log` เป็น log store ของ Hermes เอง เช่น SQLite/Postgres volume ภายใน Hermes stack หรือ structured log file ที่ ship ไป log collector ไม่ใช่ `audit_logs` ของ DMS และต้องมี retention/redaction policy
* **Failure Isolation Boundary:** Hermes เป็น optional DevOps assistant เท่านั้น หาก Hermes, Telegram Bridge, MCP, หรือ hermes proxy ล่ม ต้องไม่กระทบ DMS production, Workflow Engine, AI pipeline, หรือ user-facing app
* **Validation Boundary:** ข้อมูลทั้งหมดที่ส่งผ่าน CLI, MCP หรือ AI จะต้องอ้างอิงผ่าน `publicId` (UUIDv7) เท่านั้น ห้ามเปิดเผยหรือใช้งาน `INT AUTO_INCREMENT` ภายนอกเด็ดขาด (ADR-019)
* **Repository Gate Compliance:** Hermes ต้องเคารพ repo gates เดิมทั้งหมดตาม `AGENTS.md`, lint, tests, CI, และ branch protection; ADR-031 ไม่เป็นเจ้าของ Git Hooks policy และไม่เพิ่ม hook ใหม่
* **Telegram Access Check:** Hermes Telegram ต้องใช้ allowlist/admin mapping สำหรับ DevOps commands เท่านั้น หากมี DMS Telegram module ในอนาคต ต้องแยก implementation และตรวจสอบสิทธิ์ผ่าน CASL Guard ของ DMS API เสมอ

---

## Orchestration Architecture (v2.0 — Primary Concern)

### Overview: Autonomous Development Loop

Hermes ทำหน้าที่เป็น "Lead Developer" / "Conductor" ที่คุม development loop ทั้งหมด โดยไม่ลงไปเขียนโค้ดทุกบรรทัดเอง แต่วางแผน จ่ายงาน ตรวจสอบผลลัพธ์ และสร้าง PR:

```
[Developer / Telegram Command]
        │
        ▼
┌─────────────────────────────────────────┐
│  Hermes Orchestrator (Flagship Cloud AI) │
│  Claude / GPT-4o                         │
│  Context: CONTEXT-ADR-031.md + AGENTS.md │
│  Memory:  SOUL.md (container-local)      │
│  Search:  Dev Qdrant (ASUSTOR)           │
└──────────┬──────────────────────────────┘
           │
   ┌───────┴────────┐
   ▼                ▼
[Cloud Sub-agents]  [MCP Tool Invocations]
Claude Haiku /      Windsurf / agy / Codex
GPT-4o-mini         (existing tools, no new models)
   │                ▼
   └────────┬───────
            ▼
   [Self-Correction Loop]
   npm run lint / jest / tsc
   → Error? Re-delegate to sub-agent
   → Pass? Continue
            │
            ▼
   [Git: hermes/* branch]
   hermes-bot commits
   Creates PR → Human Review & Approve
```

### Step 1: Requirement & Context Assembly

Hermes โหลด context แบบ **selective** ตาม task type เพื่อลด token ที่ส่งไป Cloud AI:

| Task Type | Context ที่โหลด |
|-----------|----------------|
| DevOps / CI / Git | `CONTEXT-ADR-031.md` + `AGENTS.md` |
| DMS feature coding | `CONTEXT-ADR-031.md` + `AGENTS.md` + `CONTEXT.md` |
| Schema / DB work | `CONTEXT-ADR-031.md` + `AGENTS.md` + `CONTEXT.md` + schema SQL (read-only) |
| Bug fix / refactor | `CONTEXT-ADR-031.md` + `AGENTS.md` + Dev Qdrant (code patterns) |

**Sources:**
- `specs/06-Decision-Records/CONTEXT-ADR-031.md` — agent rules, project identity, tooling, infra paths
- `CONTEXT.md` (root) — domain terminology (Correspondence, RFA, Workflow Engine, AI concepts) — โหลดเฉพาะ DMS feature tasks
- `AGENTS.md` — TypeScript rules, forbidden patterns (no `any`, no `parseInt` on UUID), ADR references
- Dev Qdrant (ASUSTOR) — semantic code search หา reference patterns จาก codebase embeddings

**ห้ามดึง** production runtime data (DB query results, document content, user data) เข้า cloud AI context

### Step 2: Semantic Code Search (Dev Qdrant)

Hermes ใช้ Qdrant instance แยก (บน ASUSTOR, ไม่ใช่ DMS Qdrant) ทำ semantic search หา reference patterns ใน codebase:

```yaml
# docker-compose.hermes-qdrant.yml (ASUSTOR — แยกจาก DMS)
services:
  hermes-qdrant:
    image: qdrant/qdrant:latest
    container_name: hermes-qdrant
    volumes:
      - hermes_qdrant_data:/qdrant/storage
    ports:
      - "6334:6333"   # port แยกจาก DMS Qdrant (:6333)
    deploy:
      resources:
        limits:
          memory: 2G
```

Collection: `lcbp3_code_chunks` — indexed by `repoName` + `moduleName` (ไม่ใช่ `projectPublicId` ซึ่งเป็น DMS document isolation)

### Step 3: Sub-agent Delegation

Hermes แตกงานเป็น tasks แล้ว delegate ผ่าน 2 channels:

**Channel A — Cloud Sub-agents (Code Generation):**
```
Orchestrator (Claude/GPT-4o)
  → "เขียน NestJS service สำหรับ X"
  → Sub-agent (Claude Haiku / GPT-4o-mini)
  → Returns code diff
  → Orchestrator validates against AGENTS.md rules
```

**Channel B — MCP Tool Invocations (File Execution):**
```
Orchestrator
  → MCP hermes-tools: bash/git operations บน ASUSTOR
  → MCP mariadb: schema lookup (read-only)
  → MCP gitea: PR/issue management
  → Triggers Windsurf/agy ถ้า complex scaffolding needed
```

**Data Classification Enforcement:**
| ส่งได้ | ห้ามส่ง |
|--------|---------|
| Code snippets, patterns | Production DB query results |
| ADR/spec content | Document content (title, body) |
| Stack traces, error output | User data, project names from DB |
| Config files, tsconfig | API keys, tokens, passwords |
| Schema structure (column names) | Storage paths ที่มี PII |

### Step 4: Self-Correction Loop

โค้ดที่ sub-agent ส่งกลับมาต้องผ่าน validation ก่อนใช้:

```bash
# Hermes runs via MCP hermes-tools
npm run lint          # ESLint — ต้องผ่านทุก rule
npx tsc --noEmit      # TypeScript strict mode
npm test -- --passWithNoTests  # Jest tests ที่เกี่ยวข้อง
```

ถ้าพบ error → Hermes วิเคราะห์ output → ส่งกลับให้ sub-agent แก้ไข (max 3 iterations)
ถ้า iteration > 3 → หยุดและแจ้ง developer ผ่าน Telegram

### Step 5: Git Identity & PR Flow

```
hermes-bot commits → hermes/feat-{task-id} branch
  ├─ git config user.name "Hermes Bot"
  ├─ git config user.email "hermes-bot@np-dms.work"
  ├─ commit message: "feat(hermes): {task description}\n\nOrchestrated by Hermes ADR-031 v2.0"
  └─ push → Gitea → Create PR → assign to developer
```

**Git Identity Rules:**
- Service account: `hermes-bot` (Gitea, least privilege, write token เฉพาะ feature branches)
- Branch pattern: `hermes/feat-*`, `hermes/fix-*`, `hermes/refactor-*`
- ห้าม push ตรง `main`, `develop`, `release/*` ทุกกรณี
- PR ต้องผ่าน CI (lint + test) ก่อน merge
- Human ต้อง review และ approve ก่อน merge เสมอ — ห้าม auto-merge

### SOUL.md — Hermes Working Journal

`/volume1/docker/hermes/SOUL.md` เก็บ per-session working memory ของ Hermes:

```markdown
## Session 2026-05-29T10:30
Task: scaffold correspondence search feature
Context loaded: CONTEXT-ADR-031.md, backend/src/modules/correspondence/
Sub-agents delegated: 2 code generation calls
Iterations: 1 (lint pass first try)
PR created: hermes/feat-correspondence-search → #142
Status: DONE
```

- ไม่ commit ลง repo — อยู่ใน container volume เท่านั้น
- Hermes อ่าน SOUL.md ต้น session เพื่อ resume context
- Rotate ทุก 30 วัน หรือ manual clear

---

## Implementation Details

### 1. Infrastructure Configuration

#### Redis Persistence for BullMQ (Durability)

เพื่อให้ BullMQ queue ของ Hermes ทนทานต่อการ restart ของ ASUSTOR NAS ต้องกำหนดค่า Redis persistence โดยแยกจาก DMS production Redis เป็นค่า default:

```yaml
# docker-compose.hermes-redis.yml
services:
  hermes-redis:
    image: redis:7-alpine
    container_name: hermes_redis_lcbp3
    networks:
      - lcbp3_net
    volumes:
      - hermes_redis_data:/data
      - ./hermes.redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    restart: unless-stopped

volumes:
  hermes_redis_data:
    driver: local
```

```conf
# hermes.redis.conf - บันทึกข้อมูลทุก 60 วินาที หากมีการเปลี่ยนแปลงอย่างน้อย 1 key
save 60 1
save 300 10
save 900 10000

# เปิดใช้งาน AOF (Append-Only File) เพื่อ durability สูงสุด
appendonly yes
appendfsync everysec

# ชื่อไฟล์ AOF
appendfilename "appendonly.aof"

# จำกัด memory ใช้งานสูงสุด (ปรับตามสเปก NAS)
maxmemory 512mb
maxmemory-policy allkeys-lru
```

**ข้อดี:**
- หาก ASUSTOR restart ข้อมูลใน Hermes queue จะไม่สูญหาย
- AOF บันทึกทุก operation ทำให้สามารถ recovery ได้เกือบ 100%
- ไม่ปะปนกับ DMS production BullMQ/lock/cache keys

**Redis Isolation Policy:**

* Default คือ Hermes ใช้ Redis instance/volume แยกจาก DMS production Redis
* หาก resource จำกัดจนต้องใช้ Redis instance เดียวกับ DMS production ต้องกำหนด `keyPrefix`, DB index แยก, ACL user แยก, monitoring แยก, และ maxmemory policy ที่ไม่ evict DMS keys
* ห้ามใช้ `allkeys-lru` บน shared Redis ที่มี DMS locks/cache/queues เพราะอาจ evict key สำคัญของ DMS
* Hermes queue names ต้องขึ้นต้นด้วย `hermes-` เช่น `hermes-notification-queue`

#### Docker Compose (Hermes Agent with Resource Limits)

```yaml
version: '3.8'

networks:
  lcbp3_net:
    name: lcbp3
    external: true

services:
  hermes-agent:
    image: np-dms.work/hermes/agent:latest
    container_name: hermes_agent_lcbp3
    networks:
      - lcbp3_net
    environment:
      - DATABASE_HOST=mariadb_container_name
      - DATABASE_PORT=3306
      - GITEA_URL=http://gitea_container_name:3000
      - HERMES_ENV=local_dev
    # Non-Swarm Docker Compose fallback. ตรวจสอบว่า ASUSTOR runtime enforce จริงด้วย docker inspect/stats
    cpus: '2.0'
    mem_reservation: 2048M
    mem_limit: 4096M
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4096M
        reservations:
          memory: 2048M
    restart: unless-stopped
```

> **Resource Limit Note:** `deploy.resources` อาจถูก ignore ใน Docker Compose แบบ non-Swarm บน ASUSTOR ได้ จึงต้องกำหนด fallback (`cpus`, `mem_reservation`, `mem_limit`) และ verify จาก runtime ด้วย `docker inspect`/`docker stats` ทุกครั้ง

#### API Key Configuration

ตัวอย่างบนเครื่องพัฒนา Windows PowerShell:

```powershell
# คอนฟิกค่า API Key ลงในตัวแปรระบบของเครื่องพัฒนา
$env:ANTIGRAVITY_API_KEY = "hermes_secure_api_key_v1_9_0"
$env:CODEX_API_KEY = "hermes_secure_api_key_v1_9_0"

# ตัวอย่างการเรียกใช้งาน CLI
antigravity-cli sync --target hermes_agent_lcbp3:8080 --key $env:ANTIGRAVITY_API_KEY
```

#### MCP Server Configuration

ตัวอย่างด้านล่างเป็น template เท่านั้น ต้อง verify package/command ของ MCP server จริงตอน implementation และห้าม commit credential จริงลง config:

```json
{
  "mcpServers": {
    "lcbp3-mariadb-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres-mariadb",
        "--host", "${HERMES_MARIADB_READONLY_HOST}",
        "--port", "${HERMES_MARIADB_READONLY_PORT}",
        "--db", "${HERMES_MARIADB_READONLY_DATABASE}",
        "--user", "${HERMES_MARIADB_READONLY_USER}",
        "--password", "${HERMES_MARIADB_READONLY_PASSWORD}"
      ],
      "description": "Read-only schema/metadata diagnostics only. Verify MCP package and CLI before rollout."
    },
    "lcbp3-gitea-mcp": {
      "command": "node",
      "args": ["./scripts/gitea-mcp-bridge.js"],
      "env": {
        "GITEA_TOKEN": "${HERMES_GITEA_TOKEN}",
        "GITEA_BASE_URL": "${HERMES_GITEA_BASE_URL}"
      },
      "description": "Least-privilege Gitea token for DevOps diagnostics and approved actions."
    }
  }
}
```

> **Security Boundary:** MCP database access สำหรับ Hermes ต้องเป็น read-only account หรือ read-only replica เท่านั้น และใช้เพื่อ developer diagnostics ไม่ใช่ production DMS write path การอ่านไฟล์เอกสาร production ต้องผ่าน DMS Backend API ห้าม mount storage เข้า Hermes container โดยตรง

> **Data Minimization:** read-only account นี้ต้องถูกจำกัดที่ระดับ DB grant/view/replica ไม่ใช่พึ่ง policy ใน agent เท่านั้น โดย default ให้เห็น schema metadata และ operational diagnostics เท่านั้น หากจำเป็นต้อง query ตาราง DMS จริงให้ใช้ masked views หรือ read-only replica ที่ redact sensitive fields

> **Implementation Verification:** MCP package name, CLI arguments, remote-server field names, and environment interpolation behavior must be verified against the actual installed MCP client/server before rollout.

---

### 2. Telegram Integration Architecture

#### System Overview

Telegram Bridge ใน ADR-031 เป็น interface ของ Hermes สำหรับ **DevOps commands เท่านั้น** ไม่ใช่ production DMS command channel และไม่ใช่ช่องทาง query/แก้ไขเอกสารจริง

* **Inbound Commands (Inbound):** รับคำสั่งผ่าน Webhook ของ Telegram Bot สำหรับ DevOps tasks เช่น CI status, Gitea issue/PR summary, scheduled audit, repository diagnostics, และสถานะ Hermes Agent
* **System Commands:** เช่น `/status`, `/ci_status`, `/repo_summary`, `/schedule_audit` จะถูกประมวลผลทันทีใน Hermes command service โดยไม่แตะ production DMS workflow
* **Document Queries:** ไม่อยู่ใน scope ของ Hermes Telegram หากต้อง query หรือ mutate เอกสารจริง ต้องทำเป็น DMS Backend Telegram module แยกต่างหาก และต้อง enforce RBAC, audit, project isolation, และ Idempotency-Key ตาม ADR-016/019/023A

* **Notification Dispatcher (Outbound):** ใช้ **BullMQ** เป็นตัวจัดการคิวการส่งข้อความ
  * ทุกการส่งงาน (Job) จะต้องระบุ `Transaction ID` (UUIDv7) เพื่อใช้ในการติดตามผล
  * ทุก Transaction จะถูกบันทึกใน `hermes_operations_log` หรือ log store ของ Hermes เพื่อ trace DevOps operation โดยไม่ปะปนกับ `audit_logs` ของ DMS

* **Error Handling:** ตาม ADR-007 ระบบต้องทำ Retry 3 ครั้งพร้อม Exponential Backoff หากการเชื่อมต่อ Telegram API ล้มเหลว

#### Hermes DevOps Telegram Gateway (Pseudocode)

```typescript
// hermes/src/integrations/telegram/hermes-telegram-gateway.ts
type HermesTelegramMessage = {
  message?: {
    from?: { id?: number; username?: string };
    text?: string;
    chat?: { id?: number };
  };
};

class HermesTelegramGateway {
  constructor(private readonly commandRouter: HermesDevOpsCommandRouter) {}

  async handleWebhook(payload: HermesTelegramMessage): Promise<HermesCommandResult> {
    const transactionId = uuidv7();
    const telegramUserId = payload.message?.from?.id?.toString();
    const text = payload.message?.text?.trim();

    if (!telegramUserId || !text) {
      return this.reject(transactionId, 'INVALID_TELEGRAM_PAYLOAD');
    }

    await hermesOperationsLog.recordInbound({
      transactionId,
      telegramUserId,
      commandText: text,
    });

    return this.commandRouter.execute({
      transactionId,
      telegramUserId,
      commandText: text,
      scope: 'DEVOPS_ONLY',
    });
  }
}
```

#### Hermes Outbound Dispatcher

```typescript
// hermes/src/integrations/telegram/hermes-telegram-dispatcher.ts
@Processor('hermes-notification-queue')
class HermesTelegramDispatcher extends WorkerHost {
  @Process('telegram-devops-outbound')
  async handleOutbound(job: Job<HermesTelegramOutboundJob>): Promise<TelegramSendResult> {
    const { chatId, message, transactionId } = job.data;
    const sent = await this.bot.sendMessage(chatId, `${message}\n\n[Ref: ${transactionId}]`);

    await hermesOperationsLog.recordOutbound({ transactionId, chatId });
    return sent;
  }
}
```

> **Out of Scope:** Production DMS Telegram commands, document queries, Workflow Engine actions, and AI document interactions are not implemented in Hermes. If the project needs those capabilities, create a separate DMS Backend ADR/spec and enforce DMS Backend API, CASL/RBAC, `Idempotency-Key`, `audit_logs`, and `publicId` rules there.

#### System Commands

* `/status`: เช็คสถานะ Agent (Bypass AI)
* `/ci_status`: เช็คสถานะ CI ล่าสุดจาก Gitea
* `/repo_summary`: สรุป issue/PR หรือ repository diagnostics
* `/schedule_audit`: ตั้ง scheduled DevOps audit ผ่าน Hermes
* `/help`: แสดงรายการคำสั่งทั้งหมด

#### Telegram Command Permission Policy

Hermes Telegram commands ต้องแบ่งสิทธิ์ตามผลกระทบของคำสั่ง:

| ระดับ | คำสั่งที่อนุญาต | เงื่อนไข |
|---|---|---|
| **Read-only** | `/status`, `/ci_status`, `/repo_summary`, `/audit_summary` | ทำได้ทันทีสำหรับผู้ใช้ใน allowlist |
| **Write with confirmation** | สร้าง branch, เปิด issue/PR, trigger CI, schedule audit | ต้องมี explicit confirmation ใน Telegram และบันทึก `transactionId` ใน `hermes_operations_log` |
| **Forbidden from Telegram** | push ไป `main`/`master`, production deploy, schema migration execution, destructive git/file commands, direct DB writes, storage delete | ห้ามทำผ่าน Telegram ทุกกรณี ต้องใช้ workflow ที่มี human review และ approval แยกต่างหาก |

ตัวอย่างคำสั่งที่ปลอดภัยควรเป็น “เตรียม branch/PR proposal สำหรับ fix/ci-pnpm-cache” ไม่ใช่ “สร้าง branch แล้ว push ให้เลย”

#### Future DMS Telegram Module (Out of Scope)

หากต้องการ Telegram command ที่ query หรือ mutate เอกสารจริง ต้องสร้าง ADR/spec แยกสำหรับ DMS Backend Telegram module เท่านั้น และ rollout นั้นต้องผ่าน ADR-009/016/019/023A เต็มรูปแบบ

ตาราง `user_telegram_mapping` ด้านล่างเป็นตัวอย่าง requirement สำหรับ future module เท่านั้น **ห้าม create table นี้เป็นส่วนหนึ่งของ ADR-031 rollout**

```sql
CREATE TABLE user_telegram_mapping (
    id BINARY(16) PRIMARY KEY,
    user_id BINARY(16) NOT NULL,
    telegram_id VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (telegram_id),
    CONSTRAINT fk_user_telegram FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

### 3. Security & Audit Requirements

#### Tier 1 Security Checklist

1. **Auth Check:** Hermes Telegram ต้องตรวจสอบ allowlist/admin mapping สำหรับ DevOps commands เท่านั้น หากเป็น DMS Backend Telegram module ในอนาคต ต้องตรวจสอบ `telegram_id` กับ `user_id` และสิทธิ์ผ่าน CASL Guard ของ DMS API
2. **Hermes Operations Log:** ทุก Transaction ID ต้องถูกบันทึกใน `hermes_operations_log` หรือ log store ของ Hermes ทันทีทั้งตอนได้รับ (Inbound) และส่งออก (Outbound) ไม่ใช้ `audit_logs` ของ DMS เว้นแต่มี DMS Backend module แยกต่างหาก
3. **Error Handling:** ตาม `ADR-007` หากการส่งข้อความผ่าน BullMQ ล้มเหลว (เช่น Telegram API ล่ม) ระบบต้องมีการทำ Retry 3 ครั้งโดยใช้ Exponential Backoff

#### Webhook Security & Verification

Telegram ส่ง Webhook พร้อม Header `X-Telegram-Bot-Api-Secret-Token` เพื่อ verify ว่า request มาจาก Telegram จริง:

```typescript
// hermes/src/integrations/telegram/hermes-telegram-webhook.ts
class HermesTelegramWebhook {
  async handleWebhook(headers: WebhookHeaders, payload: HermesTelegramMessage) {
    if (headers['x-telegram-bot-api-secret-token'] !== process.env.HERMES_TELEGRAM_WEBHOOK_SECRET) {
      throw new Error('INVALID_TELEGRAM_WEBHOOK_SECRET');
    }
    return this.hermesTelegramGateway.handleWebhook(payload);
  }
}
```

**ข้อควรระวัง:**
- หากไม่ verify secret ใครก็ตามที่คาดเดา URL ได้จะสามารถส่งข้อความปลอมในนามระบบได้
- ต้องตั้งค่า `secret_token` เมื่อ register webhook กับ Telegram Bot API

#### Rate Limiting (ป้องกัน Spam)

ใช้ Redis-based rate limiting เพื่อจำกัดจำนวน request ต่อ `telegram_id` และไม่เก็บ state ใน memory ของ container:

```typescript
const rateLimitKey = `hermes:telegram:${telegramUserId}`;
const requestCount = await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, 60);

if (requestCount > HERMES_TELEGRAM_RATE_LIMIT_MAX) {
  throw new Error('HERMES_TELEGRAM_RATE_LIMIT_EXCEEDED');
}
```

#### Hermes Transaction Status (Tracking)

ให้ผู้ใช้ติดตามสถานะของ Transaction ID ได้ผ่าน Telegram command `/status <transactionId>` เฉพาะ Hermes DevOps transaction:

```typescript
// hermes/src/commands/status-command.ts
async function getHermesTransactionStatus(transactionId: string): Promise<HermesTransactionStatus> {
  const operation = await hermesOperationsLog.findByTransactionId(transactionId);
  const job = await hermesNotificationQueue.getJob(transactionId);

  return {
    transactionId,
    status: job?.state ?? operation?.status ?? 'unknown',
    createdAt: operation?.createdAt,
    completedAt: job?.finishedOn,
    attempts: job?.attemptsMade,
    error: job?.failedReason,
  };
}
```

**การใช้งาน:**
- ผู้ใช้สามารถ query ด้วย `/status <transactionId>` ใน Telegram สำหรับ DevOps/Hermes transaction เท่านั้น
- ไม่ expose DMS-style `/api/v1/telegram` endpoint จาก Hermes

#### Environment Variables

```env
HERMES_TELEGRAM_BOT_TOKEN=your_token_here
HERMES_TELEGRAM_WEBHOOK_SECRET=a_very_secret_string_for_security
HERMES_TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
HERMES_TELEGRAM_RATE_LIMIT_MAX=10
HERMES_TELEGRAM_RATE_LIMIT_WINDOW_MS=60000
```

---

### 4. Hermes Interface Modes

Hermes รันได้ 3 mode หลักที่ share config/data เดียวกันใน `~/.hermes`:
- **CLI/TUI** — `hermes --tui` interactive session
- **Messaging Gateway** — รองรับ 22 platform (Telegram, Discord, Slack, WhatsApp, Signal, LINE, Mattermost, Matrix, Teams, Google Chat ฯลฯ)
- **IDE Integration** — เชื่อมกับ Windsurf / Codex ผ่าน MCP

#### CLI Commands

ตัวอย่าง command ด้านล่างรันบน ASUSTOR shell หลัง SSH เข้า NAS:

```sh
hermes                          # interactive TUI session
hermes -q "สรุป open issues"    # single query แบบ non-interactive
hermes --continue               # resume session ล่าสุด
hermes -z "task" < file.txt     # pipe input → capture output (scriptable)
hermes -s dms-context -q "..."  # preload skill แล้วถาม
hermes -w -q "fix issue #42"    # isolated git worktree (safe parallel run)
```

#### เหตุผลที่ Telegram เป็น interface หลักบน ASUSTOR

Hermes รันบน ASUSTOR ตลอด 24/7 การ SSH เข้าไปแค่เพื่อถามคำถามไม่ practical — สามารถ chat จาก **ทุก device** ขณะที่มันทำงานบน NAS ได้เลย

```
[มือถือ / Laptop ที่ไหนก็ได้]
        ↕ Telegram
[Hermes บน ASUSTOR Docker]
        ↕ SSH terminal backend
[ASUSTOR filesystem / Gitea / MariaDB]
```

#### Updated Stack ภาพรวม

```
┌─────────────────────────────────────────────────────┐
│                   Laptop / Desktop                  │
│                                                     │
│  Windsurf IDE          agy (Antigravity CLI)        │
│  └─ Cascade            └─ same engine as desktop    │
│  └─ MCP (MariaDB,          └─ parallel subagents    │
│     Gitea)                 └─ /schedule tasks       │
│                                                     │
│  Codex CLI                                          │
│  └─ → hermes proxy (Developer AI Proxy only)        │
└────────────────────┬────────────────────────────────┘
                     │ SSH / Telegram
┌────────────────────▼────────────────────────────────┐
│              ASUSTOR NAS (ADM + Docker)             │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         Hermes Agent (Docker container)     │   │
│  │                                             │   │
│  │  Memory: DMS schema, conventions, ADRs     │   │
│  │  Skills: dms-context, gitea-watch, rag-ops │   │
│  │  Channels: Telegram + hermes proxy          │   │
│  │  Terminal backend: SSH → Gitea Actions       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Gitea Actions Runners (existing)                   │
└─────────────────────────────────────────────────────┘
```

#### Interface Selection Guide

| สถานการณ์ | Interface | ทำไม |
|---|---|---|
| นั่งทำงานที่โต๊ะ coding | Windsurf Cascade | IDE context + MCP |
| สั่ง task ซับซ้อน / multi-agent | `agy` CLI หรือ Desktop | parallel subagents |
| batch ops / scaffolding | Codex CLI | bash execution |
| อยู่นอกบ้าน / มือถือ | Telegram → Hermes | always-on บน ASUSTOR สำหรับ DevOps commands เท่านั้น |
| CI watch / scheduled audit | Hermes `/schedule` | 24/7 background |
| Codex ต้องการ assistance สำหรับ coding/devops | `hermes proxy` → Codex | Developer AI Proxy เท่านั้น ห้ามใช้กับ production document payload |

#### 3 วิธีที่คุยกับ Hermes

**1. Telegram (แนะนำสำหรับ DevOps commands)** — ส่งข้อความจากที่ไหนก็ได้

ตัวอย่างที่ส่งได้:
```
"CI run ล่าสุดผ่านไหม?"
"สรุป TODO ใน correspondence module ให้หน่อย"
"เตรียม branch/PR proposal สำหรับ fix/ci-pnpm-cache"
```

**2. SSH เข้า ASUSTOR → `hermes --tui`** — ใช้เมื่อทำงานหนัก (multi-step coding task)

```bash
ssh admin@<ASUSTOR_IP>
hermes --continue   # resume session ล่าสุด
```

**3. Codex CLI บน laptop → hermes proxy** — Codex รันบน laptop และใช้ Hermes เป็น Developer AI Proxy สำหรับ coding/devops assistance เท่านั้น

ตัวอย่างบน Windows PowerShell:

```powershell
$env:OPENAI_BASE_URL = "http://<ASUSTOR_IP>:8766/v1"
$env:OPENAI_API_KEY = "<HERMES_PROXY_API_KEY>"

# ใช้กับ coding/devops task ที่ไม่มี production document payload หรือ secrets
codex "scaffold NestJS module for repository diagnostics"
```

> **Secret Handling:** ตัวอย่างค่า key/token ในเอกสารนี้เป็น placeholder เท่านั้น ห้าม commit secret จริงลง repo หรือ spec file

> **หมายเหตุ Port และ Boundary:** hermes proxy ใช้ port `:8766` — ห้ามใช้ `:8765` ซึ่ง PaddleOCR sidecar ใช้อยู่แล้ว (ADR-023A) และห้ามนำ proxy นี้ไปใช้แทน DMS AI runtime ที่ต้องผ่าน DMS Backend/BullMQ/Ollama boundary ตาม ADR-023A

---

### 5. Antigravity CLI (agy) + Hermes MCP Integration

#### Antigravity CLI (`agy`) คืออะไร

`agy` เป็น Go binary — single self-contained executable ที่ bidirectional sync กับ desktop app ได้ ใช้ Gemini 3.5 Flash by default รองรับ parallel subagents, slash commands อย่าง `/goal` และ `/schedule`

```bash
agy                                    # TUI interactive
agy "scaffold NestJS module for docs"  # single task
agy /goal "implement RAG pipeline"     # set persistent goal
agy /schedule "run audit daily 02:00"  # background scheduled task
```

#### agy ใช้ Hermes เป็น model backend ตรงๆ ไม่ได้

`agy` ผูกกับ Google Antigravity backend — ไม่รองรับ custom OpenAI-compatible endpoint โดยตรง

**วิธีที่ถูกต้อง:** เชื่อม agy กับ Hermes **ผ่าน MCP** — agy ยังใช้ Gemini ในการ orchestrate แต่ดึง DMS memory + tools จาก Hermes มาด้วย

```
agy (Gemini 3.5 Flash)
  └── MCP: hermes-memory    ← ดึง DMS context จาก Hermes
  └── MCP: hermes-tools     ← สั่ง Hermes รัน bash/git บน ASUSTOR
  └── MCP: mariadb          ← DB schema (เดิม)
  └── MCP: gitea            ← Gitea API (เดิม)
```

#### Config Files สำหรับ agy

**`~/.gemini/config/mcp_config.json`**

```json
{
  "hermes-memory": {
    "serverUrl": "http://<ASUSTOR_IP>:8766/mcp",
    "headers": {
      "Authorization": "Bearer <HERMES_PROXY_API_KEY>"
    },
    "description": "LCBP3 DMS persistent memory and context from Hermes"
  },
  "mariadb": {
    "command": "docker",
    "args": [
      "run", "--rm", "-i",
      "-e", "MARIADB_HOST=<QNAP_IP>",
      "-e", "MARIADB_PORT=3306",
      "-e", "MARIADB_USER=dms_user",
      "-e", "MARIADB_PASSWORD=<password>",
      "mcp/mariadb"
    ]
  },
  "gitea": {
    "command": "docker",
    "args": [
      "run", "--rm", "-i",
      "-e", "GITEA_URL=http://<QNAP_IP>:3000",
      "-e", "GITEA_TOKEN=<token>",
      "mcp/gitea"
    ]
  }
}
```

> **สำคัญ:** field name สำหรับ remote MCP server ใช้ `serverUrl` (ไม่ใช่ `url`) ใน agy — ถ้าผิดตรงนี้ server จะ fail แบบ silent

**`~/.gemini/antigravity-cli/settings.json`**

```json
{
  "model": "gemini-3.5-flash-high",
  "theme": "Default",
  "autoAccept": false,
  "contextFiles": [
    "~/.gemini/antigravity-cli/DMS_CONTEXT.md"
  ],
  "permissions": {
    "defaultMode": "suggest",
    "autoApprove": [
      "read_file",
      "list_directory",
      "mcp_hermes-memory_recall",
      "mcp_mariadb_query"
    ]
  },
  "subagents": {
    "maxParallel": 3
  }
}
```

**`~/.gemini/antigravity-cli/DMS_CONTEXT.md`**

```markdown
# LCBP3 DMS — agy context

## Stack
- NestJS + Next.js 14, pnpm monorepo, MariaDB + TypeORM
- Gitea (QNAP) → CI via ASUSTOR runners
- Hermes Agent (ASUSTOR): DMS memory + bash execution

## When starting any task
1. Call mcp_hermes-memory_recall("dms-context") ก่อนเสมอ
2. อ่าน schema ผ่าน mcp_mariadb ก่อน scaffold
3. งานที่ต้องรัน bash → delegate ให้ Hermes ผ่าน MCP

## Hard rules (🔴)
- ห้าม commit ตรง main/develop
- ห้ามรัน migration โดยไม่ได้รับ human approval
```

#### Flow เมื่อใช้ agy + Hermes ร่วมกัน

```
คุณพิมพ์ใน agy:
"implement document revision API"
         │
         ▼
  agy (Gemini 3.5 Flash)
  1. เรียก MCP hermes-memory → ดึง DMS context
  2. เรียก MCP mariadb → อ่าน schema
  3. วางแผน → spawn 2 subagents parallel:
     ├── subagent A: NestJS service + controller
     └── subagent B: unit tests
  4. subagents เรียก MCP hermes-tools
     → Hermes รัน git/pnpm บน ASUSTOR
  5. รายงานผลกลับมาที่ agy
```

| | agy | Hermes |
|---|---|---|
| Model | Gemini 3.5 Flash (orchestration) | Claude Sonnet (memory/tools) |
| Role | สั่งงาน, parallel subagents | จำ context, รัน bash บน ASUSTOR |
| เชื่อมกันผ่าน | MCP client | MCP server (`/mcp` endpoint) |

---

### 6. Deploy Prerequisites

#### VLAN Requirements

ต้องเปิด path นี้ได้ก่อน deploy:
```
ASUSTOR (VLAN ใดก็ตาม) → QNAP VLAN 10 (MariaDB :3306, Gitea :3000)
```
หาก inter-VLAN routing ยังติด firewall อยู่ ต้อง allow subnet ของ ASUSTOR เข้า VLAN 10 ด้วย

#### Network Exposure Requirements

* Hermes API (`:8080`), Hermes proxy (`:8766`), และ MCP endpoint (`/mcp`) ต้อง bind หรือ firewall ให้อยู่เฉพาะ LAN/VPN ที่กำหนดเท่านั้น
* ห้ามเปิด Hermes API/proxy/MCP ตรงสู่ public internet
* Telegram webhook เป็น endpoint เดียวที่อาจต้องรับ traffic จาก internet และต้องอยู่หลัง reverse proxy ที่เปิด TLS, verify `X-Telegram-Bot-Api-Secret-Token`, ทำ IP/rate limit, และบันทึก request log
* หากใช้ Cloudflare Tunnel, Tailscale Funnel, หรือ reverse proxy ใด ๆ ต้องกำหนด allowlist และ audit config ก่อนเปิดใช้งานจริง

#### Secret Management Requirements

* Secret ทั้งหมด (`HERMES_PROXY_API_KEY`, `HERMES_TELEGRAM_BOT_TOKEN`, `HERMES_TELEGRAM_WEBHOOK_SECRET`, Gitea token, read-only DB credential) ต้องเก็บนอก repo
* ห้าม commit secret จริงใน `.env`, compose file, MCP config, ADR/spec, README, หรือ screenshot
* บน ASUSTOR ให้ใช้ secret store ที่มีอยู่ หรือไฟล์ environment นอก repo ที่จำกัด permission เฉพาะ admin/service account
* ต้องมี rotation plan สำหรับ API key/token และ revoke token ทันทีเมื่อเครื่อง client หายหรือ operator ออกจากทีม
* Verification ต้องรวม secret scan ก่อน rollout และหลังแก้ config

#### Gitea Token Requirements

* Default token ต้องเป็น read-only สำหรับอ่าน repo, issue, PR, CI status และ release metadata
* Write action เช่น create branch, create issue, create PR, หรือ trigger CI ต้องใช้ token แยกที่ scope แคบกว่า admin และต้องผ่าน Telegram explicit confirmation ก่อน
* ห้ามใช้ admin token กับ Hermes
* ห้ามใช้ token ที่สามารถ push ไป `main`/`master` หรือ bypass branch protection ได้
* Token ต้องมี expiry/rotation schedule และสามารถ revoke แยกตาม operator/service ได้
* ทุก write action ต้องบันทึก `transactionId`, token identity หรือ service identity, target repo, target branch, และผลลัพธ์ใน `hermes_operations_log`

#### Hermes Operations Log Requirements

* `hermes_operations_log` ต้องอยู่ใน Hermes-owned storage เท่านั้น เช่น SQLite/Postgres volume ภายใน Hermes stack หรือ structured log file ที่ส่งต่อไป log collector
* ห้ามเขียน Hermes DevOps operations ลง `audit_logs` ของ DMS ยกเว้น future DMS Telegram module ที่แยก ADR/spec และผ่าน DMS Backend API
* ต้องบันทึกอย่างน้อย `transactionId`, operator identity, command type, target system, status, createdAt, completedAt, และ error classification
* ต้อง redact command payload ที่อาจมี secret, token, file path sensitive, หรือ production document content
* Retention เริ่มต้น 90 วัน แล้ว archive/delete ตาม policy ของ DevOps logs
* Log storage ต้องจำกัดสิทธิ์อ่านเฉพาะ admin/operator ที่จำเป็น

#### Failure & Degradation Requirements

* Hermes, Telegram Bridge, MCP, และ hermes proxy ต้องเป็น optional DevOps tooling ไม่ใช่ dependency ของ DMS production runtime
* หาก Hermes stack ล่ม ผู้ใช้ DMS ต้องยังใช้งาน frontend/backend, Workflow Engine, notification, และ AI pipeline ตาม ADR-023A ได้ตามปกติ
* Degraded mode คือกลับไปใช้ IDE, Gitea UI, CI UI, SSH/manual ops, และ Codex/Windsurf local workflow ตามปกติ
* ห้ามให้ production deploy, Workflow Engine transition, AI inference, หรือ document ingestion รอ Hermes availability
* Monitoring ต้องแจ้งเตือนเฉพาะ operator/devops team ไม่ alert เป็น production DMS outage เว้นแต่มีผลกระทบจริงกับ DMS service

#### Monitoring & Alerting Requirements

* Hermes down, Telegram Bridge down, MCP unavailable, หรือ hermes proxy down ให้แจ้งเป็น DevOps warning ไม่ใช่ production DMS outage
* Repeated API key failure, webhook secret failure, Telegram allowlist rejection spike, หรือ rate limit spike ต้องแจ้งเป็น security alert
* Failed write-with-confirmation command เช่น create branch/issue/PR/trigger CI ต้องแจ้ง DevOps alert พร้อม `transactionId`
* หาก hermes proxy ได้รับ payload ที่คล้าย production document content, secret, token, password, หรือ storage path ต้องถือเป็น security incident และต้อง redact log ทันที
* Monitoring ต้องแยก dashboard/status ของ Hermes ออกจาก DMS production service health เพื่อไม่ให้ incident severity ปะปนกัน
* Alert ทุกประเภทต้อง link กลับไปยัง `hermes_operations_log` ด้วย `transactionId` เมื่อมี

#### ASUSTOR-Specific Notes

ASUSTOR ADM Docker บางรุ่นใช้ path `/share/` แทน `/volume1/` — รัน `df -h` บน ASUSTOR shell หลัง SSH เข้า NAS เพื่อดู shared folder mount แล้วแก้ path ใน `docker-compose.yml` ให้ตรง

#### ลำดับ Deploy ที่แนะนำ

```
1. สร้าง Telegram bot (@BotFather) → copy token
2. สร้าง SSH keypair บน ASUSTOR
3. copy files ขึ้น ASUSTOR → แก้ .env (ระวัง HERMES_PROXY_PORT=8766)
4. บน ASUSTOR shell: `docker compose up -d` → ทดสอบ Telegram
5. ทดสอบ hermes proxy จาก laptop
6. บน Windows PowerShell: ตั้ง `$env:OPENAI_BASE_URL = "http://<ASUSTOR_IP>:8766/v1"` → ทดสอบ Codex CLI สำหรับ coding/devops task เท่านั้น
7. ส่ง /schedule tasks ผ่าน Telegram
```

---

## Implementation Roadmap

### Rollout Stages

ADR-031 ต้อง rollout แบบเป็น stage เพื่อลดความเสี่ยง และห้ามข้ามไป stage ที่สูงกว่าโดยยังไม่ผ่าน verification gate ของ stage ก่อนหน้า:

1. **Stage 0 - Documentation Only:** สรุป boundary และ rollout plan ให้ stable ก่อน ยังไม่ deploy, ไม่เปิด network, ไม่เพิ่ม schema
2. **Stage 1 - Hermes Container LAN-only:** deploy Hermes container บน ASUSTOR แบบ LAN/VPN-only, ใช้ Redis/log store แยก, ยังไม่เปิด Telegram public webhook
3. **Stage 2 - Read-only Diagnostics:** เปิด Gitea read-only และ MariaDB masked/read-only diagnostics ตาม least privilege และ data minimization policy
4. **Stage 3 - Telegram Read-only DevOps:** เปิด Telegram DevOps commands เฉพาะ read-only เช่น `/status`, `/ci_status`, `/repo_summary`, `/audit_summary`
5. **Stage 4 - Write-with-confirmation DevOps:** เปิด action ที่เขียน Gitea/CI ได้เฉพาะ create branch/issue/PR/trigger CI/schedule audit พร้อม explicit confirmation และ `hermes_operations_log`
6. **Stage 5 - Developer AI Proxy:** เปิด `hermes proxy` สำหรับ coding/devops assistance เท่านั้น โดยห้าม production document payload, secrets, และ DMS AI runtime usage

### Stage Acceptance Gates

| Stage | Go/No-Go Gate |
|---|---|
| **Stage 0** | ADR boundary reviewed, locked decisions captured, no schema delta, no deploy files applied |
| **Stage 1** | LAN/VPN-only exposure confirmed, ASUSTOR runtime resource limits enforced, Hermes Redis/log store separated from DMS production |
| **Stage 2** | read-only DB grant verified, masked/redacted fields verified, Gitea read-only token verified, no direct storage mount |
| **Stage 3** | Telegram allowlist verified, webhook secret verified, rate limit verified, `hermes_operations_log` captures inbound/outbound transaction |
| **Stage 4** | explicit confirmation flow verified, forbidden action blocklist verified, branch protection and Gitea token scope verified |
| **Stage 5** | proxy LAN/VPN-only verified, no secrets/document payload test passed, proxy not wired into DMS AI runtime or document intelligence path |

### Stage Owner & Approval Matrix

| Stage | Required Owner/Approval |
|---|---|
| **Stage 0** | Architecture Team |
| **Stage 1** | DevOps/Admin |
| **Stage 2** | DBA/Security + DevOps |
| **Stage 3** | DevOps/Security |
| **Stage 4** | Architecture + Security + Repo Owner |
| **Stage 5** | Architecture + Security |

### Stage Rollback Matrix

| Stage | Rollback Action |
|---|---|
| **Stage 1** | Stop/remove Hermes container, keep `hermes_operations_log` for review, verify DMS production remains unaffected |
| **Stage 2** | Revoke DB/Gitea read-only credentials, disable MCP servers, confirm no direct storage mount exists |
| **Stage 3** | Unregister Telegram webhook, revoke Telegram bot token if needed, stop `HermesTelegramDispatcher` |
| **Stage 4** | Revoke Gitea write token, disable write commands, preserve operations log for audit/review |
| **Stage 5** | Unset `OPENAI_BASE_URL` on clients, stop hermes proxy, revoke proxy API key |

### Roadmap Items

1. **Hermes Telegram Scope:** จำกัด Telegram Bridge ของ Hermes ให้รองรับ DevOps commands เท่านั้น
2. **Notification Queue:** ปรับใช้โครงสร้าง `HermesTelegramDispatcher` เพื่อดึงงาน DevOps notification ออกจากคิว `hermes-notification-queue`
3. **Command Handling:** สร้าง Telegram Gateway Controller เพื่อรองรับ Webhook และส่งต่อไปยัง DevOps Command Router
4. **Logging:** เพิ่ม Hermes operations logging เพื่อบันทึกการทำงานของ Telegram ในทุกจุดที่เปลี่ยนผ่าน Transaction
5. **No DMS Schema Rollout:** ADR-031 ไม่เพิ่มหรือแก้ production DMS tables ใด ๆ รวมถึงไม่สร้าง `user_telegram_mapping`

---

## Verification Plan

1. **Resource Limit Test:** บน ASUSTOR shell รัน `docker inspect hermes_agent_lcbp3` และ `docker stats hermes_agent_lcbp3` เพื่อยืนยันว่า runtime enforce RAM ไม่เกิน 4GB และ CPU ไม่เกิน 2 Cores จริง ไม่ใช่แค่มีค่าใน compose file
2. **API Key Auth Test:** บน Windows PowerShell รัน `Invoke-WebRequest -Headers @{ "X-API-Key" = "wrong_key" } -Uri "http://<ASUSTOR_IP>:8080/api/v1/sync"` ต้องโดนบล็อกด้วยสิทธิ์ 401 Unauthorized
3. **Git Hooks Test:** ลองจงใจพิมพ์ `: any` หรือ `console.log` ลงในไฟล์ `.ts` แล้วกด `git commit` ระบบต้องทำการ `exit 1`
4. **Unit Test:** ทดสอบ `handleInboundCommand` ว่าสามารถแยกคำสั่ง `/` ออกจากข้อความปกติได้ถูกต้อง
5. **Queue Test:** ตรวจสอบว่า `BullMQ` ดึงงาน `telegram-devops-outbound` จาก `hermes-notification-queue` ไปประมวลผลและตอบกลับ Telegram ได้สำเร็จ
6. **Security Test:** ทดสอบว่า Telegram user ที่ไม่อยู่ใน `HERMES_TELEGRAM_ALLOWED_USER_IDS` ไม่สามารถใช้ DevOps commands ได้
7. **Schema Safety Test:** ตรวจสอบว่า ADR-031 rollout ไม่มี SQL delta หรือ migration ที่สร้าง `user_telegram_mapping`
8. **Secret Scan Test:** ตรวจสอบว่าไม่มี secret จริงใน repo/spec/compose/MCP config และ environment file ที่ใช้ deploy อยู่นอก repo พร้อม permission จำกัด
9. **Operations Log Test:** ตรวจสอบว่า Hermes operation ถูกบันทึกใน Hermes-owned log store, payload ถูก redact, และไม่มี write ไปยัง DMS `audit_logs`
10. **Failure Isolation Test:** ปิด Hermes container แล้วตรวจว่า DMS frontend/backend, Workflow Engine, AI pipeline, และ user-facing app ยังทำงานตามปกติ
11. **Monitoring Test:** จำลอง Hermes down, webhook auth failure, failed write command, และ proxy secret-like payload เพื่อยืนยัน alert severity/channel ถูกต้องและ log ถูก redact

---

## Related ADRs

- ADR-007: Error Handling Strategy
- ADR-008: Email Notification Strategy (BullMQ)
- ADR-016: Security & Authentication
- ADR-019: Hybrid Identifier Strategy (UUIDv7)
- ADR-023/ADR-023A: Unified AI Architecture และ AI isolation boundary
- ADR-031 v2.0: Cloud AI exception สำหรับ Hermes dev orchestration layer (ดู Locked Decisions v2.0)

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-05-28 | 1.0.0 | Initial ADR creation - Merged from CONTEXT-ADR-031 and CONTEXT-ADR-031-Added |
| 2026-05-28 | 1.1.0 | Added sections 4–6 from CONTEXT-ADR-031-Added-2: Hermes Interface Modes, agy+Hermes MCP Integration, Deploy Prerequisites; fixed port conflict (hermes proxy :8766, not :8765) |
| 2026-05-29 | 1.1.1 | Aligned with CONTEXT-ADR-031.md grill-with-docs: fixed monorepo structure (flat layout), corrected file paths, updated repo URL to git.np-dms.work, added AGENTS.md v1.9.7 reference |
| 2026-05-29 | 1.1.2 | Linked root CONTEXT.md with specs/CONTEXT-ADR-031.md; fixed setup-context.sh paths; updated Windsurf/agy/Hermes symlink targets |
| 2026-05-29 | 2.0.0 | **v2.0 Rewrite** — grill-with-docs: Orchestration as primary concern; Added Autonomous Dev Loop architecture; Cloud AI exception (Data Classification Policy C); Separate Dev Qdrant on ASUSTOR; SOUL.md container-local journal; Sub-agent delegation (Cloud+MCP); Git identity hermes-bot + hermes/* branches + PR-only flow |
| 2026-05-29 | 2.0.1 | Step 1 context assembly: เพิ่ม `CONTEXT.md` (root domain terminology) เป็น selective context source สำหรับ DMS feature coding และ Schema/DB work tasks |
