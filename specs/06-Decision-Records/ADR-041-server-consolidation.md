<!-- File: specs/06-Decision-Records/ADR-041-server-consolidation.md -->
<!-- Change Log
- 2026-06-20: Created initial ADR-041 documenting server consolidation decision.
  - Co-locate all services on single Docker host (Ryzen 5 5600 / 32GB / RTX 5060 Ti 16GB).
  - QNAP remains NAS for uploads/permanent storage via CIFS.
  - Enables ADR-040 network-only auth for sidecar via Docker-internal isolation.
- 2026-06-23: Revised after grilling session (grill-with-docs workflow).
  - D1 revised: Added Gitea, n8n, NPM, Qdrant, ClamAV to service list.
  - D2 revised: NPM stays on QNAP as Edge Proxy (SPOF mitigation). QNAP 32GB RAM confirmed.
  - D3 revised: 4-layer compose structure (01-infrastructure → 02-platform → 03-application → 04-ai).
  - D5 revised: Actual RAM budget calculated (33.5G total — tight). MariaDB 8G, ES heap 2G.
  - D6 revised: NPM on QNAP as SPOF mitigation. No UFW — VLAN 10 isolated via Omada OC200.
  - Tika removed (legacy — rejected in ADR-028 research, Thai NLP support อ่อนแอ).
  - Compose files created at specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/.
  - Migration plan created at np-dms-lcbp3/MIGRATION-PLAN.md.
- 2026-07-30: Review pass — corrected T016 status.
  - T016 (Remove X-API-Key) was marked Done but code verification shows X-API-Key still present in sidecar (app.py:129-135) and backend (ocr.service.ts, sandbox-ocr-engine.service.ts). No git commit removed it. Reverted status to Pending.
- 2026-07-30: T016 implemented — X-API-Key auth removed from sidecar + backend (ADR-040 Phase 2 T016/T017/T018).
-->

# ADR-041: Single-Host Server Consolidation

> ⚠️ **D2/D6 Amended by [ADR-045](./ADR-045-edge-proxy-topology-amendment.md) (2026-08-03):** Edge proxy role revised — Cloudflare Tunnel บน `np-dms-lcbp3` เป็น sole edge proxy; QNAP ไม่รัน Docker อีกต่อไป (NAS/backup only) เอกสารนี้คงไว้เป็น audit trail ตาม ADR-REVIEW-PROCESS (ไม่ได้แก้เนื้อหา D2/D6 เดิม) ดู Addendum Section 11 สำหรับ D5 revised (Cloudflare Tunnel install) ที่เป็นจุดเริ่มต้นของการเปลี่ยนแปลงนี้

**Status:** ⚠️ Implemented (D2/D6 amended by ADR-045 — see note above)
**Date:** 2026-06-20 (Revised: 2026-06-23, Implemented: 2026-07-22)
**Related Documents:**
- [ADR-040: OCR Sidecar Refactor](./ADR-040-ocr-sidecar-refactor.md)
- [ADR-016: Security & Authentication](./ADR-016-security-authentication.md)
- [ADR-023A: Unified AI Architecture](./ADR-023A-unified-ai-architecture.md)
- [ADR-034: AI Model Change](./ADR-034-AI-model-change.md)
- [ADR-045: Edge Proxy Topology Amendment](./ADR-045-edge-proxy-topology-amendment.md) (amends D2/D6)
- [CONTEXT.md](../../00-overview/CONTEXT.md)

---

## 🎯 Context and Problem Statement

### Current Architecture

ปัจจุบัน LCBP3-DMS กระจาย services ไว้บนหลายเครื่อง:

| Service | Host | Hardware | Network |
|---------|------|----------|---------|
| Ollama (np-dms-ai, np-dms-ocr, nomic-embed) | Desk-5439 | RTX 4060 Ti 16GB | VLAN 10 (192.168.10.100) |
| OCR Sidecar (FastAPI) | Desk-5439 | Same as above | VLAN 10 (192.168.10.100) |
| Backend (NestJS) | QNAP NAS | - | VLAN 10 (192.168.10.8) |
| Frontend (Next.js) | QNAP NAS | - | VLAN 10 (192.168.10.8) |
| Redis | QNAP NAS | - | VLAN 10 (192.168.10.8) |
| MariaDB | QNAP NAS | - | VLAN 10 (192.168.10.8) |
| Elasticsearch | QNAP NAS | - | VLAN 10 (192.168.10.8) |
| File Storage | QNAP NAS | - | CIFS share `np-dms-as` |

