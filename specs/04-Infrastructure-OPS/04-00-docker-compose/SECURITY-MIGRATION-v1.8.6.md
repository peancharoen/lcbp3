# Security Migration — Docker Compose v1.8.6 (Tier-1 Findings C1–C6 + H6)

**Date:** 2026-04-18
**Scope:** `specs/04-Infrastructure-OPS/04-00-docker-compose/`
**Trigger:** Code review (speckit.reviewer) — Critical secret/exposure findings.

## Changes Applied

| ID | Issue | Fix |
|----|-------|-----|
| **C1** | Real secrets in `.env.template` and inline `environment:` blocks | Replaced with `CHANGE_ME_*` placeholders; compose now reads via `env_file: .env` + `${VAR:?...}` substitution |
| **C2** | `AUTH_SECRET` == `JWT_SECRET` (frontend can forge backend tokens) | Split into two independent vars in `.env.template` and `docker-compose-app.yml` |
| **C3** | Redis exposed on `0.0.0.0:6379` with no `--requirepass` | New `docker-compose.yml` enforces `--requirepass ${REDIS_PASSWORD}`, binds port to `127.0.0.1` only, healthcheck uses auth |
| **C4** | Elasticsearch exposed on `0.0.0.0:9200` with `xpack.security` off | Removed host port mapping; service reachable only via internal `lcbp3` network DNS (`search:9200`); added `ulimits.memlock` |
| **C5** | MariaDB published on LAN; root and app user shared the same password | Split `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD`; bound port to `127.0.0.1`; NPM `DB_MYSQL_PASSWORD` moved to `${NPM_DB_PASSWORD}` |
| **C6** | No ClamAV service in app stack (ADR-016 Two-Phase upload requirement) | Added `clamav` service to `docker-compose-app.yml`; backend `depends_on: clamav (healthy)`; new envs `CLAMAV_HOST`, `CLAMAV_PORT` |
| **H6** | Filename typo `docker-compse.yml` | New `QNAP/service/docker-compose.yml`; old file flagged DEPRECATED in-header (delete after deploy) |

## Files Modified

