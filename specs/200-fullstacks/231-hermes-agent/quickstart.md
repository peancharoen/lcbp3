// File: specs/200-fullstacks/231-hermes-agent/quickstart.md
// Change Log:
// - 2026-05-29: Initial quickstart / verification guide for Hermes Agent staged rollout

# Quickstart: Hermes Agent Staged Rollout

**Feature**: 231-hermes-agent | **Date**: 2026-05-29

---

## Prerequisites

- [ ] ASUSTOR NAS with Docker support (ADM + Docker add-on)
- [ ] ASUSTOR IP confirmed (default: `192.168.10.X` — run `df -h` to confirm share paths)
- [ ] Gitea `hermes-bot` service account created with read-only token (write token created separately for Stage 4)
- [ ] Telegram bot created via @BotFather → bot token available
- [ ] Cloud AI API keys (Claude/Anthropic + OpenAI) stored in ASUSTOR secret store
- [ ] inter-VLAN routing confirmed: ASUSTOR → QNAP (MariaDB :3306, Gitea :3000) — required for Stage 2+

---

## Stage 0 — Documentation Only (Architecture Team approval required)

**Goal**: ADR boundary reviewed, locked decisions captured, no deploy files applied

Verification gate:
- [ ] ADR-031 v2.0 reviewed and all Locked Decisions confirmed
- [ ] No SQL delta files created
- [ ] No docker-compose files applied to ASUSTOR

✅ **Gate passed** → advance to Stage 1

---

## Stage 1 — Hermes Container LAN-only (DevOps/Admin approval)

```bash
# บน ASUSTOR shell (SSH ก่อน)
ssh admin@<ASUSTOR_IP>

# ขึ้น stack (hermes-redis + hermes-agent)
cd /volume1/docker/hermes
docker compose -f docker-compose.hermes.yml up -d

# Verify resource limits enforce จริง
docker inspect hermes_agent_lcbp3 | grep -E '"Memory"|"NanoCpus"'
docker stats hermes_agent_lcbp3 --no-stream
```

Verification gate:
- [ ] Container running: `docker ps | grep hermes_agent_lcbp3`
- [ ] LAN/VPN-only: Hermes `:8080`, `:8766`, `/mcp` ไม่ accessible จาก public internet
- [ ] Redis แยกจาก DMS: `docker network inspect lcbp3 | grep hermes-redis` (ต้องอยู่ใน network แยก หรือ isolate ด้วย ACL)
- [ ] CPU ≤ 2.0 cores, RAM ≤ 4096MB enforce จาก `docker inspect`

✅ **Gate passed** → advance to Stage 2

---

## Stage 2 — Read-only Diagnostics (DBA/Security + DevOps approval)

```bash
# ทดสอบ MariaDB read-only connection (ไม่ควร write ได้)
docker exec hermes_agent_lcbp3 node -e "
  const mysql = require('mysql2');
  const conn = mysql.createConnection({
    host: process.env.HERMES_MARIADB_READONLY_HOST,
    user: process.env.HERMES_MARIADB_READONLY_USER,
    password: process.env.HERMES_MARIADB_READONLY_PASSWORD,
    database: process.env.HERMES_MARIADB_READONLY_DATABASE
  });
  conn.query('SHOW TABLES', (err, rows) => { console.log(rows); conn.end(); });
"

# ทดสอบ write ต้องล้มเหลว
# (INSERT statement should return error with read-only user)
```

Verification gate:
- [ ] Read-only DB grant verified: SELECT pass, INSERT/UPDATE/DELETE fail
- [ ] Masked/redacted fields verified: no document content, user passwords, storage paths in query results
- [ ] Gitea read-only token verified: GET repos/issues/PRs pass, POST/PATCH/DELETE fail
- [ ] No direct storage mount: `docker inspect hermes_agent_lcbp3 | grep Mounts` — no permanent storage paths

✅ **Gate passed** → advance to Stage 3

---

## Stage 3 — Telegram Read-only DevOps (DevOps/Security approval)