### Problems Identified

1. **Cross-Host Trust Boundary:** Backend ↔ sidecar/Ollama ผ่าน LAN (VLAN 10) — ต้องพึ่ง VLAN/firewall ACL สำหรับ isolation (ADR-040 §4)
2. **Management Complexity:** Services กระจายบน 2 hosts → deployment, monitoring, troubleshooting ซับซ้อน
3. **GPU Resource Fragmentation:** Desk-5439 มี GPU แต่ CPU/RAM น้อย → ไม่สามารถรัน backend ได้
4. **Network Latency:** Backend ↔ Ollama ผ่าน LAN เพิ่ม latency สำหรับ AI inference
5. **Hardware Underutilization:** QNAP NAS มี CPU/RAM แต่ไม่มี GPU → ไม่สามารถรัน AI models ได้

### New Hardware

มีเซิร์ฟเวอร์ใหม่พร้อมใช้งาน:
- **CPU:** Ryzen 5 5600 (6 cores / 12 threads)
- **RAM:** 32GB DDR4
- **GPU:** RTX 5060 Ti 16GB
- **Storage:** SSD (OS) + HDD (data)

---

## ⚙️ Decision Drivers

* **Simplify Architecture:** ลดจำนวน hosts จาก 2 → 1
* **Enable Docker-Internal Isolation:** Sidecar + backend อยู่บน Docker bridge เดียวกัน → network auth จริง (ADR-040 D5)
* **Better Resource Utilization:** Single host มีทั้ง CPU, RAM, GPU ในเครื่องเดียว
* **Reduce Network Latency:** Backend ↔ Ollama ผ่าน localhost แทน LAN
* **Maintain Data Separation:** QNAP ยังคงเป็น NAS สำหรับ file storage

---

## 🏛️ Decisions

### D1: Co-locate All Services on Single Docker Host
ย้าย services ทั้งหมดไปรันบนเซิร์ฟเวอร์ใหม่ (192.168.10.11) จัดเป็น 4 layers:

- **Layer 1 (01-infrastructure):** MariaDB, phpMyAdmin, Redis, Elasticsearch, Qdrant
- **Layer 2 (02-platform):** Gitea, n8n + n8n-db (PostgreSQL), docker-socket-proxy
- **Layer 3 (03-application):** Backend (NestJS), Frontend (Next.js), ClamAV
- **Layer 4 (04-ai):** Ollama (np-dms-ai, np-dms-ocr, nomic-embed), OCR Sidecar (FastAPI), ollama-metrics

**NPM (Nginx Proxy Manager) ยังคงอยู่ที่ QNAP** — เป็น Edge Proxy แยกจาก compute เพื่อ SPOF mitigation (D6)

**Tika ไม่รวม** — legacy service ที่ถูก reject ใน ADR-028 research (Thai NLP support อ่อนแอ, ขัด ADR-023A)

**Retire Desk-5439** หลัง cutover สำเร็จ

Compose files: `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/`

### D2: ASUSTOR as Primary NAS, QNAP as Edge Proxy + Backup
QNAP (192.168.10.8, 32GB RAM) คงบทบาท:
- **NPM (Nginx Proxy Manager)** — Edge Proxy สำหรับทุก domain (SPOF mitigation, D6)
- **Backup server** — หลัง migration เสร็จ

ASUSTOR (192.168.10.9, 16GB RAM) เป็น Primary NAS สำหรับ:
- Upload temp storage (`/data/uploads/temp`)
- Permanent file storage (`/data/uploads/permanent`)
- Legacy migration files (read-only)
- CIFS share `np-dms-as` ถูก mount บน New Server ผ่าน:
  - `/mnt/asustor-uploads/temp` → `//192.168.10.9/np-dms-as/data/uploads/temp`
  - `/mnt/asustor-uploads/permanent` → `//192.168.10.9/np-dms-as/data/uploads/permanent`
  - `/mnt/asustor-legacy` → `//192.168.10.9/np-dms-as/Legacy` (read-only)

