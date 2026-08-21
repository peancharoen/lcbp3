# Session — 2026-08-03 (Specs Drift Cleanup — Phase 1 + Phase 2)

## Summary

ตรวจสอบและปรับปรุงไฟล์ใน `specs/` ที่ล้าสมัยจากการตัดสินใจใน ADR กลุ่ม AI (ADR-034/035/040/041/043) และปิด checklist ของ ADR-043 "Required Changes" ที่เหลืออยู่ โดยแบ่งเป็น 2 phase ตามแผนที่ผู้ใช้อนุมัติ

## บริบท

หลังจาก session [ADR-043 consolidation](./session-2026-08-03-adr-043-consolidation.md) สร้าง ADR-043 เป็น Single Source of Truth และย้าย ADR กลุ่ม A ไป archive/ แล้ว ยังมีไฟล์ active specs ที่อ้างอิงสถาปัตยกรรมเก่า (host `Desk-5439`, model `typhoon2.5-np-dms`/`gemma4`/`nomic-embed-text`, Tesseract fallback, `/normalize`, `X-API-Key`) และ drift note ADR-035 ↔ ADR-040 ที่ถูกปิดแล้วอย่างเป็นทางการโดย ADR-043 แต่ยังไม่ได้อัปเดตในเอกสารอ้างอิง

## แผนงาน (5 phase วางไว้ทั้งหมด อนุมัติ Phase 1 + 2 ในรอบนี้)

| Phase | ขอบเขต | สถานะ |
|---|---|---|
| Phase 1 | ปิด ADR-043 checklist + drift note | ✅ เสร็จ |
| Phase 2 | ปรับ Infrastructure & Architecture docs | ✅ เสร็จ |
| Phase 3 | Annotate Speckit feature folders (200/300/100) | ⬜ ไว้รอบถัดไป |
| Phase 4 | Task files & misc references | ⬜ ไว้รอบถัดไป |
| Phase 5 | Non-AI ADR impact scan | ⬜ ไว้รอบถัดไป |

## การเปลี่ยนแปลง (Phase 1 + Phase 2)

### Phase 1 — ปิด ADR-043 checklist + drift note

| ไฟล์ | การเปลี่ยนแปลง | Phase |
|---|---|---|
| `specs/README.md` | ตรวจแล้ว — path links ชี้ไป `archive/` ถูกต้องแล้ว (เป็นงาน session ก่อน) | 1.1 |
| `specs/03-Data-and-Storage/archive/03-07-OpenRAG.md` | แก้ link ADR-018 จาก `Patch 1.8.1.md` → `archive/ADR-018-ai-boundary.md` (link เดียวที่ยัง broken) | 1.2 |
| `.devin/skills/*` + `.agents/skills/*` | ตรวจแล้ว — ทุก path link ชี้ไป `archive/` ถูกต้อง (text-ref annotation "ADR-018/020" ไว้ทำใน Phase 3) | 1.3 |
| `specs/02-architecture/02-05-ai-document-ingestion-flow.md` | เพิ่ม ADR-043 เป็น entry point ใน related list + SoT แบ่งตามชั้น; ปิด drift note ADR-035 ↔ ADR-040 อย่างเป็นทางการ; เพิ่ม change log v1.2.0 | 1.4 |

### Phase 2 — ปรับ Infrastructure & Architecture docs