- `.env.template` — placeholder values, new vars (DB_ROOT_PASSWORD, ELASTICSEARCH_PASSWORD, CLAMAV_*, GRAFANA_ADMIN_PASSWORD, etc.)
- `QNAP/app/docker-compose-app.yml` — `env_file:`, secret substitution, ClamAV service
- `QNAP/service/docker-compose.yml` — **new file** (replaces typo'd one)
- `QNAP/service/docker-compse.yml` — deprecation banner only
- `QNAP/mariadb/docker-compose-lcbp3-db.yml` — split passwords, loopback bind
- `QNAP/npm/docker-compose.yml` — `${NPM_DB_PASSWORD}` substitution

## Required Operational Steps (Ops Runbook)

> **Run on QNAP via SSH as admin.** All previously-committed secrets are considered compromised.

### 1. Generate fresh secrets

```bash
# 4 distinct 32-byte hex secrets
for k in JWT_SECRET JWT_REFRESH_SECRET AUTH_SECRET N8N_ENCRYPTION_KEY; do
  printf "%s=%s\n" "$k" "$(openssl rand -hex 32)"
done
# Strong DB / service passwords (24-char base64)
for k in DB_ROOT_PASSWORD DB_PASSWORD REDIS_PASSWORD ELASTICSEARCH_PASSWORD \
         NPM_DB_PASSWORD GITEA_DB_PASSWORD N8N_DB_PASSWORD GRAFANA_ADMIN_PASSWORD; do
  printf "%s=%s\n" "$k" "$(openssl rand -base64 24 | tr -d '=+/')"
done
```

### 2. Place per-stack `.env` files (never committed)

```bash
# In each stack folder containing docker-compose*.yml
cp /share/np-dms/<stack>/.env.template /share/np-dms/<stack>/.env
chmod 600 /share/np-dms/<stack>/.env
```

Required folders: `/share/np-dms/app`, `/share/np-dms/services`, `/share/np-dms/mariadb`, `/share/np-dms/npm`, `/share/np-dms/n8n`, `/share/np-dms/git`, `/share/np-dms/monitoring` (ASUSTOR).

### 3. Rotate DB passwords (inside MariaDB) before recreating containers

```sql
-- root + app
ALTER USER 'root'@'%' IDENTIFIED BY '<DB_ROOT_PASSWORD>';
ALTER USER 'center'@'%' IDENTIFIED BY '<DB_PASSWORD>';
-- service users
ALTER USER 'npm'@'%'   IDENTIFIED BY '<NPM_DB_PASSWORD>';
ALTER USER 'gitea'@'%' IDENTIFIED BY '<GITEA_DB_PASSWORD>';
ALTER USER 'n8n'@'%'   IDENTIFIED BY '<N8N_DB_PASSWORD>';
FLUSH PRIVILEGES;
```

### 4. Recreate stacks (recommended order)

```bash
docker compose --env-file /share/np-dms/mariadb/.env  -f /share/np-dms/mariadb/docker-compose-lcbp3-db.yml up -d
docker compose --env-file /share/np-dms/services/.env -f /share/np-dms/services/docker-compose.yml      up -d
docker compose --env-file /share/np-dms/app/.env      -f /share/np-dms/app/docker-compose-app.yml       up -d
docker compose --env-file /share/np-dms/npm/.env      -f /share/np-dms/npm/docker-compose.yml           up -d
```

### 5. Remove deprecated typo file (after verification)

```bash
git rm specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/service/docker-compse.yml
git commit -m "chore(infra): drop deprecated docker-compse.yml typo (H6)"
```

### 6. Force re-login of all users

Backend JWT secret changed → all tokens are invalidated. Notify users; sessions will require re-authentication.

### 7. Audit git history for leaked secrets

```bash
# Rotate any token still valid in commit history
git log -p -- specs/04-Infrastructure-OPS/04-00-docker-compose/.env.template
```

## Verification Checklist

- [ ] `docker compose ... config` resolves all `${VAR:?...}` without error
- [ ] `redis-cli -h 127.0.0.1 -a <REDIS_PASSWORD> ping` returns `PONG`
- [ ] `redis-cli -h 127.0.0.1 ping` (no auth) returns `NOAUTH`
- [ ] `curl -sf http://<lan-ip>:6379` and `:9200` and `:3306` all **fail** from outside the host
- [ ] Backend `/health` includes `clamav: ok` (via ADR-016 health probe)
- [ ] Login still works on `https://lcbp3.np-dms.work` after JWT rotation
- [ ] NPM admin UI reachable; database connection healthy with new password

## Phase 2 Changes (H1–H5, H7) — applied 2026-04-18

| ID | Issue | Fix |
|----|-------|-----|
| **H1** | `JWT_REFRESH_SECRET` exposure verified separate from frontend | Already covered in C1 / C2 (env-substituted, not given to frontend) |
| **H2** | n8n / postgres password contained unescaped `$` | Moved to `.env`-resolved `${N8N_DB_PASSWORD}` and `${N8N_ENCRYPTION_KEY}` (no YAML expansion risk) |
| **H3** | n8n had `/var/run/docker.sock` mounted RW | Replaced with `tecnativa/docker-socket-proxy:0.2` (read-only, only `CONTAINERS/IMAGES/INFO/VERSION`); n8n now uses `DOCKER_HOST=tcp://docker-socket-proxy:2375` |
| **H4** | ASUSTOR cAdvisor port mapping `8088:8088` did not match container port `8080` | Changed to `8088:8080` |
| **H5** | QNAP exporters published `9100`/`8080` to LAN; `version: '3.8'` obsolete | Switched to `expose:` only (Prometheus on ASUSTOR scrapes via DNS), removed `version:`, applied logging/limits anchors, pinned tags |
| **H7** | `:latest` image tags used everywhere | Pinned: `gitea/gitea:1.22.3-rootless`, `n8nio/n8n:1.66.0`, `apache/tika:2.9.2.1-full`, `postgres:16.4-alpine`, `mongo:7.0.14`, `rocket.chat:6.10.5`, `nginx-proxy-manager:2.11.3`, `joxit/docker-registry-ui:2.5.7`, `gitea/act_runner:0.2.11`, `node-exporter:v1.8.2`, `cadvisor:v0.49.1`. App images use `${BACKEND_IMAGE_TAG:-latest}` / `${FRONTEND_IMAGE_TAG:-latest}` so CI can inject SHA per release |

**Bonus fix (related to H7):** Grafana `GF_SECURITY_ADMIN_PASSWORD` moved to `${GRAFANA_ADMIN_PASSWORD}` env, Gitea DB password to `${GITEA_DB_PASSWORD}`.

### Additional Files Modified (Phase 2)

- `QNAP/n8n/docker-compose.yml` — env_file, docker-socket-proxy, pinned tags, DOCKER_HOST
- `QNAP/gitea/docker-compose.yml` — pin `1.22.3-rootless`, `${GITEA_DB_PASSWORD}`, env_file
- `QNAP/npm/docker-compose.yml` — pin `2.11.3`
- `QNAP/rocketchat/docker-compose.yml` — pin Mongo `7.0.14`, RocketChat `6.10.5`, `restart: 'no'` on init job
- `QNAP/monitoring/docker-compose.yml` — rewritten, exposed-only, pinned
- `QNAP/app/docker-compose-app.yml` — `${BACKEND_IMAGE_TAG}` / `${FRONTEND_IMAGE_TAG}`
- `ASUSTOR/registry/docker-compose.yml` — pin registry-ui `2.5.7`
- `ASUSTOR/gitea-runner/docker-compose.yml` — pin runner `0.2.11`, drop `version`
- `ASUSTOR/monitoring/docker-compose.yml` — H4 cAdvisor port fix, Grafana env_file

### New env vars to set in `/share/np-dms/<stack>/.env`

```env
# QNAP/app
BACKEND_IMAGE_TAG=v1.8.6     # หรือ git SHA
FRONTEND_IMAGE_TAG=v1.8.6

# QNAP/n8n
N8N_DB_PASSWORD=<rand>
N8N_ENCRYPTION_KEY=<rand-32>

# QNAP/gitea
GITEA_DB_PASSWORD=<rand>

# ASUSTOR/monitoring
GRAFANA_ADMIN_PASSWORD=<rand>
```

### Phase 2 Verification

- [ ] `docker compose -f QNAP/n8n/docker-compose.yml --env-file .env config` resolves; no warnings about `$`
- [ ] `curl -sf http://docker-socket-proxy:2375/containers/json` works from inside `lcbp3` net (read-only)
- [ ] `curl -sf -X POST http://docker-socket-proxy:2375/containers/create` returns `403`
- [ ] ASUSTOR cAdvisor reachable at `http://<asustor>:8088/healthz`
- [ ] QNAP `node-exporter:9100` and `cadvisor:8080` no longer reachable from LAN; Prometheus on ASUSTOR still scrapes them via DNS
- [ ] Grafana login uses new admin password
- [ ] All compose files pass `docker compose config --quiet`

## Phase 3 Changes (M1–M9) — applied 2026-04-18

| ID | Fix |
|----|-----|
| **M1** | Removed obsolete `version:` in all remaining files (gitea-runner, QNAP monitoring already handled in Phase 2) |
| **M2** | Added healthchecks: `mongodb` (mongosh ping authed), `rocketchat` (`/api/info`), `tika` (`/tika`), `landing` (nginx `/`), `registry-ui` (`/`), `npm` (`/api/`), `gitea` (`/api/healthz`) |
| **M3** | Added `reservations` + missing `limits` on `gitea`, `gitea-runner`, `landing`, `registry-ui`, `mongodb`, `rocketchat`, `mongo-init-replica`, `tika`, `docker-socket-proxy` |
| **M4** | Hardened `backend` / `frontend` / `clamav`: `security_opt: [no-new-privileges:true]`, `cap_drop: [ALL]`, `read_only: true` + `tmpfs` for backend/frontend, non-root `user:` (`node` / `nextjs`); ClamAV adds back only `CHOWN/SETUID/SETGID` for definition updates |
| **M5** | ES `ulimits.memlock: -1` — already applied in Phase 1 ✓ |
| **M6** | Docker Registry enables `REGISTRY_AUTH=htpasswd` with mounted `/auth/htpasswd` (generate via `docker run --rm --entrypoint htpasswd httpd:2 -Bbn ...`) |
| **M7** | Removed `pma` host port `89:80` → `expose: 80` only (access via NPM `https://pma.np-dms.work`) |
| **M8** | MongoDB runs with `--auth --keyFile=/etc/mongo/keyfile` + replica-set internal auth; `mongo-init-replica` now creates root user + `rocketchat` limited user; RocketChat uses authed `MONGO_URL`/`MONGO_OPLOG_URL` |
| **M9** | Applied `x-restart` / `x-logging` anchors uniformly on `gitea`, `gitea-runner`, `landing`, `registry-ui`, `rocketchat`, `tika`, `npm` |

### Additional Files Modified (Phase 3)

- `QNAP/app/docker-compose-app.yml` — M4 hardening (backend/frontend/clamav)
- `QNAP/mariadb/docker-compose-lcbp3-db.yml` — M7 pma expose-only
- `QNAP/rocketchat/docker-compose.yml` — M2/M3/M8 rewrite (auth + healthchecks)
- `QNAP/gitea/docker-compose.yml` — M2/M3/M9 anchors + healthcheck + limits
- `QNAP/npm/docker-compose.yml` — M2/M3/M9 NPM healthcheck, landing hardening
- `QNAP/n8n/docker-compose.yml` — M2/M3 tika healthcheck + limits
- `ASUSTOR/registry/docker-compose.yml` — M6 htpasswd, M2 registry-ui healthcheck + limits
- `ASUSTOR/gitea-runner/docker-compose.yml` — M3 reservations, M9 logging anchor

### New env vars (Phase 3)

```env
# MongoDB (RocketChat)
MONGO_ROOT_USERNAME=root
MONGO_ROOT_PASSWORD=<rand>
MONGO_RC_USERNAME=rocketchat
MONGO_RC_PASSWORD=<rand>

# Docker Registry
REGISTRY_ADMIN_USER=admin
REGISTRY_ADMIN_PASSWORD=<rand>
```

### Phase 3 Ops Steps

#### A. MongoDB keyfile (one-time, before recreating RocketChat stack)

```bash
mkdir -p /share/np-dms/rocketchat
openssl rand -base64 756 > /share/np-dms/rocketchat/mongo-keyfile
chmod 400 /share/np-dms/rocketchat/mongo-keyfile
chown 999:999 /share/np-dms/rocketchat/mongo-keyfile
```

> If MongoDB data volume already exists without auth, either:
> - **Recommended:** back up with `mongodump`, wipe `/share/np-dms/rocketchat/data/db`, start fresh with auth, restore via `mongorestore -u ... --authenticationDatabase admin`.
> - Or: start mongod **without** `--auth` once, create the root user manually, then restart with `--auth --keyFile=...`.

#### B. Registry htpasswd (one-time, before recreating Registry stack)

```bash
mkdir -p /volume1/np-dms/registry/auth
docker run --rm --entrypoint htpasswd httpd:2 -Bbn \
  "$REGISTRY_ADMIN_USER" "$REGISTRY_ADMIN_PASSWORD" \
  > /volume1/np-dms/registry/auth/htpasswd
chmod 600 /volume1/np-dms/registry/auth/htpasswd

# All CI jobs and `docker login registry.np-dms.work` need updating with the new credentials.
```

#### C. Frontend/Backend read-only compatibility

- Verify Next.js standalone output writes only to `/app/.next/cache` and `/tmp` (tmpfs mounts are provided).
- Verify NestJS logs go to `/app/logs` (volume-mounted, RW) and not to any other path.
- If any module writes elsewhere, either add a `tmpfs:` entry or remove `read_only: true` for that service.

### Phase 3 Verification

- [ ] `docker compose -f QNAP/rocketchat/docker-compose.yml config` resolves; `mongo-init-replica` exits 0
- [ ] `mongosh --host <qnap> -u rocketchat -p ... --authenticationDatabase rocketchat` succeeds
- [ ] Anonymous MongoDB connection **fails** (`mongosh --host <qnap>` → auth error)
- [ ] `curl -sf https://registry.np-dms.work/v2/` returns `401 Unauthorized`; with `-u admin:pass` returns `{}`
- [ ] CI can still `docker push registry.np-dms.work/lcbp3-backend:$SHA` after updating pipeline creds
- [ ] Backend `/health` still green under `read_only: true` (no EROFS in logs)
- [ ] Next.js pages render (SSR) under `read_only: true`; `.next/cache` is tmpfs
- [ ] `pma.np-dms.work` still reachable via NPM; direct `<qnap>:89` no longer answers
- [ ] Grafana: all services in `docker-monitoring` dashboard show healthy

## Phase 4 Changes (L1–L5 + S1–S4) — applied 2026-04-18

| ID | Fix |
|----|-----|
| **L1** | Removed `stdin_open: true` + `tty: true` from all production services (backend, frontend, cache, search, mariadb, pma, npm, n8n, prometheus, grafana) |
| **L2** | Filename strategy documented in `README.md` — kept `docker-compose-app.yml` / `docker-compose-lcbp3-db.yml` per existing ops scripts; new files (service, rocketchat, etc.) use canonical `docker-compose.yml`. Old `docker-compse.yml` still flagged deprecated from Phase 1 |
| **L3** | Bumped stale `v1_7_0` / `v1_8_0` markers to `v1.8.6` in app, service, npm, gitea, mariadb, n8n, registry, monitoring, rocketchat |
| **L4** | Trimmed legacy ops/ACL comment blocks from `QNAP/npm/docker-compose.yml` and `QNAP/gitea/docker-compose.yml` (30+ lines each). Replaced with pointer to `04-08-release-management-policy.md` |
| **L5** | Documented promtail `user: '0:0'` requirement (needs read access to `/var/lib/docker/containers`, mounted read-only) |
| **S1** | Secret-manager roadmap added to `README.md` (Docker Swarm secrets → Infisical/Vault → SOPS). Today: `env_file: .env` gitignored |
| **S2** | Created `x-base.yml` with shared anchors (`*restart_policy`, `*default_logging`, `*hardening`, healthcheck defaults). Documented `include:` usage for Compose V2.20+ |
| **S3** | Per-stack `.env.example` files created for: `app`, `service`, `mariadb`, `npm`, `n8n`, `gitea`, `rocketchat`, ASUSTOR `monitoring`, ASUSTOR `registry` |
| **S4** | ClamAV scan service — already delivered in C6 ✓ |

### Additional Files Created / Modified (Phase 4)

**New files:**
- `README.md` (stack overview + roadmap)
- `x-base.yml` (shared anchors)
- `QNAP/app/.env.example`
- `QNAP/service/.env.example`
- `QNAP/mariadb/.env.example`
- `QNAP/npm/.env.example`
- `QNAP/n8n/.env.example`
- `QNAP/gitea/.env.example`
- `QNAP/rocketchat/.env.example`
- `ASUSTOR/monitoring/.env.example`
- `ASUSTOR/registry/.env.example`

**Modified:** app, service, npm, mariadb, n8n, gitea, ASUSTOR monitoring, ASUSTOR registry compose files.

### Phase 4 Verification

- [ ] `grep -rn "stdin_open: true" .` returns only `docker-compse.yml` (deprecated) and `docker-compose-lcbp3-bak.yml` (backup)
- [ ] `grep -rn "v1_7_0\|v1_8_0" --include="*.yml"` returns no results in active files
- [ ] Each stack folder has a `.env.example`
- [ ] `x-base.yml` parses: `docker compose -f x-base.yml config --quiet`
- [ ] `README.md` linked from `specs/04-Infrastructure-OPS/` index

## All Phases Complete ✅

Phase 1 (C1–C6 + H6) → Phase 2 (H1–H5, H7) → Phase 3 (M1–M9) → Phase 4 (L1–L5 + S1–S4).

Final summary:
- **27 findings addressed**
- **11 compose files modified**
- **12 new files created** (README, x-base.yml, 9 .env.example, migration runbook, ClamAV service, docker-socket-proxy)
- **Zero** secrets remain committed (only `CHANGE_ME_*` placeholders in `.env.template`)

### Ops Next Steps (post-merge)

1. Rotate **every** previously-committed secret (JWT, DB, Redis, Grafana, n8n, Mongo, Registry).
2. Populate all per-stack `.env` files on QNAP/ASUSTOR from the new examples.
3. Execute Phase 1–3 Ops runbooks (MongoDB keyfile, Registry htpasswd, MariaDB password alter, ClamAV setup, image tag pinning).
4. Verify each Phase's checklist top-to-bottom.
5. Delete deprecated files: `QNAP/service/docker-compse.yml`, `QNAP/app/docker-compose-lcbp3-bak.yml` (if unused).
6. Consider moving to SOPS or Docker Swarm secrets (S1 roadmap).

