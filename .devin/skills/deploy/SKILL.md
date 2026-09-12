---
name: deploy
description: Deploy the application via Gitea Actions CI/CD to np-dms-lcbp3 (192.168.10.11) — ADR-041 Server Consolidation
version: 2.0.0
depends-on:
  - verification-loop
handoffs: []
---

# deploy — Production Deployment

> 📌 See [`_LCBP3-CONTEXT.md`](../_LCBP3-CONTEXT.md) for LCBP3-specific conventions.

Deploy backend and/or frontend to **np-dms-lcbp3 (192.168.10.11)** via Gitea Actions CI/CD.
Follows `specs/04-Infrastructure-OPS/` , ADR-015 (Blue-Green + Auto-rollback), ADR-041 (Server Consolidation).

## 🏗️ Architecture (ADR-041)

```
Source repo:  /opt/np-dms-lcbp3/           (git clone — build context)
Runtime:      /opt/np-dms/{01-infrastructure,02-platform,03-application,04-ai}/
Env:          /opt/np-dms/.env             (master — shared across all layers)
Registry:     192.168.10.9:5000            (ASUSTOR Private Registry — artifact separation)

4-layer docker-compose:
  Layer 1: Infrastructure (mariadb, redis, es, qdrant, pma)
  Layer 2: Platform (gitea, n8n, n8n-db, docker-socket-proxy)
  Layer 3: Application (clamav, backend, frontend) ← deploy target
  Layer 4: AI (ocr-sidecar, ollama-metrics — Ollama = native systemd)
```

| Service  | Host Port | NPM Proxy           | Health Endpoint          |
| -------- | --------- | ------------------- | ------------------------ |
| backend  | 3000      | backend.np-dms.work | `/ping` (public, no JWT) |
| frontend | 3001      | lcbp3.np-dms.work   | HTTP 200                 |

> ⚠️ SEV-013: ใช้ `/ping` สำหรับ unauthenticated health probe — `/health` ต้องมี JWT และเปิดเผย infra details

## 📋 Pre-deployment Checklist

- [ ] All tests pass locally (`pnpm test:watch`)
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No `any` types introduced
- [ ] No `console.log` in committed code
- [ ] No `parseInt()` on UUID values (ADR-019)
- [ ] Schema changes applied to `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`
- [ ] Delta SQL file ready in `specs/03-Data-and-Storage/deltas/` (ถ้ามี schema change)
- [ ] Environment variables documented (NOT in `.env` files)
- [ ] `scripts/check-patches.sh` ผ่าน (patch integrity)

## 🚀 Deployment Methods

### Method 1: Push to main via `2git.sh` (Standard)

> 📌 ใช้ `2git.sh` แทน `git push` ตรง ๆ — script จะ fetch origin/main, squash commits, และ push อย่างปลอดภัย
> ดูรายละเอียด pre-push checks ใน skill [`2git-push`](../2git-push/SKILL.md)

```bash
cd /opt/np-dms-lcbp3

# Code changes (trigger CI + deploy)
bash 2git.sh "feat(<scope>): <description>"

# Docs/memory/specs only (skip CI — ไม่ trigger deploy)
bash 2git.sh --skip-ci "docs(memory): <description>"
```

`2git.sh` flow: `git add .` → commit (ถ้ามี) → squash commits ที่นำ origin/main → `git push origin main`

Pipeline จะรันอัตโนมัติ: `ci-quality` → `ci-test` → `deploy` (main branch only)

| กรณี                                    | Flag        | เหตุผล                              |
| --------------------------------------- | ----------- | ----------------------------------- |
| Code changes (backend/frontend/scripts) | (ไม่ใช้)    | ต้อง trigger CI build + deploy      |
| Docs/memory/specs only                  | `--skip-ci` | ไม่มี code changes → ไม่ต้อง deploy |
| Mixed (code + docs)                     | (ไม่ใช้)    | มี code changes → ต้อง deploy       |

### Method 2: Commit Message Tags (Skip selective steps)

> ⚠️ `2git.sh` รองรับเฉพาะ `[skip CI]` (ผ่าน `--skip-ci`) — tags อื่น ๆ ต้อง commit เองแล้ว push ตรง

