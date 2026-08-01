# Session 2026-07-30 — AI Document Ingestion Flow Reconciliation + OcrService Code Smell Fix

## Summary

นำเข้า `docs/AI-step.md` → `specs/02-Architecture/02-05-ai-document-ingestion-flow.md` พร้อม reconcile กับโค้ดจริง, ปิด drift ระหว่าง ADR-035 ↔ ADR-040 อย่างเป็นทางการ (Amended by note), อัปเดต root docs ทั้ง 7 ไฟล์ + `.agents`/`.devin` rules 8 ไฟล์, และแก้ code smell ใน `OcrService` + Sidecar `app.py` + `ai.service.ts` TS1109 syntax error

## ปัญหาที่พบ (Root Cause)

### 1. ADR-035 ↔ ADR-040 drift (ไม่เป็นทางการ)
- ADR-035 (2026-06-05) อ้าง Tesseract fallback, `/normalize` endpoint, engine `typhoon-np-dms-ocr:latest`
- ADR-040 (2026-06-20) แก้ทั้ง 3 จุดใน D1/D2 แต่ไม่ได้ประกาศ `Amends: ADR-035` อย่างเป็นทางการ
- ผล: ADR-035 ยัง `Status: Accepted` บนกระดาษ ทำให้ผู้อ่านสับสน

### 2. OcrService code smell (3 จุด)
- `detectAndExtract()` ใช้ `getActiveEngineId()` เลือกระหว่าง 2 engine — ซับซ้อนเกินจำเป็น (ADR-040 D1 บอก engine เดียว)
- `processWithFastPath` ส่ง `engine='auto'` แต่ audit log บอก `pymupdf` — audit โกหก (sidecar อาจวิ่ง np-dms-ocr ผ่าน "Unknown engine" branch)
- `processWithNpDmsOcr` fallback เรียก `processWithFastPath` → วนกลับมา np-dms-ocr ทางอ้อม (warning "Unknown engine 'auto'" ใน sidecar)

### 3. Sidecar `_process_pdf_doc` — `auto` เป็น "Unknown engine"
- `auto` engine ที่ไม่มี text layer (PDF scan) ตกไป branch "Unknown engine" ทั้งที่เป็น engine ที่รู้จัก
- มี code duplication ระหว่าง np-dms-ocr block และ Unknown engine fallback block

### 4. `ai.service.ts:1379` — TS1109 syntax error (pre-existing)
- Syntax corruption จากการแก้ไขก่อนหน้านี้ (ไม่ใช่งาน session นี้)
- ทำให้ `ai.controller.spec.ts` fail ด้วย TS1109

## การแก้ไข (Fix)

### A. สร้างเอกสารใหม่ + Reconcile ADR

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/02-architecture/02-05-ai-document-ingestion-flow.md` | **สร้างใหม่** — ย้ายจาก `docs/AI-step.md` พร้อม reconcile กับโค้ดจริง: engine เดียว np-dms-ocr, ลบ Tesseract, ลบ /normalize, PyMuPDF auto เป็น dead branch, BGE-M3 ยืนยันมีจริง |
| `specs/06-Decision-Records/ADR-035-ai-pipeline-flow-architecture.md` | เพิ่ม `Amended by: ADR-040` ใน header + amendment note block (4-row table) |
| `specs/06-Decision-Records/ADR-040-ocr-sidecar-refactor.md` | เพิ่ม `Amends: ADR-035` ใน header, แก้ dead link, T010 status Pending → Done |

### B. อัปเดต Root Docs (7 ไฟล์)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/06-Decision-Records/README.md` | เพิ่ม ADR-036/037/040/041/042 ใน index; mark ADR-035 เป็น `⚠️ Amended`; bump v1.9.8 → v1.9.12 |
| `AGENTS.md` | bump v1.9.12 → v1.9.13; Tier 3 AI section เพิ่ม ADR-040/042 + link 02-05 |
| `ARCHITECTURE.md` | bump v1.9.11 → v1.9.12; เพิ่ม 02-05 + Section 7; แก้ Section 5.4 (ลบ Tesseract, เพิ่ม amendment note); แก้ ADR table |
| `CHANGELOG.md` | เพิ่ม entry 1.9.12 (2026-07-30) |
| `CONTEXT.md` | แก้ OCR Service term: D5 → D6, เพิ่ม engine เดียว, ลบ /normalize, เพิ่ม _Avoid_ |
| `CONTRIBUTING.md` | เพิ่ม 02-05 ใน 02-Architecture listing (4 → 5 docs) |
| `README.md` | bump v1.9.11 → v1.9.12; 41 → 43 ADRs; mark ADR-035 amended |

### C. อัปเดต `.agents` + `.devin` rules (8 ไฟล์)

