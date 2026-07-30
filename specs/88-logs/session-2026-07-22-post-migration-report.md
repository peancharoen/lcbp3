# Session — 2026-07-22 (Post-Migration Documentation Update)

## Summary

อัปเดต MIGRATION-PLAN.md Phase 6 (6.2/6.3/6.6/6.7/6.8 → Pending, 6.13 → N/A) และ 6D. Documentation Update (6.16-6.20) ครบทุกข้อ พร้อมตรวจสอบ Section 10. Remaining Work — ทำครบทั้งหมด

## ปัญหาที่พบ (Root Cause)

- Functional tests (6.2, 6.3, 6.6, 6.7, 6.8) ไม่สามารถทดสอบได้เพราะยังไม่มี document data ในระบบ
- ข้อ 6.13 (หยุด services บน QNAP) เป็น N/A เพราะ services บน QNAP ถูกย้ายออกหมดแล้วก่อน cutover
- ADR-041 ยังเป็น `Accepted` ทั้งที่ implementation เสร็จแล้ว
- เอกสาร infrastructure (CONTEXT.md, backup-recovery, network guide) ยังอ้างอิง topology เดิม

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `MIGRATION-PLAN.md` | 6.2/6.3/6.6/6.7/6.8 → `[⏸]` Pending; 6.13 → `[N/A]`; 6.16-6.20 → `[X]`; Section 10 ทุก item → `[X]` |
| `ADR-041-server-consolidation.md` | Status → `Implemented`; Task table ทั้งหมด → ✅/N/A; เพิ่ม `Implementation Notes` section (RAM/VRAM จริง, ปัญหา, D5 revised) |
| `CONTEXT.md` | เพิ่ม terms: `New Server (np-dms-lcbp3)`, `Cloudflare Tunnel`; อัปเดต `Edge Proxy`; ADR-041 → `✅ Implemented` |
| `04-02-backup-recovery.md` | อัปเดต header: ASUSTOR=Primary NAS, New Server=compute, QNAP=NPM only, Desk-5439=decommissioned |
| `04-network-infrastructure-guide.md` | เพิ่ม `np-dms-lcbp3` ใน Network Equipment table (Compute Server, 192.168.10.11) |
| `specs/88-logs/session-2026-07-22-post-migration-report.md` | สร้าง post-migration report ครบ: migration summary, RAM/VRAM จริง vs แผน, ปัญหา, Phase 6 status, ข้อเสนอแนะ |

## กฎที่ Lock แล้ว

- ADR-041 status = `Implemented` (2026-07-22) — D5 revised: Cloudflare Tunnel เป็น edge, NPM เป็น internal router
- QNAP services ไม่มีแล้ว (ย้ายหมดก่อน cutover) — 6.13 N/A
- Functional tests ที่ต้องมี document data (6.2/6.3/6.6/6.7/6.8) = Pending จนกว่าจะมี document data

## Verification

- [x] ADR-041 status = `Implemented` ในทั้ง ADR file และ CONTEXT.md
- [x] MIGRATION-PLAN.md 6.16-6.20 ทั้งหมด `[X]`
- [x] MIGRATION-PLAN.md Section 10 ทุก item `[X]`
- [x] Post-migration report สร้างใน `specs/88-logs/`
- [ ] Functional tests (6.2/6.3/6.6/6.7/6.8) — รอ document data

---

## Post-Migration Report — Server Consolidation (ADR-041)

**Date:** 2026-07-22
**Migration Plan:** `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/MIGRATION-PLAN.md`
**ADR:** [ADR-041: Single-Host Server Consolidation](../06-Decision-Records/ADR-041-server-consolidation.md)

---

## 1. Migration Summary

| Item | Detail |
|------|--------|
| **Source** | QNAP TS-473A (192.168.10.8) + Desk-5439 (192.168.10.100) |
| **Target** | `np-dms-lcbp3` (192.168.10.11, VLAN 10) |
| **Hardware** | Ryzen 5 5600, 64GB RAM, RTX 5060 Ti 16GB, 2x NVMe 931.5G |
| **OS** | Ubuntu Server 26.04 LTS |
| **Docker** | Docker Engine + Compose V2 |
| **GPU** | NVIDIA driver 550 + nvidia-container-toolkit |
| **Ollama** | Native systemd service (ไม่ใช่ Docker) |

### Services ที่ย้าย

| Service | Source | Target | Method |
|---------|--------|--------|--------|
| MariaDB | QNAP | New Server (Layer 1) | mariadb-dump |
| Redis | QNAP | New Server (Layer 1) | rsync RDB + AOF |
| Elasticsearch | QNAP | New Server (Layer 1) | rsync data dir |
| Qdrant | QNAP | New Server (Layer 1) | rsync storage |
| Gitea | QNAP | New Server (Layer 2) | rsync repos + config |
| n8n + PostgreSQL | QNAP | New Server (Layer 2) | rsync data + pg_dump |
| Backend (NestJS) | QNAP | New Server (Layer 3) | Docker image rebuild |
| Frontend (Next.js) | QNAP | New Server (Layer 3) | Docker image rebuild |
| ClamAV | QNAP | New Server (Layer 3) | Fresh container |
| Ollama | Desk-5439 | New Server (systemd) | Pull models from registry |
| OCR Sidecar | Desk-5439 | New Server (Layer 4) | Docker build context copy |
| ollama-metrics | Desk-5439 | New Server (Layer 4) | Docker container |

