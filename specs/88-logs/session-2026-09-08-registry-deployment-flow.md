# Session 2026-09-08 (ASUSTOR Registry-Backed Deployment Flow)

## Summary

ทำ Registry-backed deployment flow สำเร็จ — New Server build images → push ไป ASUSTOR Private Registry (`192.168.10.9:5000`) → Compose ใช้ registry-prefixed images → auto-rollback pull จาก registry ถ้า local image ขาด พร้อม cleanup scripts สำหรับ ASUSTOR (registry GC + runner cleanup) และเปลี่ยน runner labels เป็น `lcbp3-ci`

## ปัญหาที่พบ (Root Cause)

### 1. NestJS Circular Module Dependency (2 layers)

backend container unhealthy หลัง deploy ครั้งแรก:

- Layer 1: `AiModule → MigrationModule → AiModule`
- Layer 2: `CommonModule → AiModule → AiToolModule → CommonModule`

Root cause: module imports แบบ bidirectional โดยไม่มี `forwardRef()`

### 2. Docker Registry HTTPS/HTTP Mismatch

`docker login 192.168.10.9:5000` fail เพราะ Docker พยายามใช้ HTTPS กับ HTTP registry:
```
http: server gave HTTP response to HTTPS client
```

Root cause: registry ใช้ HTTP แต่ Docker daemon ไม่ได้ configure `insecure-registries`

### 3. Rollback Naming Mismatch

หลังเปลี่ยน Compose เป็น registry-prefixed images, rollback ยัง tag แค่ `lcbp3-backend:latest` ซึ่งไม่ตรงกับที่ Compose คาดหวัง (`192.168.10.9:5000/lcbp3-backend:<tag>`)

### 4. Secrets รั่วใน .env.template

`.env.template` (git-tracked) มี actual secrets 15+ ตัว: DB password, JWT secret, AUTH secret, n8n encryption key, registry password ฯลฯ

### 5. ASUSTOR busybox ไม่รองรับ bashism

scripts ใช้ `#!/bin/bash` และ bash arrays (`TAG_ARRAY+=()`, `"${TAG_ARRAY[@]}"`) — ASUSTOR มีแค่ `/bin/sh`

### 6. ASUSTOR Docker permission denied

user `nattanin` ไม่มีสิทธิ์ Docker socket — ต้องใช้ `sudo`

### 7. Runner label ไม่อัปเดตใน Gitea DB

recreate runner container ไม่อัปเดต `agent_labels` ใน Gitea DB — label เก็บตอน register ครั้งแรก

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `backend/src/modules/ai/ai.module.ts` | `forwardRef(() => MigrationModule)` |
| `backend/src/modules/migration/migration.module.ts` | `forwardRef(() => AiModule)` |
| `backend/src/common/common.module.ts` | `forwardRef(() => AiModule)` |
| `backend/src/modules/ai/tool/ai-tool.module.ts` | `forwardRef(() => CommonModule)` |
| `/etc/docker/daemon.json` (New Server) | เพิ่ม `insecure-registries: ["192.168.10.9:5000"]` |
| `scripts/deploy.sh` | เพิ่ม `REGISTRY` var, tag+push ไป registry, rollback pull จาก registry, prune registry images |
| `scripts/rollback.sh` | เพิ่ม `REGISTRY` var, pull จาก registry ก่อน fallback rebuild |
| `specs/.../03-application/docker-compose.yml` | `image: ${REGISTRY:-192.168.10.9:5000}/lcbp3-backend:${BACKEND_IMAGE_TAG:-latest}` |
| `specs/.../.env.template` | แทน secrets จริงด้วย `CHANGE_ME_*` placeholders |
| `scripts/registry-gc.sh` | สร้างใหม่ — `#!/bin/sh`, `sudo docker`, registry GC + tag retention |
| `scripts/runner-cleanup.sh` | สร้างใหม่ — `#!/bin/sh`, `sudo docker`, prune stopped containers + dangling images + build cache |
| `.gitea/workflows/ci-deploy.yml` | `runs-on: lcbp3-ci` (build + deploy) |
| `.gitea/workflows/spec-validation.yml` | `runs-on: lcbp3-ci` |
| `specs/.../ASUSTOR/gitea-runner/docker-compose.yml` | `GITEA_RUNNER_LABELS=lcbp3-ci:docker://ubuntu:22.04` |
| `specs/.../04-04-deployment-guide.md` | เพิ่ม Appendix C.6 Registry Integration + step-by-step ASUSTOR cleanup install guide |
| Gitea DB (`action_runner` table) | `UPDATE agent_labels='["lcbp3-ci"]' WHERE id=1` |

## กฎที่ Lock แล้ว

- **D279**: Registry-backed deployment — images push ไป ASUSTOR Private Registry (`192.168.10.9:5000`), Compose ใช้ registry-prefixed names, rollback pull จาก registry ก่อน fallback rebuild
- **D280**: Runner labels dedicated — `lcbp3-ci` สำหรับ LCBP3 repo เท่านั้น (ไม่ใช้ `self-hosted` แบบกว้าง)
- **D281**: ASUSTOR scripts ต้องใช้ `#!/bin/sh` + `sudo docker` (busybox + permission constraints)
- **D282**: `.env.template` ต้องมีแค่ `CHANGE_ME_*` placeholders — ห้ามมี actual secrets (Tier-1 Security)

## Verification

- [x] backend container healthy — `192.168.10.9:5000/lcbp3-backend:b7a32215311a`
- [x] frontend container healthy — `192.168.10.9:5000/lcbp3-frontend:b7a32215311a`
- [x] Backend `/ping` 200 OK (internal + external)
- [x] ASUSTOR Registry มี `lcbp3-backend` และ `lcbp3-frontend` ใน catalog
- [x] `bash -n deploy.sh` + `bash -n rollback.sh` ผ่าน
- [x] `sh -n registry-gc.sh` + `sh -n runner-cleanup.sh` ผ่าน
- [x] Runner `agent_labels` = `["lcbp3-ci"]` ใน Gitea DB
- [x] Cron ตั้งแล้วบน ASUSTOR (runner-cleanup daily 03:00, registry-gc weekly Sunday 04:00)
- [x] `.env.template` ไม่มี secrets จริงเหลือ (grep `Center#2026\|Np721220` = no match)
- [ ] TLS registry (follow-up — ตอนนี้ใช้ HTTP + insecure-registries)
- [ ] Registry remote garbage collection policy (ตอนนี้มี script แต่ยังไม่ได้ทดสอบรันจริงบน ASUSTOR)

## Commits

| Commit | รายการ |
|---|---|
| `849cebcb` | fix(backend): resolve AiModule <-> MigrationModule circular dependency with forwardRef |
| `d50643b5` | fix(backend): resolve CommonModule <-> AiModule <-> AiToolModule circular dependency |
| `9f61683c` | feat(deploy): push images to ASUSTOR private registry + registry-prefixed compose |
| `1cf1a694` | fix(security): sanitize leaked secrets in .env.template + add registry/runner cleanup scripts + document TLS follow-up |
| `b7a32215` | feat(ci): use dedicated lcbp3-ci runner label + add ASUSTOR cleanup install guide |
| `cd42e862` | fix(scripts): use sh shebang for ASUSTOR busybox compatibility |
| `eed240a7` | fix(scripts): add sudo for docker commands + remove emoji for ASUSTOR busybox |
