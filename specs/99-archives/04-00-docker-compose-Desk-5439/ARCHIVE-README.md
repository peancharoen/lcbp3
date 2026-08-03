# Archived: Desk-5439 Docker Compose Stack (pre-ADR-041)

**Date Archived:** 2026-08-03
**Reason:** Superseded by ADR-041 (Server Consolidation, 2026-06-20)
**Current Stack:** [`04-00-docker-compose/np-dms-lcbp3/`](../../04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/)

---

## ที่มา

โฟลเดอร์นี้เก็บ Docker Compose stack และ OCR sidecar ฉบับเก่าที่เคยรันบน host **`Desk-5439`** (192.168.10.100) ก่อนการย้ายรวมบน single host ตาม ADR-041

## ทำไมถึง Archived

ตาม [ADR-041: Server Consolidation](../../06-Decision-Records/ADR-041-server-consolidation.md) (Implemented 2026-07-22):

- ย้าย services ทั้งหมด (Ollama, Qdrant, OCR Sidecar) ไปรวมบน **`np-dms-lcbp3`** (single-host Docker, 4 layers)
- `Desk-5439` ถูก **decommissioned** — ไม่รัน AI workload อีกต่อไป
- QNAP ทำหน้าที่เป็น Edge Proxy (NPM) + Backup server เท่านั้น
- ASUSTOR เป็น Primary NAS สำหรับ file storage

นอกจากนี้ OCR sidecar contract ถูก refactor โดย [ADR-040](../../06-Decision-Records/ADR-040-ocr-sidecar-refactor.md) (pure compute worker, ลบ `/normalize`, single engine `np-dms-ocr`, ลบ `X-API-Key` Phase 2) — ทำให้ sidecar ฉบับเก่าในโฟลเดอร์นี้ล้าสมัยทั้ง contract และโครงสร้าง

## สถาปัตยกรรม AI ปัจจุบัน

⭐ อ่าน [ADR-043: AI Architecture — Current State](../../06-Decision-Records/ADR-043-ai-architecture-current-state.md) (Single Source of Truth) สำหรับสถาปัตยกรรม AI ปัจจุบันทั้งหมด

## หมายเหตุ

- เนื้อหาในโฟลเดอร์นี้คงไว้เพื่อ **audit trail / ประวัติศาสตร์การตัดสินใจ** เท่านั้น
- ⚠️ **ห้ามนำไปใช้งานจริง** — ใช้ stack ปัจจุบันที่ `04-00-docker-compose/np-dms-lcbp3/` เท่านั้น