---

## 2. RAM/VRAM Usage จริง vs ที่วางแผน

### RAM (Total 64GB)

| Service | Planned | Actual | Delta |
|---------|---------|--------|-------|
| MariaDB | 16G | ~16G | 0 |
| Elasticsearch | 6G | ~6G | 0 |
| Redis | 4G | ~2G | -2G |
| Qdrant | 4G | ~2G | -2G |
| Backend | 2G | ~1.5G | -0.5G |
| Frontend | 3G | ~2G | -1G |
| ClamAV | 2G | ~2G | 0 |
| Gitea | 2G | ~1G | -1G |
| n8n + n8n-db | 3G | ~2G | -1G |
| Ollama (systemd) | 8G | ~6G | -2G |
| OCR Sidecar | 2G | ~1.5G | -0.5G |
| OS + Docker | 3G | ~3G | 0 |
| **Total** | **~55.8G** | **~45G** | **-10.8G** |
| **Headroom** | ~8G | ~19G | +11G |

### VRAM (Total 16GB RTX 5060 Ti)

| Model | Planned | Actual |
|-------|---------|--------|
| np-dms-ai | 6-8G | ~7G |
| np-dms-ocr | 5G | ~5G (adaptive residency) |
| nomic-embed-text | 0.5G | ~0.5G |
| CUDA overhead | 1.5G | ~1.5G |
| **Total** | **~15.5G** | **~14G** |
| **Headroom** | ~0.5G | ~2G |

---

## 3. ปัญหาที่เจอ + วิธีแก้

| # | ปัญหา | วิธีแก้ | Impact |
|---|-------|--------|--------|
| 1 | QNAP services ไม่มีแล้วตอน cutover | ข้อ 6.13 เป็น N/A — ย้ายหมดก่อน cutover | ไม่มี — ลดขั้นตอน |
| 2 | Cloudflare Tunnel ติดตั้งหลัง migration | D5 revised — Cloudflare Tunnel เป็น edge, NPM เป็น internal router | เปลี่ยน edge architecture (บันทึกใน MIGRATION-PLAN.md Section 11) |
| 3 | Functional tests ที่ต้องมี document data | ข้อ 6.2, 6.3, 6.6, 6.7, 6.8 pending | รอ document data ก่อนทดสอบ |

---

## 4. Phase 6 Verification Status

| ข้อ | Test | Status | Notes |
|----|------|--------|-------|
| 6.1 | Login + RBAC | ✅ Pass | |
| 6.2 | File upload (Two-Phase) | ⏸ Pending | ยังไม่มี document data |
| 6.3 | AI chat (RAG) | ⏸ Pending | ยังไม่มี document data |
| 6.4 | OCR | ✅ Pass | |
| 6.5 | Git clone/push | ✅ Pass | |
| 6.6 | n8n workflow | ⏸ Pending | ยังไม่มี document data |
| 6.7 | Document Numbering | ⏸ Pending | ยังไม่มี document data |
| 6.8 | Search (ES) | ⏸ Pending | ยังไม่มี document data |
| 6.9 | RAM/VRAM monitor | ✅ Pass | headroom ~19G RAM, ~2G VRAM |
| 6.10 | Error logs | ✅ Pass | ไม่มี error ร้ายแรง |
| 6.11 | Prometheus metrics | ✅ Pass | |
| 6.12 | Backup to ASUSTOR | ✅ Pass | |
| 6.13 | Stop QNAP services | N/A | services บน QNAP ไม่มีแล้ว |
| 6.14 | Stop Desk-5439 | ✅ Pass | |
| 6.15 | Clean QNAP images | ✅ Pass | |
| 6.16 | Update ADR-041 | ✅ Done | status → Implemented |
| 6.17 | Update CONTEXT.md | ✅ Done | |
| 6.18 | Update backup-recovery doc | ✅ Done | |
| 6.19 | Update network guide | ✅ Done | |
| 6.20 | Post-migration report | ✅ Done | ไฟล์นี้ |

---

## 5. ข้อเสนอแนะสำหรับการปรับปรุง

1. **Document data สำหรับ testing** — ควรสร้าง seed data หรือ import document ตัวอย่างเพื่อทดสอบ functional tests ที่ค้าง (6.2, 6.3, 6.6, 6.7, 6.8)
2. **Cloudflare Tunnel redundancy** — cloudflared รันเป็น instance เดียวบน New Server — ถ้าเครื่องล่ม tunnel ล่มด้วย (ดู MIGRATION-PLAN.md Section 11.4)
3. **Backup strategy update** — 04-02-backup-recovery.md ยังอ้างอิง QNAP เป็น primary source — ควรอัปเดต backup scripts ให้ดึงจาก New Server แทน
4. **Monitor RAM headroom** — มี headroom ~19G สูงกว่าที่วางแผน — สามารถเพิ่ม service ได้ในอนาคต
