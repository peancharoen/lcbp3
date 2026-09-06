# Phase 0 Research: 4-Layer Excel Data Review Pipeline

**Feature Branch**: `feature/252-excel-data-review-pipeline`  
**Date**: 2026-09-05  
**Spec**: [spec.md](./spec.md) | **ADR**: [ADR-052](../../06-Decision-Records/ADR-052-excel-data-review-pipeline.md)

---

## 🔬 Research Findings & Decisions

### 1. Excel Parsing & Annotation Engine
- **Decision**: ใช้ `exceljs` (`^4.4.0`) สำหรับอ่าน Streaming และสร้าง Annotated Workbook พร้อม Color Fills และ Cell Notes
- **Rationale**:
  - `exceljs` ถูกติดตั้งใน `backend/package.json` เรียบร้อยแล้ว
  - รองรับการฝัง Cell Comment/Note (`cell.note = '...'`) และการกำหนดสไตล์สีพื้นหลัง (`cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '...' } }`)
  - รองรับการสร้างหลาย Sheets ในไฟล์เดียว (`Review_Summary` และ `Data`)
- **Alternatives Considered**:
  - `xlsx` (SheetJS): ฟรีไม่รองรับ Cell Styling ในเวอร์ชัน Community Edition โดยสมบูรณ์

### 2. Multi-tier AI Reviewer Architecture
- **Decision**: ออกแบบ Interface `AiReviewerProvider` 3 Tiers:
  - **Tier 1 (Default):** Local LLM (`np-dms-ai` via Ollama) — On-premises 100%, ADR-023 compliant
  - **Tier 2 (Secondary):** Google Gemini API (`@google/genai` or direct HTTP) — Free tier 15 RPM
  - **Tier 3 (Tertiary):** Anthropic Claude API (`@anthropic-ai/sdk`) — High capability
- **Boundary & Guard**:
  - Tier 2 & 3 ต้องมีสิทธิ์ `SUPER_ADMIN` หรือ `ORG_ADMIN` และเปิด `ALLOW_EXTERNAL_AI_REVIEW=true` ใน AI Admin Console (ADR-027)
  - ต้องทำงานแบบ **Fail-Open**: หาก Provider ตอบกลับช้าหรือล้มเหลว ระบบจะข้าม Layer 3 ทันทีโดยใช้ผลจาก Layer 1 & 2

### 3. Session Management & Storage Hygiene
- **Decision**: เก็บ Active Session ชั่วคราวใน Redis ด้วย TTL 86400 วินาที (24 ชม.) และบันทึกถาวรลง MariaDB `import_transactions` เมื่อกด Confirm สำเร็จ
- **Rationale**:
  - ไม่ต้องแก้ Database Schema (ADR-044 compliance)
  - ขยะล้างตัวเองอัตโนมัติเมื่อครบ 24 ชม.
  - มี BullMQ Cron กวาดล้างโฟลเดอร์ Stash ใน `uploads/staging/import-review/`

### 4. Date Normalization & Era Handling
- **Decision**: สร้าง `ExcelDateParser` ยึดมาตรฐาน Thai DMY (วัน/เดือน/ปี) และแปลง พ.ศ. $\rightarrow$ ค.ศ. อัตโนมัติ (หัก 543 เมื่อปี $> 2400$)
- **Rationale**:
  - โครงการก่อสร้างของไทยพิมพ์ พ.ศ. ปน ค.ศ. เป็นประจำ
  - มี Chronology Guard บังคับ `issued_date <= received_date <= NOW() + 1 day` ใน Layer 2

### 5. Multi-Project Contamination Guard
- **Decision**: บังคับ Single Project per File และ Cross-check รหัสโครงการในไฟล์กับ `projectPublicId` ใน Request เสมอ
- **Rationale**:
  - ป้องกันการนำเข้าเอกสารสลับสัญญา (เช่น Lot 1 ปน Lot 2) ซึ่งสร้างความเสียหายร้ายแรง
