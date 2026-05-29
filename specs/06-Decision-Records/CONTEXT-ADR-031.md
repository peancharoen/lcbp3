# LCBP3 DMS — Agent Context (ADR-031)
# Single source of truth สำหรับทุก agent tool (Hermes, agy, Windsurf)
#
# ที่อยู่ไฟล์: specs/06-Decision-Records/CONTEXT-ADR-031.md
#
# Tool ที่อ่านไฟล์นี้:
#   Hermes  → /volume1/docker/hermes/config/MEMORY.md (symlink หรือ copy)
#   agy     → ~/.gemini/antigravity-cli/settings.json > contextFiles[]
#   Windsurf → .windsurfrules > @import specs/06-Decision-Records/CONTEXT-ADR-031.md
#
# Domain context (Correspondence, RFA, AI Architecture): ดู CONTEXT.md ที่ root
#
# แก้ไขที่ไฟล์นี้ที่เดียว — tools ทั้งหมดได้รับ context เดียวกัน
# Last updated: 2026-05-29 (grill-with-docs: fixed paths, linked to root CONTEXT.md)

---

## Project identity

| Key | Value |
|---|---|
| Project | LCBP3 DMS — Laem Chabang Basin Phase 3 Document Management System |
| Domain | Construction project document management |
| Owner | เป้ |
| Repo | Gitea: `https://git.np-dms.work/np-dms/lcbp3` (internal) |
| Primary IDE | Windsurf (Cascade + MCP) |
| Agent stack | Hermes (ASUSTOR) · agy CLI · Codex CLI |

---

## Monorepo structure

```
lcbp3/
├── backend/              NestJS + TypeORM  (port 3001)
├── frontend/             Next.js 14 App Router  (port 3000)
├── specs/                ADRs, specs, data dictionary
├── .agents/              Agent skills and rules
├── .gitea/workflows/     CI/CD pipeline definitions
├── .windsurf/            Windsurf workflows and rules
├── memory/               Agent memory
└── CONTEXT.md            ← this file
```

---

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend | NestJS + TypeScript | strict mode |
| ORM | TypeORM + MariaDB | migrations only, no sync |
| Queue | BullMQ + Redis | async ingestion, OCR jobs |
| Frontend | Next.js 14 App Router | shadcn/ui, Tailwind |
| Auth | JWT + RBAC | roles: ADMIN / PM / ENGINEER / VIEWER |
| File storage | MinIO | no local disk uploads |
| Embeddings | Ollama · nomic-embed-text | local on QNAP |
| Generation | Typhoon API · typhoon-v2.1-12b-instruct | Thai-first LLM |
| Vector store | Qdrant | Docker sidecar on QNAP, port 6333 |
| CI/CD | Gitea Actions → ASUSTOR runners | |
| Package manager | pnpm workspaces | |

---

## Infrastructure

| Service | Host | Port |
|---|---|---|
| Gitea | QNAP NAS | 3000 |
| MariaDB (dev) | QNAP NAS | 3306 |
| Redis | QNAP NAS | 6379 |
| Qdrant | QNAP NAS | 6333 |
| MinIO | QNAP NAS | 9000 |
| Ollama | QNAP NAS | 11434 |
| Hermes Agent | ASUSTOR NAS | 8765 (proxy) |
| Gitea Actions runners | ASUSTOR NAS | — |
| Nginx Proxy Manager | QNAP NAS | 80 / 443 |
| n8n | QNAP NAS | 5678 |

---

## Active modules

| Module | Status | Notes |
|---|---|---|
| Correspondence | 🟡 In progress | revision workflow, 4-step wizard |
| Document | 🟢 Active | core DMS, file upload |
| User / Auth | 🟢 Active | JWT, RBAC |
| RAG pipeline | 🟡 In progress | BullMQ ingestion, Qdrant, EasyOCR |
| Notification | 🔴 Planned | — |
| Report | 🔴 Planned | — |

---

## Key file paths

| ต้องการ | Path |
|---|---|
| DB entities | `backend/src/database/entities/` |
| Migrations | `backend/src/database/migrations/` |
| NestJS modules | `backend/src/modules/` |
| Next.js pages | `frontend/app/(dashboard)/` |
| API hooks | `frontend/lib/api/` |
| Shared types | `frontend/types/` |
| RBAC guard | `backend/src/common/auth/` |
| CI workflow | `.gitea/workflows/ci-deploy.yml` |
| ADR docs | `specs/06-Decision-Records/` |

---

## Code conventions

