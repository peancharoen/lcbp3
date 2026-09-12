# Session 2026-09-12 — Gitea Runner Migration (ASUSTOR → New Server)

## Summary

ย้าย Gitea Actions Runner จาก ASUSTOR (Celeron N5105, 4 threads) ไป New Server `np-dms-lcbp3` (Ryzen 5 5600, 12 threads) ลดเวลา CI จาก ~24 min → ~3.5 min (**~7x เร็วขึ้น**) พร้อมแก้ lint errors ที่ค้างอยู่ใน `rag-admin-*.e2e-spec.ts` (18 errors → 0)

## ปัญหาที่พบ (Root Cause)

1. **ASUSTOR CPU bottleneck** — Celeron N5105 (4 threads, 2.0GHz) รัน parallel CI jobs (`ci-quality` + `ci-test`) ช้ามาก:
   - `ci-test`: 23.8 min (pnpm setup 597s + install 431s + tests 360s)
   - `ci-quality`: 17.0 min (install 553s + lint 404s)
   - รวม ~24 min ต่อ run

2. **QNAP ไม่ใช่ทางเลือก** — ADR-045 ประกาศ QNAP Container Station ปิดแล้ว (NAS/backup only) การย้ายไป QNAP ต้องเปิด Docker ใหม่ ขัด ADR และมีความเสี่ยงเดิมซ้ำ

3. **Job image `ubuntu:22.04` ไม่มี Node.js** — `actions/checkout@v4` เป็น Node action ต้องมี `node` ใน PATH ตั้งแต่ step แรก; `ubuntu:22.04` ไม่มี Node → `exec: "node": executable file not found in $PATH`

4. **Lint errors ค้างอยู่** — `rag-admin-security.e2e-spec.ts` (14 errors) + `rag-admin-cross-project.e2e-spec.ts` (2 prettier) + `rag-admin-orphan-cleanup.e2e-spec.ts` (2 prettier) — ทำให้ `ci-quality` fail (ไม่เกี่ยวกับ runner migration)

## การแก้ไข (Fix)

### Runner Migration

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `specs/.../np-dms-lcbp3/05-ci/docker-compose.yml` | สร้างใหม่ — act_runner:0.4.0, node:20 job image, capacity: 2, volumes ไป `/var/lib/docker/runner/` |
| `specs/.../np-dms-lcbp3/05-ci/config.yaml` | สร้างใหม่ — act_runner config (capacity: 2, bridge network) |
| `specs/.../np-dms-lcbp3/05-ci/.env.example` | สร้างใหม่ — template สำหรับ Gitea URL + registration token |
| `specs/.../np-dms-lcbp3/MIGRATION-PLAN.md` | เพิ่ม §13 — runner migration addendum (decisions, architecture, performance, steps) |
| `specs/.../04-04-deployment-guide.md` | อัปเดต Appendix C — เปลี่ยนจาก ASUSTOR → New Server |
| `.devin/skills/deploy/SKILL.md` | อัปเดต runner restart command |
| `.claude/skills/deploy/SKILL.md` | sync กับ `.devin` |

### Lint Fixes

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `backend/test/rag-admin-cross-project.e2e-spec.ts` | prettier auto-fix (2 errors) |
| `backend/test/rag-admin-orphan-cleanup.e2e-spec.ts` | prettier auto-fix (2 errors) |
| `backend/test/rag-admin-security.e2e-spec.ts` | manual fix 14 errors: ลบ unused `ForbiddenException` + `app`, import `ExecutionContext` จาก `@nestjs/common`, type `getRequest<{user}>()` generic, type `res.body` ทั้ง 4 จุด |

## กฎที่ Lock แล้ว

| ID | Decision |
|----|----------|
| D326 | **Gitea Runner ย้ายไป New Server (192.168.10.11)** — ASUSTOR Celeron N5105 (4 threads) เป็น bottleneck; New Server Ryzen 5 5600 (12 threads) ให้ ~7x speedup; ASUSTOR ยัง host registry + monitoring + NAS; QNAP ไม่รับ workload (ADR-045) |
| D327 | **CI job image = `node:20` (ไม่ใช่ `ubuntu:22.04`)** — `actions/checkout@v4` เป็น Node action ต้องมี `node` ใน PATH ตั้งแต่ step แรก; `ubuntu:22.04` ไม่มี Node → fail ที่ Checkout |
| D328 | **Runner data path = `/var/lib/docker/runner/`** — docker-lv (100G, 93G free); ไม่ใช้ `/opt/np-dms` (86% full); pnpm store per-job subdirs อยู่บน volume เดียวกัน |
| D329 | **Runner Gitea URL = `http://192.168.10.11:3003`** — job containers ใช้ bridge network ไม่สามารถ resolve Docker internal DNS `gitea` ได้ ต้องใช้ host IP |

## Verification

- [x] Runner registered บน Gitea (id=3, label: `lcbp3-ci:docker://node:20`, status: online)
- [x] `asustor-runner` (id=1) deregistered จาก Gitea
- [x] CI run #728 ทดสอบจริง — `ci-test` ผ่าน (3.3 min), `ci-quality` fail ที่ lint (pre-existing)
- [x] `pnpm --filter backend lint:ci` — 0 errors (หลังแก้ lint)
- [x] `pnpm test` — 2949 passed, 17 skipped, 0 failed
- [x] Commit `6c7ebfa5` — 10 files changed, 299 insertions(+), 57 deletions(-)
- [ ] **Pending manual:** SSH ไป ASUSTOR เพื่อ `docker compose down` runner container เก่า
- [ ] **Pending:** Push ผ่าน `2git.sh`

## Performance Comparison

| Job | ASUSTOR (เดิม) | New Server (ใหม่) | ปรับปรุง |
|-----|----------------|-------------------|---------|
| `ci-test` | 23.8 min (1428s) | 3.3 min (200s) | **7.1x** |
| `ci-quality` | 17.0 min (1020s) | 3.5 min (213s) | **4.8x** |
| `deploy` | 2.6 min (156s) | 2.6 min (ไม่เปลี่ยน) | — |
| **รวม CI+Deploy** | ~28 min | ~6 min | **~4.7x** |