| Tag             | CI1 Lint | CI2 Test | Deploy | ใช้เมื่อ                       |
| --------------- | -------- | -------- | ------ | ------------------------------ |
| `[skip CI]`     | ⏭️       | ⏭️       | ⏭️     | ไม่ต้องการรันอะไรเลย           |
| `[skip lint]`   | ⏭️       | ✅       | ✅     | รีบ deploy, ไม่ต้อง lint       |
| `[skip test]`   | ✅       | ⏭️       | ✅     | test ไม่เกี่ยวข้อง             |
| `[deploy-only]` | ⏭️       | ⏭️       | ✅     | emergency hotfix (P0 เท่านั้น) |

```bash
# กรณี [skip CI] — ใช้ 2git.sh --skip-ci
bash 2git.sh --skip-ci "docs: update specs"

# กรณี tags อื่น ๆ — commit เองแล้ว push ตรง (ไม่ผ่าน 2git.sh)
git add .
git commit -m "fix(critical): hotfix auth bypass [deploy-only]"
git push origin main
```

### Method 3: Manual Dispatch (Gitea UI)

Gitea web UI → **Actions** tab → **CI / CD Pipeline** → **Run workflow** → เลือก mode:

| Mode          | CI1 | CI2 | Deploy | ใช้เมื่อ            |
| ------------- | --- | --- | ------ | ------------------- |
| `full`        | ✅  | ✅  | ✅     | รันครบปกติ          |
| `ci-only`     | ✅  | ✅  | ⏭️     | ทดสอบ CI อย่างเดียว |
| `deploy-only` | ⏭️  | ⏭️  | ✅     | deploy ตรง          |
| `skip-lint`   | ⏭️  | ✅  | ✅     | ข้าม lint           |
| `skip-test`   | ✅  | ⏭️  | ✅     | ข้าม test           |

## 📊 Pipeline Stages

```
┌─────────────┐     ┌──────────┐
│  ci-quality │     │  ci-test │     (parallel — ไม่รอกัน)
│  (CI1)      │     │  (CI2)   │
│  - Lint     │     │  - Test  │
│  - Security │     │  backend │
│  - Patch    │     │  - Test  │
│    check    │     │  frontend│
└──────┬──────┘     └────┬─────┘
       │                 │
       │        ┌────────┘
       ▼        ▼
   ┌────────────────┐
   │     deploy     │  (main only — needs ci-test success/skipped)
   │                 │
   │  SSH → git pull │
   │  → deploy.sh    │
   └────────────────┘
```

- **CI1 (`ci-quality`)**: Lint + Security grep (UUID/console.log) + Patch integrity
- **CI2 (`ci-test`)**: Backend test + Frontend test — **deploy รอ job นี้เท่านั้น**
- **`deploy`**: SSH to 192.168.10.11 → `git fetch` → `git reset --hard origin/main` → `./scripts/deploy.sh`

> ถ้า CI1 fail แต่ CI2 ผ่าน → deploy ได้ (lint ไม่บล็อก production)
> ถ้า CI2 fail → **ห้าม deploy** (test เป็น gate หลัก)

## 🔧 deploy.sh Flow (v4.0)

```
[0/5] Ownership guard     — ตรวจสอบ runtime compose files เป็นของ np-dms
[1/5] Sync compose files  — copy Layer 3 compose ไป /opt/np-dms/03-application/
[2/5] Build images        — tag ด้วย git SHA (12 chars) + :latest → push ไป ASUSTOR registry
[3/5] Restart Layer 3     — docker compose up -d --force-recreate
[4/5] Health check        — ถ้า fail → auto-rollback (ADR-015)
[5/5] Post-deploy         — บันทึก deploy history + prune old images (เก็บ 3 versions)
```

Image tags: `lcbp3-backend:<SHA>`, `lcbp3-backend:latest`, `192.168.10.9:5000/lcbp3-backend:<SHA>`

## ✅ Post-Deploy Verification

1. **Backend health** (public endpoint — no JWT)

```bash
curl http://192.168.10.11:3000/ping
# Expected: { "status": "ok" } หรือ HTTP 200
```

2. **Backend health** (auth required — แสดง infra details)

```bash
curl -H "Authorization: Bearer <JWT>" http://192.168.10.11:3000/health
# Expected: { "status": "ok", "info": { "database": {...}, "redis": {...} } }
```

3. **Frontend**

```bash
curl -I http://192.168.10.11:3001
# Expected: HTTP 200
```

