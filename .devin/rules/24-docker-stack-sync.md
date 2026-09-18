# Docker Stack Sync — Spec (Canonical) ↔ Runtime (/opt/np-dms)

## CRITICAL RULES

- **Canonical source = `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/`** — ห้ามรัน `docker compose` จาก directory นี้เด็ดขาด (spec only)
- **Runtime = `/opt/np-dms/`** — container ทั้งหมดรันจากที่นี่ที่เดียว (dockerup/dockerstart/dockerstop/dockerdown.sh)
- **แก้ไขได้ทั้งสองฝั่ง แต่ต้อง sync กันเสมอ** — verify ด้วย `diff` ก่อนจบงาน
- **ALWAYS** ใช้ `/opt/np-dms/copy-env.sh` เมื่อ sync ฝั่ง spec → runtime (มี backup + diff warning กันงานหาย — D259)
- **ALWAYS** commit hotfix ที่แก้ฝั่ง runtime กลับเข้า spec — ไม่งั้น `copy-env.sh` รอบถัดไปจะทับหาย (incident 2026-09-03 / D259)
- **NEVER** รัน `docker compose up/down` จาก spec dir — container จะถูกสร้างด้วย label path ผิด (split-brain project)

## Directory Mapping (spec → runtime)

| Spec (canonical) | Runtime | Sync mode |
|---|---|---|
| `00-basic/docker-compose.yml` | `/opt/np-dms/00-basic/` | copy file |
| `01-infrastructure/docker-compose.yml` | `/opt/np-dms/01-infrastructure/` | copy file |
| `01-infrastructure/exporter-my.cnf` | `/opt/np-dms/mariadb/` ⚠️ dest ต่าง dir | copy file |
| `02-platform/docker-compose.yml` | `/opt/np-dms/02-platform/` | copy file |
| `03-application/docker-compose.yml` | `/opt/np-dms/03-application/` | copy file |
| `04-ai/docker-compose.yml` | `/opt/np-dms/04-ai/` | copy file |
| `04-ai/ocr-sidecar/` (ทั้ง folder) | `/opt/np-dms/04-ai/ocr-sidecar/` | recursive |
| `05-ci/` (ทั้ง folder: compose + config.yaml + .env.example) | `/opt/np-dms/05-ci/` | recursive |
| `.env` (ที่ spec dir) | `/opt/np-dms/.env` | copy file |

- **`.env` source of truth = ฝั่ง spec** (`$SPEC_BASE/.env` = `ENV_SRC` ใน copy-env.sh) → copy ลง `/opt/np-dms/.env`; ทั้งคู่ gitignored
- Lifecycle scripts (`dockerup.sh` / `dockerstart.sh` / `dockerstop.sh` / `dockerdown.sh` / `copy-env.sh`) อยู่ที่ `/opt/np-dms/` เท่านั้น — **ไม่อยู่ใน git** (runtime-only files)

## Edit Workflow

```
แก้ spec  → รัน /opt/np-dms/copy-env.sh → verify: diff spec vs runtime → docker compose up -d (ที่ runtime)
แก้ runtime (hotfix) → commit กลับ spec ทันที (D259) → ไม่ต้องรัน copy-env.sh (ของตรงกันแล้ว)
```

Verify command:

```bash
SPEC=/opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3
for d in 00-basic 01-infrastructure 02-platform 03-application 04-ai 04-ai/ocr-sidecar 05-ci; do
  diff -r "$SPEC/$d" "/opt/np-dms/$d" -x '*.bak.*' -x '__pycache__' -x '*.pyc' -x '.env' -x '.pytest_cache' -x '* copy*'
done
```

## Known Quirks

- **Split labels (one-time):** container `cache`, `search`, `qdrant`, `cadvisor`, `node-exporter`, `redis-exporter`, `elasticsearch-exporter` ถูกสร้างจาก spec dir (2026-08-01) — compose จัดการด้วย project name (`lcbp3-*`) จึงยังควบคุมได้ปกติ แต่ `up -d` ครั้งถัดไปจะ recreate กลุ่มนี้ให้ label ตรง `/opt/np-dms` (data อยู่ใน named volume — ไม่หาย)
- **Runtime `.bak.*` / `* copy*` / `.pytest_cache` files** — artifacts ฝั่ง runtime เท่านั้น spec ไม่มี (และไม่ควรมี)
- **`docker-compose copy.yml`, `Dockerfile copy`** ที่ `/opt/np-dms/04-ai/ocr-sidecar/` — manual copies ไม่ใช่ canonical

## Related Documents

- `/opt/np-dms/copy-env.sh` — sync script (backup `.bak.<timestamp>`, keep 2 ล่าสุด, [DIFF] warning)
- `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/README.md` — stack layout + per-layer usage
- Memory: D259 (runtime hotfix ถูก copy-env.sh ทับหาย → ต้อง commit กลับ spec เสมอ)