- TypeScript strict — ห้าม `any`, ห้าม non-null assertion (`!.`) บน DB results
- API response envelope: `{ data, meta, error }`
- Thai + English field support บน document metadata
- File upload → MinIO เท่านั้น (ห้าม local disk)
- async ทุกตัวต้อง try/catch หรือ `.catch()`
- Commit format: `type(scope): description`
  - เช่น `feat(correspondence): add revision workflow`
  - เช่น `fix(ci): fix pnpm cache mount path`

---

## Rule enforcement tiers

### 🔴 Hard — ห้ามทำโดยเด็ดขาด
- commit ตรง `main` / `develop` โดยไม่ผ่าน PR
- รัน DB migration โดยไม่ได้รับ human approval
- ลบไฟล์ — ให้ย้ายไป `_archive/<filename>.<timestamp>` แทน
- เพิ่ม npm package ที่ root `package.json` โดยไม่แจ้ง
- expose `.env` values ใน log / console / test fixtures

### 🟡 Flag — แจ้งก่อนดำเนินการ
- แก้ไข `docker-compose.yml` หรือ `.gitea/workflows/`
- เพิ่มหรือแก้ DB schema (ต้องมี migration file คู่กัน)
- เพิ่ม npm package ใหม่ (ต้องบอก package name + justification)
- แก้ไข shared `packages/*` ที่กระทบหลาย apps

### 🟢 Suggest — แนะนำแต่ดำเนินการได้
- code style, naming convention
- test coverage
- refactoring ที่ไม่เปลี่ยน public API

---

## Before any code task

1. อ่าน entity files ที่เกี่ยวข้องใน `backend/src/database/entities/`
2. ตรวจ migrations ที่มีอยู่ใน `backend/src/database/migrations/`
3. ตรวจว่า module มีอยู่แล้วก่อน scaffold ใหม่
4. อ่าน ADR ที่เกี่ยวข้องใน `specs/06-Decision-Records/`

---

## When blocked

หยุดทันที และ output:

```
⚠️ BLOCKED: [คำถาม]
Assumption ที่ตั้งใจจะใช้: [assumption]
รอ human input ก่อนดำเนินการต่อ
```

ห้าม guess business logic, permission rules, หรือ DB schema

---

## Agent-specific notes

### Hermes (ASUSTOR)
- Terminal backend: SSH → ASUSTOR itself
- Working directory: `/volume1/gitea-repos/lcbp3-dms`
- Scheduled: CI audit daily 08:00 → report ผ่าน Telegram
- Skills autoload: `dms-context`, `gitea-watch`, `rag-ops`

### agy CLI
- Model: Gemini 3.5 Flash (orchestration)
- Hermes เป็น MCP server → `hermes-memory` tool
- Max parallel subagents: 3
- Delegate bash/git execution → Hermes via MCP

### Windsurf / Cascade
- MCP: MariaDB (schema lookup), Gitea (PR/issue)
- Rules enforced via `AGENTS.md` v1.9.7 (master), synced to `.windsurfrules` และ `.agents/rules/`
- Primary tool สำหรับ active coding

## Setup context
#!/usr/bin/env bash
# setup-context.sh — wire CONTEXT-ADR-031.md ไปยัง tools ทุกตัว
#
# รันจาก: specs/06-Decision-Records/CONTEXT-ADR-031.md (ดูส่วนท้ายไฟล์)
# รันบน: laptop (สำหรับ agy + Windsurf) และ ASUSTOR (สำหรับ Hermes)
#
# Usage:
#   cd specs/06-Decision-Records && bash CONTEXT-ADR-031.sh laptop
#   cd specs/06-Decision-Records && bash CONTEXT-ADR-031.sh asustor
#   cd specs/06-Decision-Records && bash CONTEXT-ADR-031.sh all

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && cd ../.. && pwd)"
CONTEXT_FILE="$REPO_ROOT/specs/06-Decision-Records/CONTEXT-ADR-031.md"

# ── helper ──────────────────────────────────────────────────
info()    { echo "  ✅ $*"; }
warn()    { echo "  ⚠️  $*"; }
section() { echo; echo "▶ $*"; }

