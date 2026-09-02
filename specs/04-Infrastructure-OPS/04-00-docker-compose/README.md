# Docker Compose Stacks (post-ADR-041)

Production compose files for the NP-DMS / LCBP3 platform. All stacks share one external Docker network `lcbp3`.

> **ADR-041 (Server Consolidation, 2026-06-20):** ย้าย services ทั้งหมดไปรวมบน `np-dms-lcbp3` (single-host Docker, 4 layers) — QNAP และ Desk-5439 ถูก archived (ดู `99-archives/04-00-docker-compose-QNAP/` และ `99-archives/04-00-docker-compose-Desk-5439/`)
> **Real-world state (2026-08-03):** QNAP ไม่รัน Docker อีกต่อไป — Edge proxy ใช้ Cloudflare Tunnel บน `np-dms-lcbp3` (เปลี่ยนจาก ADR-041 เดิมที่วาง NPM ไว้บน QNAP)

## Layout

```
04-00-docker-compose/
├── .env.template                    # Master template (placeholders)
├── x-base.yml                       # Shared YAML anchors (S2)
├── SECURITY-MIGRATION-v1.8.6.md     # Full C/H/M/L/S migration runbook (historical — pre-ADR-041)
├── np-dms-lcbp3/                    # ⭐ Current production stack (4 layers, ADR-041)
│   ├── 00-basic/        portainer
│   ├── 01-infrastructure/  mariadb, pma, cache (redis), search (elasticsearch), qdrant, exporters
│   ├── 02-platform/     gitea, n8n
│   ├── 03-application/  clamav, backend, frontend
│   ├── 04-ai/           ocr-sidecar, ollama, ollama-metrics (ADR-040/043)
│   ├── .env             # gitignored live env
│   ├── .env.template    # master template
│   ├── MIGRATION-PLAN.md  # ADR-041 migration runbook (historical)
│   ├── README.md          # 4-layer stack overview
│   └── SPECS-VERIFICATION-PLAN.md
└── ASUSTOR/
    ├── registry/      docker-compose.yml            (registry, registry-ui)
    ├── gitea-runner/  docker-compose.yml            (gitea act_runner)
    └── monitoring/    docker-compose.yml            (prometheus, grafana, loki, promtail, uptime-kuma, node-exporter, cadvisor)
```

## Usage (per stack)

```bash
# 1. place a gitignored .env in the stack folder
cp .env.example .env              # or copy relevant vars from ../../.env.template
vi .env
chmod 600 .env

# 2. up the stack (Compose V2)
docker compose --env-file .env -f docker-compose.yml up -d
```

## 🐳 Live Edit Protocol (post-ADR-041)

> [!IMPORTANT]
> **แก้ docker-compose.yml ผิดที่ → container รัน config เก่า แก้ไม่ติด**

### แก้ที่ไหน (ตามลำดับ)

| ขั้นตอน | Path | หน้าที่ |
| --- | --- | --- |
| **1. Live edit** | `/opt/np-dms/{00-basic,01-infrastructure,02-platform,03-application,04-ai,04-ai/ocr-sidecar}/docker-compose.yml` | แก้ที่นี่ก่อน — container รันจากที่นี่ |
| **2. Sync to repo** | `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/<layer>/docker-compose.yml` | `cp` กลับเข้า repo เพื่อ commit |
| **3. Commit + push** | repo `np-dms-lcbp3` | commit พร้อม message อธิบาย |

### คำสั่งที่ใช้ (ตาม `dockerup.sh` / `dockerstart.sh`)

> [!CAUTION]
> **ห้าม `docker compose up -d` โดยไม่ระบุ `--env-file`** — env vars หาย ทำให้ container fail

```bash
# Start ทุก layer (หลัง reboot) — ตาม dockerup.sh
cd /opt/np-dms/00-basic && sudo docker compose --env-file ../.env up -d
cd /opt/np-dms/01-infrastructure && sudo docker compose --env-file ../.env up -d
cd /opt/np-dms/02-platform && sudo docker compose --env-file ../.env up -d
cd /opt/np-dms/03-application && sudo docker compose --env-file ../.env up -d
cd /opt/np-dms/04-ai && sudo docker compose --env-file ../.env up -d
cd /opt/np-dms/04-ai/ocr-sidecar && sudo docker compose --env-file ../../.env up -d

# Start container ที่หยุดไว้ (เร็วกว่า) — ตาม dockerstart.sh
cd /opt/np-dms/00-basic && sudo docker compose --env-file ../.env start
# ... (ลำดับเดียวกัน แต่ใช้ start แทน up -d)

# Rebuild + recreate container เดียว (เช่น ocr-sidecar)
cd /opt/np-dms/04-ai/ocr-sidecar && docker compose --env-file ../../.env build ocr-sidecar
cd /opt/np-dms/04-ai/ocr-sidecar && docker compose --env-file ../../.env up -d ocr-sidecar

# Rebuild + recreate backend (มี Dockerfile, context = repo root)
cd /opt/np-dms-lcbp3 && docker build -f backend/Dockerfile -t lcbp3-backend:latest .
cd /opt/np-dms/03-application && sudo docker compose --env-file ../.env up -d backend
```