4. **Check logs**

```bash
# Docker logs (direct)
docker logs lcbp3-backend --tail=50 -f
docker logs lcbp3-frontend --tail=50 -f

# หรือใช้ lnav สำหรับ parse Docker/NestJS logs (ติดตั้งแล้วบน np-dms-lcbp3)
lnav /opt/np-dms/logs/
```

5. **Verify database** — confirm schema changes reflected (ถ้ามี delta SQL)

6. **Check deploy history**

```bash
cat /opt/np-dms/.deploy-history
# Format: SHA|timestamp|commit_full
# บรรทัดล่าสุด = current deploy
```

## 🔄 Rollback

### Auto-rollback (deploy.sh)

`deploy.sh` รองาน health check 30 ครั้ง (60 วินาที) ถ้า fail → อ่าน previous SHA จาก `/opt/np-dms/.deploy-history` → tag pre-built image เดิมเป็น `:latest` → restart → ยังคง exit 1 เพื่อแจ้ง CI ว่า deploy fail

### Manual rollback

```bash
# SSH เข้า server
ssh -p <PORT> <USER>@192.168.10.11

cd /opt/np-dms-lcbp3

# Rollback ไป version ก่อนหน้า (อ่านจาก deploy history อัตโนมัติ)
./scripts/rollback.sh

# หรือระบุ SHA เฉพาะ
./scripts/rollback.sh <SHA>
```

`rollback.sh` flow:

1. หา target SHA (จาก parameter หรือ deploy history)
2. ใช้ pre-built image (local → pull จาก registry → fallback rebuild)
3. Tag เป็น `:latest` → restart Layer 3
4. Health check → ยืนยัน rollback สำเร็จ

## ⚠️ Common Issues

| Symptom            | Cause                        | Fix                                                                                                                  |
| ------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Backend unhealthy  | DB connection failed         | Check MariaDB container + `/opt/np-dms/.env`                                                                         |
| Frontend blank     | Build error                  | Check Next.js build logs: `docker logs lcbp3-frontend`                                                               |
| 502 Bad Gateway    | Container not started        | `docker compose -f /opt/np-dms/03-application/docker-compose.yml ps`                                                 |
| Pipeline stuck     | Gitea runner offline         | `cd /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/05-ci && docker compose restart` |
| Permission denied  | Runtime files owned by root  | `sudo chown np-dms:np-dms /opt/np-dms/*/docker-compose.yml`                                                          |
| Image push fail    | ASUSTOR registry down        | Check `curl http://192.168.10.9:5000/v2/_catalog`                                                                    |
| Auto-rollback fail | No previous image in history | Manual: `./scripts/rollback.sh <SHA>`                                                                                |

## 🚨 Emergency Hotfix (P0)

> ⚠️ ใช้เฉพาะกรณี P0 — ระบบล่ม, Data Corruption, Security Breach
> ต้องได้รับ Lead Dev Approval ก่อน (ตาม `04-08-release-management-policy.md`)

```bash
cd /opt/np-dms-lcbp3

# 1. สร้าง hotfix branch จาก main
git checkout main
git pull origin main
git checkout -b hotfix/v1.9.X-description

# 2. Fix + commit พร้อม tag [deploy-only] เพื่อข้าม CI
#    ⚠️ [deploy-only] ไม่รองรับโดย 2git.sh — ต้อง commit เองแล้ว push ตรง
git add .
git commit -m "fix(P0): <description> [deploy-only]"

# 3. Merge hotfix เข้า main แล้ว push ด้วย 2git.sh
git checkout main
git merge --no-ff hotfix/v1.9.X-description
bash 2git.sh "fix(P0): <description> [deploy-only]"

# 4. Monitor pipeline — deploy จะรันโดยไม่รอ CI
# 5. ทดสอบบน production ทันที
# 6. Merge back ไป develop ด้วย
```

## 📝 Change Log

- **v2.0.0** (2026-09-11): อัปเดตสำหรับ CI/CD v2 — แยก CI1+CI2, commit message tags, manual dispatch modes, ADR-041 server consolidation, ASUSTOR registry, SEV-013 `/ping` endpoint, deploy history, auto-rollback, ใช้ `2git.sh` สำหรับ push
- **v1.9.0**: Initial version — QNAP Container Station target, single build job