### D3: Docker-Internal Network + IP-Binding Port Exposure
- ทุก service อยู่บน external bridge network `lcbp3` (Docker internal DNS)
- Sidecar และ Ollama **ไม่ publish ports ไป LAN** (ใช้ `expose` เท่านั้น)
- Backend ติดต่อ sidecar/Ollama ผ่าน `http://ocr-sidecar:8765` และ `http://ollama:11434` (Docker DNS)
- Frontend ติดต่อ backend ผ่าน `http://backend:3000` (Docker DNS)
- Services ที่ NPM (QNAP) ต้องเข้าถึง **bind เฉพาะ IP ของ New Server** (`192.168.10.11:PORT` ไม่ใช่ `0.0.0.0`)
- **ไม่ตั้ง UFW firewall** — VLAN 10 เป็น isolated VLAN ควบคุมด้วย Omada OC200 อยู่แล้ว

Port mapping สำหรับ NPM proxy:

| Service | New Server Port | NPM Domain |
|---------|----------------|------------|
| backend | 192.168.10.11:3000 | backend.np-dms.work |
| frontend | 192.168.10.11:3001 | lcbp3.np-dms.work |
| gitea HTTP | 192.168.10.11:3003 | git.np-dms.work |
| gitea SSH | 192.168.10.11:2222 | (direct) |
| n8n | 192.168.10.11:5678 | n8n.np-dms.work |
| pma | 192.168.10.11:8080 | pma.np-dms.work |
| MariaDB | 192.168.10.11:3306 | (NPM QNAP → direct) |
| ollama-metrics | 192.168.10.11:9924 | (Prometheus ASUSTOR) |

**Enables ADR-040 D5:** Network isolation ผ่าน Docker-internal bridge → ลบ `X-API-Key` ได้จริง

### D4: GPU VRAM Management Reinforced
RTX 5060 Ti 16GB ต้องรองรับ:
- `np-dms-ai` (Typhoon-2.5 ~7–8B) ~6–8GB
- `np-dms-ocr` (Typhoon OCR) ~5GB
- `nomic-embed-text` ~0.5GB
- BGE-M3 + Reranker (ถ้า GPU-resident) ~4.5GB
- CUDA overhead ~1.5GB

**Total ≈ 15.5GB → OOM risk หาก load พร้อมกันทั้งหมด**

**Mandatory:**
- ADR-040 D3 (Adaptive OCR Residency via `calculate_ocr_residency()`)
- ADR-040 D4 (CPU Fallback Retrieval for embed/rerank)
- LLM-First GPU Ownership (CONTEXT.md)
- ไม่บังคับ BGE+Reranker GPU-resident ถาวร

### D5: RAM Budget — 32GB Tight Allocation
32GB RAM ต้องรองรับ services ทั้งหมด (ย้ายมาจาก QNAP + Desk-5439):

| Service | Memory Limit | Notes |
|---------|-------------|-------|
| MariaDB | 8G | innodb_buffer_pool_size=8G (DB ยังเล็ก ~10MB) |
| Elasticsearch | 3G | heap 2G (ลดจาก 4G) |
| Redis | 2G | in-memory cache + BullMQ |
| Qdrant | 2G | vector DB |
| Backend (NestJS) | 1.5G | |
| Frontend (Next.js) | 2G | |
| ClamAV | 2G | virus definitions |
| Gitea | 2G | |
| n8n | 2G | workflow orchestrator |
| n8n-db (PostgreSQL) | ~1G | estimated |
| docker-socket-proxy | ~256M | |
| Ollama | 4G | system RAM (VRAM แยก) |
| OCR Sidecar | 1G | |
| ollama-metrics | ~256M | |
| PMA | 256M | |
| OS + Docker daemon | ~2G | |
| **Total** | **~33.5G** | tight — monitor หลัง cutover |

**Action Items:**
- ถ้า OOM → ลด ES heap เป็น 1G หรืออัปเกรด RAM เป็น 64GB
- Monitor RAM usage 24-48 ชม. หลัง cutover
- พิจารณา swap space ถ้าจำเป็น

### D6: Single Point of Failure (SPOF) Mitigation
Single host = SPOF risk สำหรับ compute services

**Mitigation:**
- **NPM แยกไว้ที่ QNAP** — Edge Proxy ไม่อยู่บน New Server → ถ้า New Server ล่ม NPM ยังรับ traffic ได้ (แสดง maintenance page)
- **ASUSTOR เป็น Primary NAS** — file storage แยกจาก compute → ถ้า New Server ล่ม files ยังปลอดภัย
- Regular backup ของ database และ file storage (QNAP + ASUSTOR)
- Disaster recovery plan สำหรับ hardware failure
- พิจารณา cold standby หรือ failover strategy ในอนาคต

---

## 📋 Implementation Tasks

