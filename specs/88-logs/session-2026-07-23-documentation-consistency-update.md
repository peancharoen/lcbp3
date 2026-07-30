# Session — 2026-07-23 (Documentation Consistency Update)

## Summary

อัปเดต root documentation 4 ไฟล์ (ARCHITECTURE.md, README.md, CHANGELOG.md, AGENTS.md) ให้สอดคล้องกับสถานะหลังการย้ายระบบ (ADR-041 Server Consolidation) และ ADR ใหม่ (ADR-035, ADR-040, ADR-041) ที่ไม่ได้ถูกอ้างอิงในเอกสารหลัก

## ปัญหาที่พบ (Root Cause)

จากการ review cross-document consistency พบว่า:

1. **ARCHITECTURE.md** (v1.9.9) — ยังอ้างอิง pre-migration topology (QNAP เป็น primary, Desk-5439 เป็น AI host), ไม่มี Cloudflare Tunnel, ADR table หยุดที่ ADR-036
2. **README.md** (v1.9.8) — version badge เก่า, installation อ้างอิง QNAP Container Station, ไม่มี ADR-034/035/040/041, จำนวน ADR ยังเป็น 33
3. **CHANGELOG.md** — ไม่มี entry สำหรับ v1.9.11 (server consolidation, Cloudflare Tunnel, NUT/UPS)
4. **AGENTS.md** (v1.9.10) — Key Spec Files table ขาด ADR-035, ADR-040, ADR-041

## การแก้ไข (Fix)

| ไฟล์           | การเปลี่ยนแปลง         |
| -------------- | ---------------------- |
| `ARCHITECTURE.md` | v1.9.9→v1.9.11: Hardware table (np-dms-lcbp3, QNAP=HA, ASUSTOR=NAS, Desk-5439=decommissioned), Container diagram (Cloudflare edge + AI Zone + Storage Zone), Core services (Qdrant, Ollama systemd, OCR Sidecar, ClamAV), Data flow (Cloudflare replaces NPM), Security zones (post-consolidation), Network topology (Cloudflare Anycast + new server), Firewall rules (dest→192.168.10.11), AI Architecture (location→np-dms-lcbp3, ADR-035 BGE-M3/Tesseract, network-trust boundary), ADR table (+ADR-035/040/041), Version history (+v1.9.11), Related docs (+MIGRATION-PLAN.md) |
| `README.md` | v1.9.8→v1.9.11: Version badge, Status table (41 ADRs, single-host, Cloudflare, NUT/UPS), Features (+Thai AI Stack, +Cloudflare Tunnel, +UPS), Infrastructure (np-dms-lcbp3, 4-layer Docker, Cloudflare edge, Ollama systemd, NUT/UPS), System diagram (post-consolidation), Schema setup (v1.8.0→v1.9.0), ADR count (33→41), Roadmap (+v1.9.11, +v1.9.10), Go-Live target (QNAP→np-dms-lcbp3) |
| `CHANGELOG.md` | เพิ่ม v1.9.11 entry: ADR-034/035/040/041, Cloudflare Tunnel (D5 Revised), NUT/UPS, Docker 4-layer stack, post-migration verification, root docs updated, 41 ADRs total |
| `AGENTS.md` | v1.9.10→v1.9.11: Key Spec Files table (+ADR-035, +ADR-040, +ADR-041, +MIGRATION-PLAN.md), version bump |

## กฎที่ Lock แล้ว

- Root documentation ต้อง sync กับ ADR table ล่าสุดทุกครั้งที่มี ADR ใหม่
- Infrastructure topology ใน ARCHITECTURE.md และ README.md ต้องสอดคล้องกับ MIGRATION-PLAN.md และ CONTEXT.md
- CHANGELOG.md ต้องมี entry สำหรับทุก version ที่ deploy แล้ว

## Verification

- [x] ARCHITECTURE.md version = 1.9.11, ADR table มี ADR-035/040/041
- [x] README.md version badge = 1.9.11, ADR count = 41, infrastructure = np-dms-lcbp3
- [x] CHANGELOG.md มี v1.9.11 entry ที่ด้านบนสุด
- [x] AGENTS.md version = 1.9.11, Key Spec Files table มี ADR-035/040/041 + MIGRATION-PLAN.md
- [ ] Git commit + push (pending user action)
