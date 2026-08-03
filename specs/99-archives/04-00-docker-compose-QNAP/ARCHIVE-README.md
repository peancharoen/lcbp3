# Archived: QNAP Docker Compose Stack (pre-ADR-041)

**Date Archived:** 2026-08-03
**Reason:** Superseded by ADR-041 (Server Consolidation, 2026-06-20) + QNAP no longer runs Docker (real-world state 2026-08-03)
**Current Stack:** [`04-00-docker-compose/np-dms-lcbp3/`](../../04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/) (4 layers)

---

## ที่มา

โฟลเดอร์นี้เก็บ Docker Compose stack ฉบับเก่าที่เคยรันบน **QNAP TS-473A** (192.168.10.8) ผ่าน Container Station ก่อนการย้ายรวมบน single host ตาม ADR-041

โครงสร้างเดิม (pre-ADR-041):
- `app/` — backend, frontend, clamav (Layer 3)
- `gitea/` — Gitea (Layer 2)
- `mariadb/` — MariaDB (Layer 1)
- `monitoring/` — cAdvisor, exporters
- `n8n/` — n8n workflow engine
- `npm/` — Nginx Proxy Manager (edge proxy)
- `rocketchat/` — RocketChat
- `service/` — shared service configs

> **หมายเหตุ (2026-08-03):** ผู้ดูแลระบบลบ `app/.env.example` และ `app/docker-compose-app.yml` ออกจาก archive (ไม่จำเป็นต้องเก็บ) — ไฟล์ compose ที่ยังเหลือใน `app/` คือ `docker-compose-lcbp3-bak.yml` (backup version)

## ทำไมถึง Archived

### 1. ADR-041 (Server Consolidation, 2026-06-20)

ย้าย services ทั้งหมด (mariadb, redis, backend, frontend, gitea, n8n, clamav, qdrant, ollama, ocr-sidecar) ไปรวมบน **`np-dms-lcbp3`** (single-host Docker, 4 layers)

### 2. Real-world state change (2026-08-03)

**QNAP ไม่มี Docker แล้ว** — ผู้ดูแระบบยืนยันว่า Container Station ถูกปิด/ถอดการใช้งานบน QNAP ทำให้แม้แต่ `npm/` (Nginx Proxy Manager) ที่ ADR-041 เดิมกำหนดให้คงอยู่ที่ QNAP เพื่อ SPOF mitigation ก็ไม่ได้รันบน QNAP อีกต่อไป

> ⚠️ **หมายเหตุการเปลี่ยนแปลงจาก ADR-041:** ADR-041 D2/D6 ระบุไว้ว่า NPM คงอยู่ที่ QNAP เป็น Edge Proxy — แต่สถานะจริงปัจจุบัน QNAP ไม่มี docker แล้ว Edge proxy ปัจจุบันใช้ **Cloudflare Tunnel บน `np-dms-lcbp3`** (ดู `04-02-backup-recovery.md` บรรทัด Edge Proxy) การเปลี่ยนแปลงนี้อาจต้องบันทึกเป็น ADR amendment แยกต่างหาก

## QNAP role ปัจจุบัน

- **QNAP TS-473A** (192.168.10.8) — NAS เท่านั้น (file storage, backup target)
- ไม่รัน Docker workload ใดๆ อีก
- Edge Proxy ใช้ Cloudflare Tunnel บน `np-dms-lcbp3`

## หมายเหตุ

- เนื้อหาในโฟลเดอร์นี้คงไว้เพื่อ **audit trail / ประวัติศาสตร์การตัดสินใจ** เท่านั้น
- ⚠️ **ห้ามนำไปใช้งานจริง** — ใช้ stack ปัจจุบันที่ `04-00-docker-compose/np-dms-lcbp3/` เท่านั้น
- ดู [ADR-041](../../06-Decision-Records/ADR-041-server-consolidation.md) สำหรับรายละเอียดการย้าย
