# Docker Compose Stacks (v1.8.6)

Production compose files for the NP-DMS / LCBP3 platform. All stacks share one external Docker network `lcbp3`.

## Layout

```
04-00-docker-compose/
├── .env.template                    # Master template (placeholders)
├── x-base.yml                       # Shared YAML anchors (S2)
├── SECURITY-MIGRATION-v1.8.6.md     # Full C/H/M/L/S migration runbook
├── QNAP/
│   ├── app/         docker-compose-app.yml          (backend, frontend, clamav)
│   ├── mariadb/     docker-compose-lcbp3-db.yml     (mariadb, pma)
│   ├── service/     docker-compose.yml              (cache, search)
│   ├── npm/         docker-compose.yml              (npm, landing)
│   ├── gitea/       docker-compose.yml              (gitea)
│   ├── n8n/         docker-compose.yml              (n8n, n8n-db, tika, docker-socket-proxy)
│   ├── rocketchat/  docker-compose.yml              (mongodb, mongo-init-replica, rocketchat)
│   └── monitoring/  docker-compose.yml              (node-exporter, cadvisor — QNAP-side exporters)
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

## Security (Non-Negotiable — see `SECURITY-MIGRATION-v1.8.6.md`)

- **Tier-1:** No secrets in compose files; `.env` is gitignored; `JWT_SECRET` ≠ `AUTH_SECRET`
- **Redis:** `--requirepass` enforced on server
- **Elasticsearch:** internal network only
- **MariaDB:** root and app user split; loopback bind
- **MongoDB:** `--auth --keyFile`
- **Registry:** htpasswd
- **ClamAV:** mandatory upstream of backend uploads (ADR-016)
- **AI boundary:** Ollama / AI only on Admin Desktop (ADR-018)

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