| Task ID | Phase | Summary | Status |
| :--- | :--- | :--- | :--- |
| T001 | Provision | Install Ubuntu 26.04 + Docker + nvidia-container-toolkit | ✅ Done |
| T002 | Provision | Mount CIFS shares from ASUSTOR (uploads + legacy) | ✅ Done |
| T003 | Deploy | Create Docker networks: `lcbp3` + `gitnet` | ✅ Done |
| T004 | Deploy | Create 4-layer compose files (np-dms-lcbp3/) | ✅ Done |
| T005 | Deploy | Deploy Layer 1: Infrastructure (MariaDB, Redis, ES, Qdrant) | ✅ Done |
| T006 | Deploy | Deploy Layer 2: Platform (Gitea, n8n) | ✅ Done |
| T007 | Deploy | Deploy Layer 3: Application (Backend, Frontend, ClamAV) | ✅ Done |
| T008 | Deploy | Deploy Layer 4: AI (Ollama, OCR Sidecar, metrics) | ✅ Done |
| T009 | Migrate | Migrate MariaDB (lcbp3 + gitea + npm) via mysqldump | ✅ Done |
| T010 | Migrate | Migrate Gitea file data (repos, config, registry) | ✅ Done |
| T011 | Migrate | Migrate n8n + PostgreSQL data | ✅ Done |
| T012 | Migrate | Migrate Redis + Elasticsearch + Qdrant data | ✅ Done |
| T013 | Migrate | Pull Ollama models (np-dms-ai, np-dms-ocr, nomic-embed-text) | ✅ Done |
| T014 | Cutover | Update NPM proxy hosts on QNAP → New Server IPs | ✅ Done |
| T015 | Cutover | Run smoke tests on all domains | ✅ Done |
| T016 | ADR-040 | Remove `X-API-Key` from sidecar + backend (ADR-040 D5) | ✅ Done (2026-07-30, ADR-040 Phase 2 — T016/T017/T018) |
| T017 | Cleanup | Stop services on QNAP (ยกเว้น NPM) | N/A — services บน QNAP ไม่มีแล้ว |
| T018 | Cleanup | Retire Desk-5439 | ✅ Done |
| T019 | Docs | Update backup-recovery + network-infrastructure docs | ✅ Done |

---

## 📋 Compose Layout (Implemented)

4-layer structure ที่ `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/`:

```
np-dms-lcbp3/
├── .env.template                    # Master env template
├── MIGRATION-PLAN.md                # 6-phase migration checklist
├── README.md                        # Stack documentation
├── 01-infrastructure/               # Layer 1: Data Stores
│   └── docker-compose.yml           #   mariadb, pma, cache, search, qdrant
├── 02-platform/                     # Layer 2: DevOps Platform
│   └── docker-compose.yml           #   gitea, n8n, n8n-db, docker-socket-proxy
├── 03-application/                  # Layer 3: DMS Application
│   └── docker-compose.yml           #   backend, frontend, clamav
└── 04-ai/                           # Layer 4: AI Services (GPU)
    └── docker-compose.yml           #   ollama, ocr-sidecar, ollama-metrics
```

ดูไฟล์จริงและ RAM budget ที่ `np-dms-lcbp3/README.md`
ดู migration checklist ที่ `np-dms-lcbp3/MIGRATION-PLAN.md`

---

## 📋 Consequences

### Positive

* **Simplified Architecture:** Single compute host → easier deployment, monitoring, troubleshooting
* **True Network Isolation:** Docker-internal bridge enables ADR-040 D5 (network-only auth)
* **Reduced Latency:** Backend ↔ Ollama ผ่าน Docker internal DNS
* **Better Resource Utilization:** Single host มีทั้ง CPU, RAM, GPU
* **Data Separation Maintained:** ASUSTOR เป็น Primary NAS → data แยกจาก compute
* **SPOF Mitigated:** NPM แยกไว้ QNAP → Edge Proxy ไม่ตายถ้า New Server ล่ม

### Negative

* **SPOF Risk (partial):** Compute services ที่ host เดียว — แต่ NPM แยก QNAP และ NAS แยก ASUSTOR
* **RAM Pressure:** 33.5G > 32G — tight, ต้อง monitor และอาจต้องอัปเกรด RAM
* **Migration Complexity:** ต้อง migrate DB + ES + Gitea + n8n + file paths
* **GPU VRAM Pressure:** 16GB ต้องอาศัย adaptive residency + CPU fallback

---

## 🔄 Rollback Plan