# ── laptop: agy ─────────────────────────────────────────────
setup_agy() {
  section "agy CLI"

  AGY_DIR="$HOME/.gemini/antigravity-cli"
  AGY_GLOBAL_DIR="$HOME/.gemini/config"

  mkdir -p "$AGY_DIR" "$AGY_GLOBAL_DIR"

  # symlink CONTEXT-ADR-031.md → agy context directory
  AGY_CONTEXT_LINK="$AGY_DIR/DMS_CONTEXT_ADR031.md"
  ln -sf "$CONTEXT_FILE" "$AGY_CONTEXT_LINK"
  info "symlink: $AGY_CONTEXT_LINK → $CONTEXT_FILE"

  # patch settings.json: เพิ่ม contextFiles entry
  SETTINGS="$AGY_DIR/settings.json"
  if [ ! -f "$SETTINGS" ]; then
    cat > "$SETTINGS" <<'EOF'
{
  "model": "gemini-3.5-flash-high",
  "theme": "Default",
  "autoAccept": false,
  "contextFiles": [],
  "permissions": {
    "defaultMode": "suggest",
    "autoApprove": [
      "read_file",
      "list_directory",
      "mcp_hermes-memory_recall",
      "mcp_mariadb_query"
    ]
  },
  "subagents": { "maxParallel": 3 }
}
EOF
    info "สร้าง settings.json ใหม่"
  fi

  # เพิ่ม contextFiles entry ถ้ายังไม่มี
  if ! grep -q "DMS_CONTEXT_ADR031" "$SETTINGS"; then
    # ใช้ python เพราะ jq อาจไม่ติดตั้ง
    python3 - "$SETTINGS" "$AGY_CONTEXT_LINK" <<'PYEOF'
import json, sys
settings_path, context_path = sys.argv[1], sys.argv[2]
with open(settings_path) as f:
    s = json.load(f)
if "contextFiles" not in s:
    s["contextFiles"] = []
if context_path not in s["contextFiles"]:
    s["contextFiles"].append(context_path)
with open(settings_path, "w") as f:
    json.dump(s, f, indent=2, ensure_ascii=False)
print(f"  ✅ เพิ่ม contextFiles: {context_path}")
PYEOF
  else
    info "contextFiles มีอยู่แล้วใน settings.json"
  fi
}

# ── laptop: Windsurf ─────────────────────────────────────────
setup_windsurf() {
  section "Windsurf .windsurfrules"

  RULES="$REPO_ROOT/.windsurfrules"
  IMPORT_LINE="@import specs/06-Decision-Records/CONTEXT-ADR-031.md"

  if [ ! -f "$RULES" ]; then
    warn ".windsurfrules ไม่พบ — ข้ามขั้นตอนนี้"
    return
  fi

  if grep -q "@import specs/06-Decision-Records/CONTEXT-ADR-031.md" "$RULES"; then
    info "@import specs/06-Decision-Records/CONTEXT-ADR-031.md มีอยู่แล้วใน .windsurfrules"
  else
    # เพิ่ม import ที่บรรทัดแรก
    TMPFILE=$(mktemp)
    echo "$IMPORT_LINE" | cat - "$RULES" > "$TMPFILE"
    mv "$TMPFILE" "$RULES"
    info "เพิ่ม @import specs/06-Decision-Records/CONTEXT-ADR-031.md ที่บรรทัดแรกของ .windsurfrules"
  fi
}

# ── ASUSTOR: Hermes ──────────────────────────────────────────
setup_hermes() {
  section "Hermes (ASUSTOR)"

  HERMES_CONFIG_DIR="/volume1/docker/hermes/config"

  if [ ! -d "$HERMES_CONFIG_DIR" ]; then
    warn "$HERMES_CONFIG_DIR ไม่พบ — รัน script นี้บน ASUSTOR หรือสร้าง folder ก่อน"
    return
  fi

  # symlink CONTEXT-ADR-031.md → MEMORY.md ที่ Hermes อ่าน
  MEMORY_LINK="$HERMES_CONFIG_DIR/MEMORY.md"
  ln -sf "$CONTEXT_FILE" "$MEMORY_LINK"
  info "symlink: $MEMORY_LINK → $CONTEXT_FILE (specs/06-Decision-Records/CONTEXT-ADR-031.md)"

  # reload Hermes config (ถ้า container รันอยู่)
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^hermes$"; then
    docker exec hermes hermes reload 2>/dev/null && info "Hermes reloaded" || warn "ไม่สามารถ reload Hermes — รีสตาร์ท container แทน"
  else
    warn "Hermes container ไม่ได้รัน — symlink พร้อมแล้ว จะมีผลตอน restart"
  fi
}

# ── main ────────────────────────────────────────────────────
TARGET="${1:-all}"

case "$TARGET" in
  laptop)
    setup_agy
    setup_windsurf
    ;;
  asustor)
    setup_hermes
    ;;
  all)
    setup_agy
    setup_windsurf
    setup_hermes
    ;;
  *)
    echo "Usage: $0 [laptop|asustor|all]"
    exit 1
    ;;
esac

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ CONTEXT-ADR-031.md wired สำเร็จ"
echo "  แก้ agent context → แก้ที่ specs/06-Decision-Records/CONTEXT-ADR-031.md"
echo "  แก้ domain context → แก้ที่ CONTEXT.md (root)"
echo "  tools ทุกตัวได้รับ update อัตโนมัติ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