```bash
# ทดสอบ webhook secret verification
curl -X POST http://localhost:8080/api/v1/telegram/webhook \
  -H "X-Telegram-Bot-Api-Secret-Token: WRONG_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"message":{"from":{"id":123},"text":"/status","chat":{"id":123}}}' \
  # ต้องได้ 401 Unauthorized

# ทดสอบ allowlist rejection
curl -X POST http://localhost:8080/api/v1/telegram/webhook \
  -H "X-Telegram-Bot-Api-Secret-Token: ${HERMES_TELEGRAM_WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"message":{"from":{"id":999999999},"text":"/status","chat":{"id":999999999}}}' \
  # ต้องได้ rejected (user ไม่อยู่ใน allowlist)

# ทดสอบ /ci_status จาก authorized user
# (ส่งผ่าน Telegram จริง หรือ simulate ด้วย authorized user ID)
```

Verification gate:
- [ ] Telegram allowlist verified: non-allowlisted user rejected 100%
- [ ] Webhook secret verified: wrong secret → 401
- [ ] Rate limit verified: >10 requests/minute from same user → rejected
- [ ] `hermes_operations_log` captures inbound/outbound transactions with transactionId
- [ ] `/ci_status`, `/repo_summary`, `/status`, `/audit_summary` return correct data

✅ **Gate passed** → advance to Stage 4

---

## Stage 4 — Write-with-Confirmation DevOps (Architecture + Security + Repo Owner approval)

```bash
# ทดสอบ forbidden action blocker
# ส่งคำสั่ง "push to main" ผ่าน Telegram
# ต้องได้ rejection message โดยไม่มีการดำเนินการใดๆ

# ทดสอบ confirmation flow
# ส่ง "เตรียม branch proposal สำหรับ fix/test-issue"
# → Hermes แสดง summary + ขอ confirmation
# → ยืนยัน
# → ตรวจสอบ Gitea: branch hermes/fix-test-issue ถูกสร้าง
# → ตรวจสอบ hermes_operations_log: มี entry พร้อม transactionId

# ทดสอบ hermes-bot token scope
git -c http.extraHeader="Authorization: token ${HERMES_BOT_WRITE_TOKEN}" \
  push gitea-origin main
# ต้องได้ 403 Forbidden (branch protection + token scope block)
```

Verification gate:
- [ ] Explicit confirmation flow verified: write action requires confirmation before executing
- [ ] Forbidden action blocklist verified: push main/develop, production deploy, schema migration, direct DB write → rejected
- [ ] Branch protection + Gitea token scope verified: hermes-bot cannot push to main/develop
- [ ] `hermes_operations_log` records token identity, target repo/branch for all write actions

✅ **Gate passed** → advance to Stage 5

---

## Stage 5 — Developer AI Proxy (Architecture + Security approval)

```powershell
# บน Windows PowerShell — ทดสอบ hermes proxy
$env:OPENAI_BASE_URL = "http://<ASUSTOR_IP>:8766/v1"
$env:OPENAI_API_KEY = "<HERMES_PROXY_API_KEY>"

# ทดสอบ basic coding request (no production data)
codex "scaffold NestJS module for health check"
# ต้องได้ response พร้อม DMS context

# ทดสอบ secret payload rejection
# ส่ง payload ที่มี "password: secret123" หรือ storage path
# ต้องได้ rejected + redact ใน log
```

Verification gate:
- [ ] Proxy LAN/VPN-only: port 8766 ไม่ accessible จาก public internet
- [ ] No secrets/document payload: test payload ที่มี token/password/storage path ถูก reject และ redact ใน log
- [ ] Proxy ไม่ wired เข้า DMS AI runtime หรือ DMS document intelligence path
- [ ] Wrong API key → 401

✅ **All stages complete** → Hermes fully operational

---

## Rollback Procedures

| Stage | Rollback |
|-------|---------|
| Stage 1 | `docker compose -f docker-compose.hermes.yml down`; verify DMS production unaffected |
| Stage 2 | Revoke DB/Gitea read-only credentials via Gitea admin; disable MCP servers; confirm no storage mount |
| Stage 3 | `curl -X DELETE "https://api.telegram.org/bot{TOKEN}/deleteWebhook"`; revoke bot token if needed |
| Stage 4 | Revoke Gitea write token via Gitea admin; disable write commands in Hermes config |
| Stage 5 | Unset `OPENAI_BASE_URL` on all clients; stop hermes proxy; revoke proxy API key |

---

## Health Check Endpoints

```bash
# Hermes health (Stage 1+)
curl http://<ASUSTOR_IP>:8080/api/v1/health

# hermes proxy health (Stage 5)
curl http://<ASUSTOR_IP>:8766/v1/models

# Dev Qdrant health (if deployed)
curl http://<ASUSTOR_IP>:6334/healthz
```