| ไฟล์ | drift ที่แก้ |
| --- | --- |
| `.agents/rules/11-ai-integration.md` + `.devin/rules/11-ai-integration.md` | `gemma4` + `nomic-embed` + `Desk-5439` + `PaddleOCR` → `np-dms-ai` + `np-dms-ocr` + `BGE-M3` + `np-dms-lcbp3` |
| `.agents/rules/02-security.md` + `.devin/rules/02-security.md` | "Admin Desktop" + `gemma4:e4b` → np-dms-lcbp3 + ADR-034/040/041 |
| `.agents/rules/08-development-flow.md` + `.devin/rules/08-development-flow.md` | `gemma4:e4b` → `np-dms-ai via Ollama` |
| `.agents/rules/12-key-spec-files.md` + `.devin/rules/12-key-spec-files.md` | mark ADR-035 `⚠️ Amended`; เพิ่ม ADR-042 + 02-05 |
| `.agents/skills/_LCBP3-CONTEXT.md` | แก้ ADR-023/023A entry: model stack + location |
| `.agents/skills/nestjs-best-practices/AGENTS.md` | แก้ Section 11.1: diagram + abstract + TOC + SQL example |
| `.agents/skills/nestjs-best-practices/rules/lcbp3-ai-boundary.md` | แก้ diagram + SQL example |

### D. แก้ Code Smell (3 ไฟล์)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/services/ocr.service.ts` | `detectAndExtract()` ลบ engine selection branch → ใช้ np-dms-ocr อย่างเดียว; rename `processWithFastPath` → `processWithAutoFallback`; แก้ audit log `pymupdf` → `auto`; แก้ log messages |
| `backend/src/modules/ai/ai.service.ts` | แก้ TS1109 syntax error บรรทัด 1377-1379 (corrupted `manager.query` → คืนรูปแบบปกติ) |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/app.py` | refactor `_process_pdf_doc`: `auto` เป็น known engine (ลด Unknown warning); ลบ code duplication; ทุก path นำไปสู่ np-dms-ocr |
| `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts` | แก้ log messages + `engineUsed` จาก `fast-path` → `np-dms-ocr` |

## กฎที่ Lock แล้ว

| ID | Decision | ADR |
| --- | --- | --- |
| D51 | ADR-040 เป็น Source of Truth สำหรับ OCR sidecar contract (engine selection, /normalize removal) — ADR-035 OCR sidecar section ถูก amend อย่างเป็นทางการ | ADR-040 D1/D2 |
| D52 | `OcrService.detectAndExtract()` ใช้ `processWithNpDmsOcr()` อย่างเดียว — ไม่มี engine selection ใน production pipeline (`getOcrEngines/selectOcrEngine` เก็บไว้สำหรับ Admin Console sandbox testing เท่านั้น) | ADR-040 D1 |
| D53 | Audit log ต้องสะท้อนความจริง: `auto-fallback`/`auto` (ไม่ใช่ `pymupdf`) เมื่อส่ง `engine='auto'` ไป sidecar | ADR-040 |
| D54 | Sidecar `_process_pdf_doc`: `auto` เป็น known engine — ลอง PyMuPDF text layer ก่อน → fallback ไป np-dms-ocr โดยตรง (ไม่ใช่ "Unknown engine"); ทุก engine path นำไปสู่ np-dms-ocr | ADR-040 D1 |
| D55 | `docs/AI-step.md` deprecated — ใช้ `specs/02-architecture/02-05-ai-document-ingestion-flow.md` เป็น canonical walkthrough (ควรลบหรือทำเป็น redirect ในอนาคต) | Session 2026-07-30 |

## Verification

- [x] Backend AI tests: 6 suites, 55 tests ผ่าน (รวม `ai.controller.spec.ts` ที่เคย fail)
- [x] Backend OCR tests: 4 suites, 34 tests ผ่าน
- [x] Frontend OcrEngineSelector tests: 2 suites, 8 tests ผ่าน
- [x] TypeScript compilation: ไม่มี errors
- [x] ไม่มี code reference `processWithFastPath` เหลือ (เฉพาะใน change log comments)
- [x] `getActiveEngineId()` ไม่ปนเปื้อนใน production pipeline (เรียกเฉพาะจาก `getOcrEngines()`)
- [x] Frontend ไม่ impacted เชิงฟังก์ชัน (`getOcrEngines()` ยัง return 2 engines สำหรับ sandbox)

## หมายเหตุ

- **ไม่ได้ลบ `docs/AI-step.md`** — ยังคงไว้ตามเดิม (destructive operation ต้องได้รับอนุมัติ)
- **ADR-035 body ยังมี stale references 18 จุด** — โดย design (ADR immutability) แต่มี amendment note ใน header
- **ADR-040 T001–T009, T011–T014 ยัง Pending** — แก้เฉพาะ T010 (มีหลักฐานชัด)
- **Desk-5439 sidecar copy ไม่ sync** — decommissioned แล้ว (ADR-041)