| ไฟล์ | การเปลี่ยนแปลง | Phase |
|---|---|---|
| `specs/02-architecture/README.md` | แก้ SoT note จาก "ADR-035" → "ADR-043"; แก้ OCR routing จาก "Typhoon + Tesseract fallback" → "single engine `np-dms-ocr` (ไม่มี Tesseract ตาม ADR-040)" | 2.1 |
| `specs/02-architecture/02-05-ai-document-ingestion-flow.md` | reconcile กับ ADR-043 — แก้ model name `typhoon2.5-np-dms` → `np-dms-ai` (3 จุด); อัปเดตตาราง ADR refs (เพิ่ม ADR-043, อัปเดตสถานะ ADR-040/035/036) | 2.2 |
| `specs/02-architecture/02-03-network-design.md` | ตรวจแล้ว — ใช้ `np-dms-lcbp3` เป็น host หลักแล้ว (AI Zone บน np-dms-lcbp3) ไม่ต้องแก้ | 2.3 |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/` → `specs/99-archives/04-00-docker-compose-Desk-5439/` | ย้ายโฟลเดอร์ทั้งหมด (25 ไฟล์) ไป archive ด้วย `git mv` รักษา history; เพิ่ม `ARCHIVE-README.md` อธิบายที่มา (decommissioned per ADR-041) | 2.4 |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/README.md` | แก้ AI boundary policy "Admin Desktop (ADR-018)" → "np-dms-lcbp3 only (ADR-041; ADR-023/043 — ADR-018 archived)" | 2.5 |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/.env.example` | แก้ Ollama/OCR config ล้าสมัย — host `192.168.10.100` → Docker DNS `ollama`/`ocr-sidecar`; model `gemma4:e2b`/`nomic-embed-text` → `np-dms-ai`/`BGE-M3`; เพิ่ม comment อธิบาย QNAP role ใหม่ (NPM + backup เท่านั้น) | 2.5 |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/docker-compose-app.yml` | แก้ comment "PaddleOCR Sidecar (Desk-5439 — ADR-023A)" → "OCR Sidecar (np-dms-lcbp3 04-ai layer — ADR-040/041; PaddleOCR superseded by np-dms-ocr)" | 2.5 |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/SPECS-VERIFICATION-PLAN.md` | อัปเดต path ref `Desk-5439/` → ชี้ไป archive location ใหม่ | 2.5 |

### สิ่งที่ **ไม่แก้** (ตั้งใจ)

- **ไฟล์ ADR เดิม** (ADR-023, 023A, 034, 035, 036, 040, 041 ฯลฯ) — รักษา audit trail ตาม ADR-REVIEW-PROCESS (immutable history); ADR-043 เป็น restatement ไม่ใช่การแก้ ADR เดิม
- **`88-logs/` ทั้งหมด** — session logs เป็นประวัติศาสตร์ ไม่แก้
- **`99-archives/` ส่วนใหญ่** — archive content ไม่แก้ (ยกเว้นเพิ่ม ARCHIVE-README ใหม่)
- **`MIGRATION-PLAN.md`** — Desk-5439 refs เป็น historical migration context (อธิบายที่มาของการย้าย) ทิ้งไว้เป็น audit trail
- **`04-02-backup-recovery.md` บรรทัด 13** — ระบุ "decommissioned" แล้ว ถูกต้อง
- **`02-03-network-design.md` "Admin Desktop"** — เป็น management PC ใน VLAN 20 (ไม่ใช่ AI host) ถูกต้องตาม topology

## ผลลัพธ์ (Verification)

- ทุก path link ของ ADR กลุ่ม A (archived) ชี้ไป `archive/` ถูกต้อง
- Drift note ADR-035 ↔ ADR-040 ใน `02-05-ai-document-ingestion-flow.md` ปิดแล้วอย่างเป็นทางการ (ชี้ไป ADR-043)
- ไม่มี reference `typhoon2.5-np-dms` (model name เก่า) ใน active specs ของ 02-architecture อีก
- ไม่มี reference `Desk-5439` ใน active compose stack (`04-00-docker-compose/` เหลือเฉพาะ QNAP/ASUSTOR/np-dms-lcbp3 ที่ active + ที่ย้ายไป archive)
- โฟลเดอร์ `Desk-5439/` ที่ย้ายไป `99-archives/04-00-docker-compose-Desk-5439/` มี `ARCHIVE-README.md` อธิบายที่มาและสถานะ

## งานที่เหลือ (Phase 3-5 ไว้รอบถัดไป)

- **Phase 3:** Annotate header ของ Speckit feature folders ที่เกี่ยวกับ AI (232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 301, 302, 140) — เพิ่ม note ชี้ไป ADR-043 โดยไม่แก้เนื้อหา
- **Phase 4:** ตรวจ `08-Tasks/`, `01-01-objectives.md`, `03-06-migration-business-scope.md` ที่อ้าง ADR กลุ่ม A
- **Phase 5:** สแกน non-AI ADR (ADR-009, ADR-019, ADR-021) ว่ามี specs ล้าสมัยหรือไม่
- **Text-ref annotation:** ใน skills ยังมี text "ADR-018/020" เป็น authoritative ทั้งที่ archived — ไว้ทำใน Phase 3

## หมายเหตุ

- ไม่ได้ commit (เป็น policy ปกติ — ผู้ใช้ไม่ได้ขอ commit)
- ใน working tree มี modifications ค้างอยู่ก่อน session นี้จาก session ADR-043 consolidation + skills restructure (`CONTEXT.md`, `memory/project-memory-override.md`, `.agents/skills/*`, `.devin/skills/*`, `specs/06-Decision-Records/README.md`, `specs/03-Data-and-Storage/README.md`) — เป็น context ปัจจุบัน ไม่ใช่งานของ session นี้ แต่เกี่ยวข้องกับแผนเดียวกัน
