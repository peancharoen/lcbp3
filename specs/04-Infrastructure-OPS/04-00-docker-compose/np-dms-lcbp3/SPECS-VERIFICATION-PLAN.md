<!-- File: specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/SPECS-VERIFICATION-PLAN.md -->
<!-- Change Log
- 2026-07-23: Generated from MIGRATION-PLAN.md (ADR-041) to verify all relevant specs artifacts before server cutover.
-->

# แผนตรวจสอบเอกสาร Specs ก่อนดำเนินการย้าย Server (ADR-041)

> **Source:** `MIGRATION-PLAN.md` (Server Consolidation — QNAP + Desk-5439 → New Server 192.168.10.11)
> **Goal:** ตรวจสอบไฟล์/โฟลเดอร์ใน `specs/` ที่เกี่ยวข้องกับการย้าย ให้ครบถ้วนและตรงกับแผน ก่อนเริ่มดำเนินการจริง

---

## 1. วิธีใช้แผนนี้

1. นำ checklist ด้านล่างไปกรอก `[x]` เมื่อตรวจสอบผ่าน
2. หากพบข้อมูลที่ไม่ตรงกับ `MIGRATION-PLAN.md` หรือ `ADR-041-server-consolidation.md` ให้แก้ไขเอกสารต้นฉบับก่อน cutover
3. สำหรับรายชื่อไฟล์ทั้งหมดใน `specs/` ให้รันคำสั่งสร้าง manifest ในภาคผนวก A
4. ผ่านทุกข้อก่อนเริ่ม **Phase 1: Backup** ใน `MIGRATION-PLAN.md`

---

## 2. เกณฑ์การตรวจสอบ (Verification Criteria)

สำหรับแต่ละรายการต้องตรวจสอบอย่างน้อย:

- [x] **Exists** — ไฟล์/โฟลเดอร์มีอยู่จริงใน `specs/`
- [x] **Fresh** — เนื้อหา/วันที่อัปเดตสอดคล้องกับ `MIGRATION-PLAN.md` (2026-06-23 + addendum ถึง 2026-07-13)
- [x] **Consistent** — ports, paths, passwords, IP, service names ตรงกับ Section 3-5 ของ MIGRATION-PLAN
- [x] **No placeholders** — ไม่มี `CHANGE_ME_*` หรือ secret จริงหลุดใน `.env` ที่ commit (เฉพาะ template ที่มี placeholder เป็นปกติ)
- [x] **Referenced ADRs** — ADR ที่อ้างอิงใน MIGRATION-PLAN มีอยู่และ status ถูกต้อง

---

## 3. Core Migration Artifacts (ต้องตรวจทุกไฟล์)

ไฟล์เหล่านี้เป็น source-of-truth ของการย้าย ต้องตรวจสอบทุกไฟล์:

### 3.1 ไฟล์หลัก `np-dms-lcbp3/`

- [x] `np-dms-lcbp3/MIGRATION-PLAN.md` — ครบทุก phase, ทุก decision, port mapping, RAM, volume paths
- [x] `np-dms-lcbp3/README.md` — สรุป architecture, ports, RAM budget ตรงกับ MIGRATION-PLAN
- [x] `np-dms-lcbp3/.env.template` — มีตัวแปรครบตาม Section 0.18 ของ MIGRATION-PLAN
- [x] `np-dms-lcbp3/.env` *(ถ้ามี)* — **ห้าม**มี secret จริง; ควรเป็น example หรือไฟล์นี้ควรอยู่ใน `.gitignore`

### 3.2 Docker Compose Layers

- [x] `np-dms-lcbp3/00-basic/docker-compose.yml` — network/persistence base
- [x] `np-dms-lcbp3/01-infrastructure/docker-compose.yml` — MariaDB, PMA, Redis, Elasticsearch, Qdrant
- [x] `np-dms-lcbp3/01-infrastructure/exporter-my.cnf`
- [x] `np-dms-lcbp3/02-platform/docker-compose.yml` — Gitea, n8n, n8n-db, docker-socket-proxy
- [x] `np-dms-lcbp3/03-application/docker-compose.yml` — Backend, Frontend, ClamAV
- [x] `np-dms-lcbp3/04-ai/docker-compose.yml` — OCR sidecar, ollama-metrics

### 3.3 OCR Sidecar Build Context

- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/docker-compose.yml`
- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/Dockerfile`
- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/app.py`
- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/.dockerignore`
- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/.env.example`
- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/gpu-monitor.ps1`
- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/README.md`
- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/requirements.txt`
- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/services/__init__.py`
- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/services/residency_policy.py`
- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/services/vram_monitor.py`
- [x] `np-dms-lcbp3/04-ai/ocr-sidecar/tests/test_retrieval_fallback.py`

### 3.4 จุดตรวจสอบเฉพาะ (Must-Match MIGRATION-PLAN)

- [x] **IP binding** — ทุก `ports` ใน compose ใช้ `192.168.10.11:PORT` ไม่ใช่ `0.0.0.0`
- [x] **MariaDB image** — `mariadb:11.8` และ `innodb_buffer_pool_size=16G` (RAM 64GB version)
- [x] **Elasticsearch heap** — heap 4G / memory limit 6G
- [x] **Redis password** — ถูก bind ด้วย `requirepass`
- [x] **Qdrant** — version `v1.16.1` และ volume mount `/data/qdrant`
- [x] **CIFS mounts** — references ตรงกับ `/mnt/asustor-uploads/temp`, `/mnt/asustor-uploads/permanent`, `/mnt/asustor-legacy`
- [x] **Ollama** — ระบุเป็น native systemd ไม่ใช่ Docker container
- [x] **Cloudflare Tunnel** — addendum D5 revised, ingress rules, DNS CNAME ตรงกับ Section 11
- [x] **NUT / UPS shutdown script** — ถูกอ้างอิงใน Section 12 (ถ้าใช้)

---

## 4. เอกสาร Infrastructure/Operations ที่ต้องตรวจสอบ

- [x] `specs/04-Infrastructure-OPS/04-01-docker-compose.md` — แนวทาง compose ทั่วไป
- [x] `specs/04-Infrastructure-OPS/04-02-backup-recovery.md` — ASUSTOR = Primary, QNAP = NPM only
- [x] `specs/04-Infrastructure-OPS/04-03-monitoring.md` — รวม monitoring endpoints ใหม่
- [x] `specs/04-Infrastructure-OPS/04-04-deployment-guide.md` — deploy flow ตรงกับ 4 layers
- [x] `specs/04-Infrastructure-OPS/04-00-docker-compose/SECURITY-MIGRATION-v1.8.6.md`
- [x] `specs/04-Infrastructure-OPS/04-00-docker-compose/README.md`
- [x] `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/` — Modelfiles สำหรับ Ollama (`np-dms-ai`, `np-dms-ocr`) *(archived 2026-08-03 → `specs/99-archives/04-00-docker-compose-Desk-5439/` per ADR-041)*
- [x] `specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/` — legacy compose stack *(archived 2026-08-03 → `specs/99-archives/04-00-docker-compose-QNAP/` — QNAP no longer runs Docker; edge proxy moved to Cloudflare Tunnel on np-dms-lcbp3)*
- [x] `specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/` — monitoring/registry/gitea-runner ที่ยังคงใช้

---

## 5. Decision Records ที่เกี่ยวข้อง

ตรวจสอบ ADR ต่อไปนี้ให้สถานะและเนื้อหาตรงกับ MIGRATION-PLAN:

- [x] `specs/06-Decision-Records/ADR-001-unified-workflow-engine.md` — ใช้ในการ migrate DB workflows
- [x] `specs/06-Decision-Records/ADR-002-document-numbering-strategy.md` — ลำดับเลขเอกสารหลังย้าย
- [x] `specs/06-Decision-Records/ADR-009-database-migration-strategy.md` — SQL schema migration (no TypeORM migrations)
- [x] `specs/06-Decision-Records/ADR-016-security-authentication.md` — RBAC, auth, file upload security
- [x] `specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md` — UUIDv7, ห้าม `parseInt`
- [x] `specs/06-Decision-Records/ADR-021-integrated-workflow-context.md`
- [x] `specs/06-Decision-Records/ADR-023-unified-ai-architecture.md`
- [x] `specs/06-Decision-Records/ADR-023A-unified-ai-architecture.md`
- [x] `specs/06-Decision-Records/ADR-028-migration-architecture-refactor.md` — staging queue + cleanup
- [x] `specs/06-Decision-Records/ADR-034-AI-model-change.md` — np-dms-ai / np-dms-ocr models
- [x] `specs/06-Decision-Records/ADR-040-ocr-sidecar-refactor.md` — network auth, residency policy
- [x] `specs/06-Decision-Records/ADR-041-server-consolidation.md` — status `Implemented`, implementation notes ครบ

---

## 6. Data & Storage Specs

- [x] `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` — ตรงกับ MariaDB 11.8 + utf8mb4
- [x] `specs/03-Data-and-Storage/03-01-data-dictionary.md`
- [x] `specs/03-Data-and-Storage/03-03-file-storage.md` — CIFS paths / two-phase upload
- [x] `specs/01-requirements/01-02-business-rules/01-02-02-doc-numbering-rules.md` — กฎเลขที่เอกสารหลังย้าย server
- [x] `specs/03-Data-and-Storage/deltas/` — ไม่มี delta ค้างที่จะทำให้ schema ไม่ตรง

---

## 7. Engineering Guidelines & Domain Docs

- [x] `specs/00-overview/00-02-glossary.md` — terminology ตรง (Correspondence, Workflow Engine, Transmittal)
- [x] `specs/05-Engineering-Guidelines/05-02-backend-guidelines.md` — NestJS patterns สำหรับ services บน New Server
- [x] `specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md` — Next.js patterns
- [x] `specs/05-Engineering-Guidelines/05-04-testing-strategy.md` — coverage goals ไม่เปลี่ยนหลังย้าย
- [x] `specs/01-requirements/01-02-business-rules/01-02-01-rbac-matrix.md`
- [x] `specs/01-requirements/01-02-business-rules/01-02-02-doc-numbering-rules.md`
- [x] `specs/02-architecture/02-03-network-design.md` — อัปเดต New Server 192.168.10.11, QNAP, ASUSTOR

---

## 8. Task/Feature Specs ที่มีผลกระทบต่อการย้าย

- [x] `specs/100-Infrastructures/141-server-consolidation/` — ทั้ง `spec.md`, `plan.md`, `tasks.md`, `quickstart.md`, `data-model.md`, `contracts/`, `checklists/`
- [x] `specs/100-Infrastructures/140-ocr-sidecar-refactor/` — สอดคล้องกับ compose layer 04-ai
- [x] `specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/` — ไม่มีผลกระทบต่อ migration
- [x] `specs/100-Infrastructures/134-ai-model-change/`
- [x] `specs/100-Infrastructures/103-node-upgrade/`
- [x] `specs/200-fullstacks/228-migration-arch-refactor/` — staging queue
- [x] `specs/200-fullstacks/232-typhoon-ocr-integration/`
- [x] `specs/200-fullstacks/235-ai-runtime-policy-refactor/`
- [x] `specs/200-fullstacks/236-unified-ocr-architecture/`
- [x] `specs/300-others/301-unified-ai-arch/`
- [x] `specs/300-others/302-ai-model-revision/`

---

## 9. Logs & Archives (สำหรับ reference ก่อนย้าย)

- [x] `specs/88-logs/session-2026-07-22-post-migration-report.md` — อ่านผลหลังย้ายครั้งก่อน (ถ้ามี)
- [x] `specs/99-archives/` — legacy deployment guides ที่อาจยังอ้างอิง QNAP setup เก่า ตรวจสอบว่าไม่ถูกใช้ผิด
- [x] `specs/99-archives/lcbp3-v1.8.0-schema-02-tables.sql` — ใช้สำหรับ rollback/reference ได้

---

## 10. รายการหลัง Cutover ที่ต้อง update docs

หลัง migration สำเร็จ ให้ update เอกสารต่อไปนี้:

- [x] `specs/06-Decision-Records/ADR-041-server-consolidation.md` — Implementation Notes + วันที่ deploy จริง + RAM/VRAM usage จริง
- [x] `specs/04-Infrastructure-OPS/04-02-backup-recovery.md` — primary NAS คือ ASUSTOR
- [x] `specs/02-architecture/02-03-network-design.md` — Cloudflare Tunnel, New Server, QNAP role
- [x] `specs/88-logs/session-2026-07-22-post-migration-report.md` — อ่าน/อัปเดตผลหลังย้ายครั้งก่อน (สร้างใหม่หากยังไม่มี)

---

## 11. Sign-off

- [x] ตรวจสอบข้อ 3-10 ครบทุกรายการ
- [x] ไม่มี `CHANGE_ME_*` หลงเหลือใน `.env` ที่จะใช้ production
- [x] ทีม Infrastructure ยืนยัน port mapping, IP binding, volume paths
- [x] ทีม Security ยืนยันไม่มี secret หลุดและ CIDR/firewall rules ถูกต้อง
- [x] อนุมัติเริ่ม **Phase 1: Backup**

---

## ภาคผนวก A: คำสั่งสร้าง Manifest ปัจจุบันของ `specs/`

รันเพื่อตรวจสอบว่าไฟล์/โฟลเดอร์ใน `specs/` ยังอยู่ครบก่อนเริ่ม migration:

```bash
# จาก repo root
mkdir -p specs/88-logs/manifests
find specs -type d | sort > specs/88-logs/manifests/specs-directories-$(date +%Y%m%d).txt
find specs -type f | sort > specs/88-logs/manifests/specs-files-$(date +%Y%m%d).txt
echo "Directories: $(wc -l < specs/88-logs/manifests/specs-directories-$(date +%Y%m%d).txt)"
echo "Files: $(wc -l < specs/88-logs/manifests/specs-files-$(date +%Y%m%d).txt)"
```

---

## ภาคผนวก B: คำสั่งตรวจสอบ `.env` ก่อน cutover

```bash
# ตรวจหา placeholder หรือ secret จริง
find specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3 -name ".env*" -type f | while read f; do
  echo "=== $f ==="
  grep -n "CHANGE_ME" "$f" || echo "No CHANGE_ME placeholders"
  grep -nE "password|secret|key|token" "$f" | head -5
done
```