1. Stop services บน New Server (ทุก layer)
2. Restore services บน QNAP (backend, frontend, Redis, MariaDB, ES, Qdrant, Gitea, n8n)
3. Restore services บน Desk-5439 (Ollama, OCR sidecar)
4. Revert NPM proxy hosts บน QNAP กลับเป็น Docker DNS names (backend, frontend, gitea, n8n, pma)
5. Update CIFS mount กลับไป ASUSTOR (192.168.10.9) บน QNAP
6. Restore `X-API-Key` ใน sidecar + backend (ADR-040 rollback)

---

## 📝 Verification Plan

1. Smoke tests บน New Server:
   - Backend health check (`http://192.168.10.11:3000/health`)
   - Frontend accessible via NPM (`https://lcbp3.np-dms.work`)
   - OCR endpoint functional (`http://ocr-sidecar:8765/health` — Docker internal)
   - AI inference functional (Ollama `/api/tags` — Docker internal)
   - File upload/download via CIFS (ASUSTOR)
   - Gitea clone/push via SSH (`git.np-dms.work:2222`)
   - n8n workflow execution (`https://n8n.np-dms.work`)
   - PMA accessible (`https://pma.np-dms.work`)
2. Monitor RAM/VRAM usage 24–48 hours หลัง cutover
3. Verify ADR-040 D5 (network-only auth) ทำงานได้จริง
4. Verify ADR-040 D3/D4 (adaptive residency + CPU fallback) ทำงานได้จริง
5. Verify NPM proxy hosts ทุก domain ผ่าน browser
6. ดู migration checklist ที่ `np-dms-lcbp3/MIGRATION-PLAN.md` Phase 6

---

## 📝 Implementation Notes

**Deploy Date:** 2026-07-22
**Server:** `np-dms-lcbp3` (192.168.10.11, VLAN 10)
**Hardware:** Ryzen 5 5600, 64GB RAM, RTX 5060 Ti 16GB, 2x NVMe 931.5G

### RAM Usage จริง (post-migration)

| Service | Planned | Actual | Notes |
|---------|---------|--------|-------|
| MariaDB | 16G | ~16G | innodb_buffer_pool_size=16G |
| Elasticsearch | 6G | ~6G | heap 4G |
| Redis | 4G | ~2G | in-memory cache + BullMQ |
| Qdrant | 4G | ~2G | vector DB |
| Backend (NestJS) | 2G | ~1.5G | |
| Frontend (Next.js) | 3G | ~2G | |
| ClamAV | 2G | ~2G | virus definitions |
| Gitea | 2G | ~1G | |
| n8n + n8n-db | 3G | ~2G | |
| Ollama (systemd) | 8G | ~6G | system RAM (VRAM แยก) |
| OCR Sidecar | 2G | ~1.5G | |
| OS + Docker | 3G | ~3G | |
| **Total** | ~55.8G | ~45G | headroom ~19G |

### VRAM Usage จริง

| Model | Planned | Actual |
|-------|---------|--------|
| np-dms-ai | 6-8G | ~7G |
| np-dms-ocr | 5G | ~5G (adaptive residency) |
| nomic-embed-text | 0.5G | ~0.5G |
| CUDA overhead | 1.5G | ~1.5G |
| **Total** | ~15.5G | ~14G | headroom ~2G |

### ปัญหาที่เจอ + วิธีแก้

1. **QNAP services ไม่มีแล้ว** — ข้อ 6.13 (หยุด services บน QNAP) เป็น N/A เพราะย้ายหมดแล้วก่อน cutover
2. **Cloudflare Tunnel** — หลัง migration เสร็จ ได้ติดตั้ง Cloudflare Tunnel บน New Server เปลี่ยน edge architecture (D5 revised — ดู Addendum Section 11 ใน MIGRATION-PLAN.md)
3. **Functional tests ที่ต้องมี document data** — ข้อ 6.2, 6.3, 6.6, 6.7, 6.8 pending เนื่องจากยังไม่มีข้อมูล document ให้ทดลอง

### D5 Revised (Cloudflare Tunnel)

หลัง migration เสร็จ ได้ติดตั้ง Cloudflare Tunnel บน `np-dms-lcbp3` ทำให้:
- Cloudflare Tunnel เป็น edge เดียว (internet-facing)
- NPM เปลี่ยนบทบาทเป็น internal router
- ดูรายละเอียดใน MIGRATION-PLAN.md Section 11 (Addendum)