### กฎสำคัญ

- **ห้ามแก้ repo ก่อนแล้วค่อย copy ไป live** — จะทำให้ live กับ repo ไม่ตรง
- **หลังแก้ live ต้อง sync กลับ repo ทันที** — `cp /opt/np-dms/<layer>/docker-compose.yml /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/<layer>/`
- **`up -d` สร้าง container ใหม่, `start` ใช้ container เดิม** — ใช้ให้ถูกต้อง
- **`/opt/np-dms/.env`** เป็น env file กลาง — ทุก layer อ้างผ่าน `../.env` หรือ `../../.env`
- **Backend image build จาก repo root** — Dockerfile context = workspace root ไม่ใช่ `backend/`

## Security (Non-Negotiable — see `SECURITY-MIGRATION-v1.8.6.md`)

- **Tier-1:** No secrets in compose files; `.env` is gitignored; `JWT_SECRET` ≠ `AUTH_SECRET`
- **Redis:** `--requirepass` enforced on server
- **Elasticsearch:** internal network only
- **MariaDB:** root and app user split; loopback bind
- **MongoDB:** `--auth --keyFile`
- **Registry:** htpasswd
- **ClamAV:** mandatory upstream of backend uploads (ADR-016)
- **AI boundary:** Ollama / AI on `np-dms-lcbp3` only (ADR-041 server consolidation; ADR-023/043 boundary policy — ADR-018 archived)

## Shared YAML Anchors (S2)

If your Compose version supports `include:` (V2.20+), reference `x-base.yml`:

```yaml
include:
  - path: ../../x-base.yml

services:
  mysvc:
    <<: [*restart_policy, *default_logging, *hardening]
```

Otherwise, keep the inline anchor pattern (current repo-wide convention).

## Image Pinning Strategy

The LCBP3 platform uses a **hybrid image pinning approach**:

### Infrastructure Services (Pinned)
All infrastructure services use **explicitly pinned versions** for stability:

```yaml
# Examples
redis:7-alpine
elasticsearch:8.11.1
mariadb:11.8
gitea/gitea:1.22.3-rootless
n8nio/n8n:1.66.0
```

**Rationale:**
- Infrastructure services evolve independently
- Breaking changes in Redis/Elasticsearch/MariaDB can cause data corruption
- Pinned versions ensure predictable behavior across deployments

### Application Services (Variable)
Application images use **environment variable tags** for CI/CD flexibility:

```yaml
backend:
  image: lcbp3-backend:${BACKEND_IMAGE_TAG:-latest}
frontend:
  image: lcbp3-frontend:${FRONTEND_IMAGE_TAG:-latest}
```

**Rationale:**
- Application code changes frequently with each release
- CI pipelines inject SHA-specific tags per release
- `:latest` fallback enables local development
- Environment variable allows rollback to specific versions

### Version Control
- **Infrastructure versions** updated manually in compose files
- **Application versions** controlled via CI/CD pipeline environment variables
- **Release policy** documented in `04-08-release-management-policy.md`

## Secret Management Roadmap (S1)

Current: `env_file: .env` (gitignored) per stack.

Future (order of preference):

1. **Docker secrets** (Swarm) — rotate-in-place, no FS exposure
2. **External secret manager** — Infisical / Vault / Bitwarden Secrets Manager
3. **SOPS-encrypted** `.env.sops` files in the repo (age/GPG) — nice middle ground; Ops unseals at deploy time

Tracking issue: open a task under `specs/04-Infrastructure-OPS/` when choosing a direction.

## Per-stack `.env.example` Files (S3)

Each stack has its own `.env.example` listing only the vars it consumes. Copy → edit → `chmod 600`.

## Release / Deploy Gates

See `specs/04-Infrastructure-OPS/04-08-release-management-policy.md` for the blue-green rollout procedure.
