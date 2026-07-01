# Session — 2026-07-01 (CI/CD ADR-041 Migration)

## Summary

อัปเดต CI/CD pipeline (`ci-deploy.yml`, `deploy.sh`, `rollback.sh`) สำหรับ ADR-041 Server Consolidation — ย้าย deploy target จาก QNAP (192.168.10.8) ไป New Server (192.168.10.11) พร้อมแก้ปัญหา deployment หลายขั้นตอน

## ปัญหาที่พบ (Root Cause)

1. **Gitea secrets ยังชี้ QNAP** — HOST/PORT/USERNAME/SSH_KEY ต้องอัปเดตเป็น New Server
2. **Source repo path ผิด** — MIGRATION-PLAN ระบุ `/opt/np-dms/np-dms-lcbp3` แต่จริงคือ `/opt/np-dms-lcbp3` (sibling ของ `/opt/np-dms/`)
3. **Git dubious ownership** — repo เป็นของ `nattanin` แต่ CI SSH เข้าเป็น `np-dms` → ต้อง `git config --global --add safe.directory`
4. **Gitea SSH host key missing** — `np-dms` user ไม่มี `known_hosts` สำหรับ Gitea SSH (port 2222)
5. **Compose file ownership** — `/opt/np-dms/03-application/docker-compose.yml` เป็น root แต่ `np-dms` ต้องเขียน → `chown np-dms:np-dms`
6. **Docker permission denied** — `np-dms` ไม่ได้อยู่ใน docker group → `usermod -aG docker np-dms`
7. **Gitea runner extra_hosts ผิด** — เปลี่ยน `git.np-dms.work` จาก QNAP → New Server ทำให้ runner ไม่เชื่อม Gitea ได้ (443 connection refused) เพราะ NPM อยู่ QNAP จัดการ HTTPS → revert กลับ QNAP
8. **ESLint segfault (exit 139)** — Node 24 ใน ubuntu:22.04 runner container ทำให้ ESLint 9.18 segfault → ลด Node เป็น 22.22.1 (LTS) + อัปเดต `engines` ใน package.json ทั้ง 3 ไฟล์
9. **Gitea/MariaDB down** — Gitea container ตาย และ MariaDB ไม่ได้อยู่ใน Docker network → restart ผ่าน docker compose Layer 1 + Layer 2
10. **ClamAV permission denied** — volume `/opt/np-dms/logs/clamav/` และ `/opt/np-dms/clamav/data/` เป็นของ `np-dms` (uid=1001) แต่ ClamAV container รัน freshclam เป็น user `clamav` (uid=100, gid=101) → `chown -R 100:101`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `.gitea/workflows/ci-deploy.yml` | Deploy target QNAP → New Server (192.168.10.11); PATH ลบ QNAP container-station; git repo path → `/opt/np-dms-lcbp3`; logs → `/opt/np-dms/logs` |
| `scripts/deploy.sh` | v2.0 → v3.0; 4-layer compose; sync Layer 3 compose file; SOURCE_DIR → `/opt/np-dms-lcbp3`; COMPOSE_RUNTIME_DIR → `/opt/np-dms/03-application`; ENV_FILE → `/opt/np-dms/.env` |
| `scripts/rollback.sh` | v1.8.1 → v3.0; ลบ blue-green/NGINX; checkout previous commit → rebuild → restart Layer 3; path ใหม่ตรง deploy.sh |
| `specs/.../ASUSTOR/gitea-runner/docker-compose.yml` | extra_hosts: `git.np-dms.work` เปลี่ยน 192.168.10.11 → revert กลับ 192.168.10.8 (NPM อยู่ QNAP) |

| `backend/package.json` | `engines.node`: `>=24.0.0` → `>=22.0.0` |
| `frontend/package.json` | `engines.node`: `>=24.0.0` → `>=22.0.0` |
| `package.json` (root) | `engines.node`: `>=24.0.0` → `>=22.0.0` |

### Server-side fixes (ไม่ใช่ไฟล์ใน repo)

- `sudo -u np-dms git config --global --add safe.directory /opt/np-dms-lcbp3`
- `sudo -u np-dms mkdir -p /home/np-dms/.ssh && ssh-keyscan -p 2222 192.168.10.11 → known_hosts`
- `sudo chown np-dms:np-dms /opt/np-dms/03-application/docker-compose.yml`
- `sudo usermod -aG docker np-dms`
- `sudo chown -R 100:101 /opt/np-dms/logs/clamav/ /opt/np-dms/clamav/data/`
- `sudo docker compose --env-file /opt/np-dms/.env -f /opt/np-dms/01-infrastructure/docker-compose.yml up -d` (restart Layer 1)
- `sudo docker compose --env-file /opt/np-dms/.env -f /opt/np-dms/02-platform/docker-compose.yml up -d` (restart Layer 2)
- Gitea Secrets: HOST=192.168.10.11, PORT=22, USERNAME=np-dms, SSH_KEY=nattanin's id_ed25519

## กฎที่ Lock แล้ว

- **Gitea Runner extra_hosts** ต้องชี้ `git.np-dms.work` → QNAP (192.168.10.8) เพราะ NPM อยู่ QNAP จัดการ HTTPS/443 (ADR-041 D2)
- **Source repo path** = `/opt/np-dms-lcbp3/` (sibling ของ `/opt/np-dms/` runtime dirs) — ไม่ใช่ `/opt/np-dms/np-dms-lcbp3/`
- **CI deploy flow**: ASUSTOR runner container → SSH → New Server (np-dms@192.168.10.11:22) → git pull → deploy.sh (build + restart Layer 3 only)
- **Deploy scope**: เฉพาะ Layer 3 (Application: backend, frontend, clamav) — Layer 1/2/4 ไม่ restart ตาม code deploy

## Verification

- [x] `git push origin main` สำเร็จ (commit `135618a6`)
- [x] Gitea runner container รันปกติหลัง revert extra_hosts (`declare successfully`)
- [x] Build job รันบน runner (`GITEA-ACTIONS-TASK-788`)
- [x] ESLint segfault แก้โดยลด Node 24 → 22 (LTS)
- [x] ClamAV permission แก้โดย chown 100:101
- [x] **Deploy job สำเร็จ** — CI/CD pipeline ทำงานครบทั้ง build + deploy
- [x] Layer 3 (backend, frontend, clamav) รันปกติบน New Server
