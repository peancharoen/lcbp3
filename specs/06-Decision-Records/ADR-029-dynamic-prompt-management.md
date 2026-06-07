# ADR-029: Dynamic Prompt Management for OCR Extraction

**Status:** Accepted
**Date:** 2026-05-25
**Decision Makers:** Development Team, System Architect
**Related Documents:**
- [ADR-027: AI Admin Console and Dynamic Control](./ADR-027-ai-admin-console-and-dynamic-control.md)
- [ADR-023A: Unified AI Architecture — Model Revision](./ADR-023A-unified-ai-architecture.md)
- [ADR-009: Database Migration Strategy](./ADR-009-database-migration-strategy.md)
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md)

---

## บริบทและปัญหา (Context and Problem Statement)

`processSandboxExtract` และ `processMigrateDocument` ใน `ai-batch.processor.ts` ต่างมี prompt template แบบ **hardcoded** ที่ไม่สามารถแก้ไขได้โดยไม่ต้อง redeploy:

- `processSandboxExtract` สกัด 5 fields (documentNumber, subject, discipline, date, confidence)
- `processMigrateDocument` สกัด 8 fields (+ category, tags, summary)
- ทั้งสองใช้ prompt ที่ต่างกัน ทำให้ sandbox ไม่ simulate พฤติกรรมจริงได้แม่นยำ

ปัญหาเพิ่มเติมที่พบ:
1. **Timeout Bug**: `AI_TIMEOUT_MS = 30000ms` (30 วินาที) สั้นเกินไปสำหรับ Ollama ใน OCR Sandbox — การรันครั้งที่สองมักล้มเหลวเพราะ model ต้องโหลดใหม่เข้า VRAM
2. **ไม่มี version history**: ไม่สามารถ rollback กลับไป prompt เดิมได้

---

## ปัจจัยขับเคลื่อนการตัดสินใจ (Decision Drivers)

- **Admin Control**: Superadmin ต้องแก้ไข prompt ได้ runtime ผ่าน AI Admin Console
- **Consistency**: Sandbox และ migrate-document ต้องใช้ prompt เดียวกัน ผลลัพธ์ sandbox จึงสะท้อนพฤติกรรมจริง
- **Auditability**: ต้องมี version history เพื่อ compare ผลลัพธ์ระหว่าง prompt versions
- **Safety**: ห้ามลบ active version, ต้อง validate placeholder `{{ocr_text}}` ก่อน save

---

## ทางเลือกที่ถูกพิจารณา (Considered Options)

### Option 1: เก็บ prompt ใน `system_settings` (Generic Key-Value)
- **ข้อดี:** ไม่ต้องสร้างตารางใหม่
- **ข้อเสีย:** `system_settings` ออกแบบสำหรับ "current value" เท่านั้น ไม่มี version history, ไม่มี result storage

### Option 2: ตาราง `ai_prompts` แยกต่างหาก (ตัวเลือกที่ได้รับเลือก)
- **ข้อดี:** Versioned, immutable snapshots, รองรับ test result storage, ออกแบบตรงกับ use case
- **ข้อเสีย:** ต้องสร้าง entity/service/controller ใหม่

---

## ผลการตัดสินใจ (Decision Outcome)

**ทางเลือกที่ได้รับเลือก:** Option 2 — ตาราง `ai_prompts` พร้อม versioning

---

## ข้อตกลงหลัก (Core Decisions — Grilling Session 2026-05-25)

| # | ประเด็น | การตัดสินใจ |
|---|---------|-------------|
| 1 | Prompt type scope | `prompt_type = 'ocr_extraction'` เดียว (8 fields) ใช้ร่วมกันทั้ง sandbox และ migrate-document |
| 2 | Activation model | Single `is_active` flag — "นำไปใช้จริง" = activate ทันทีทั้งระบบ (ทั้ง sandbox และ migrate-document) |
| 3 | Result storage | Auto-save `test_result_json` จาก sandbox run ล่าสุด + `manual_note` สำหรับ admin annotation |
| 4 | Versioning | Immutable version — ทุก "บันทึก" สร้าง version ใหม่เสมอ, สามารถลบได้ (ยกเว้น active version) |
| 5 | Template format | Full template พร้อม `{{ocr_text}}` placeholder — backend validate ก่อน save |
| 6 | Bug fix | เพิ่ม `timeoutMs` เฉพาะ sandbox-extract เป็น 120000ms แทน default 30000ms |

---

## รายละเอียดเชิงสถาปัตยกรรม (Implementation Details)

### 1. โครงสร้างตาราง `ai_prompts`

```sql
CREATE TABLE ai_prompts (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  prompt_type    VARCHAR(50) NOT NULL
                   COMMENT 'ประเภท prompt เช่น ocr_extraction',
  version_number INT NOT NULL
                   COMMENT 'เลข version ต่อเนื่องต่อ prompt_type (1, 2, 3...)',
  template       TEXT NOT NULL
                   COMMENT 'prompt template ที่มี {{ocr_text}} placeholder บังคับ',
  field_schema   JSON NULL
                   COMMENT 'definition ของ fields ที่คาดหวังในผลลัพธ์ JSON',
  is_active      TINYINT(1) DEFAULT 0
                   COMMENT '1 = version นี้ใช้งานจริงทั้ง sandbox และ migrate-document',
  test_result_json JSON NULL
                   COMMENT 'ผลลัพธ์ JSON จาก sandbox run ล่าสุด (auto-save โดย processor)',
  manual_note    TEXT NULL
                   COMMENT 'หมายเหตุ/annotation จาก admin (manual input)',
  last_tested_at TIMESTAMP NULL
                   COMMENT 'เวลาที่ sandbox รันครั้งล่าสุดสำหรับ version นี้',
  activated_at   TIMESTAMP NULL
                   COMMENT 'เวลาที่ version นี้ถูก activate เป็น active',
  created_by     INT NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_type_version (prompt_type, version_number),
  INDEX idx_prompt_type_active (prompt_type, is_active),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ตาราง versioned prompt templates สำหรับ OCR extraction (ADR-029)';
```

**Seed data** — default active version ที่ migrate มาจาก hardcoded prompt ปัจจุบัน:
```sql
INSERT INTO ai_prompts (prompt_type, version_number, template, is_active, created_by)
VALUES ('ocr_extraction', 1, '<current hardcoded prompt with {{ocr_text}}>', 1, 1);
```

### 2. Validation Rule (backend — ก่อน save)

```typescript
// AiPromptsService.create()
if (!dto.template.includes('{{ocr_text}}')) {
  throw new BadRequestException(
    'template ต้องมี {{ocr_text}} placeholder เพื่อระบุตำแหน่งที่จะแทรกข้อความจาก OCR'
  );
}
```

### 3. Prompt Resolution ใน Processor

```typescript
// ใช้ใน processSandboxExtract และ processMigrateDocument
private async resolvePrompt(ocrText: string): Promise<string> {
  const activePrompt = await this.aiPromptsService.getActive('ocr_extraction');
  if (!activePrompt) {
    throw new Error('ไม่พบ active prompt สำหรับ ocr_extraction');
  }
  return activePrompt.template.replace('{{ocr_text}}', ocrText);
}
```

- ทั้ง `processSandboxExtract` และ `processMigrateDocument` เรียก `resolvePrompt()` เดียวกัน
- `processSandboxExtract` auto-save ผล JSON ลงใน `active_prompt.test_result_json` + update `last_tested_at`

### 4. Ollama Timeout Fix

```typescript
// processSandboxExtract — ส่ง timeoutMs เฉพาะเพื่อแก้ bug timeout ครั้งที่ 2
const response = await this.ollamaService.generate(prompt, {
  timeoutMs: 120000,  // 2 นาที แทน default 30 วินาที
});
```

**Root cause ของ bug:** `AI_TIMEOUT_MS = 30000ms` — Ollama unload model จาก VRAM หลังจาก idle ระยะหนึ่ง (default keep_alive = 5 นาที แต่ VRAM pressure อาจเร็วกว่า) การรันครั้งที่สองต้องโหลด model ใหม่ ซึ่งใช้เวลา > 30 วินาที

### 5. API Endpoints ใน `ai.controller.ts`

| Method | Path | Action | Guard |
|--------|------|--------|-------|
| `GET` | `/ai/prompts/:type` | ดึง all versions ของ prompt_type (paginated) | `system.manage_all` |
| `POST` | `/ai/prompts/:type` | สร้าง version ใหม่ (validate `{{ocr_text}}`) | `system.manage_all` |
| `DELETE` | `/ai/prompts/:type/:version` | ลบ version (guard: ห้ามลบ active) | `system.manage_all` |
| `POST` | `/ai/prompts/:type/:version/activate` | Activate version ("นำไปใช้จริง") | `system.manage_all` |
| `PATCH` | `/ai/prompts/:type/:version/note` | บันทึก manual_note | `system.manage_all` |

### 6. UI/UX ใน OCR Sandbox Tab

Layout ใหม่ของ OCR Sandbox tab:
```
┌─────────────────────────────────────────────────────┐
│ OCR Sandbox Playground                              │
├──────────────────────┬──────────────────────────────┤
│  Prompt Editor       │  Version History             │
│  ┌────────────────┐  │  ┌────────────────────────┐  │
│  │ textarea       │  │  │ v3 (active) ✅          │  │
│  │ {{ocr_text}}   │  │  │ v2 - 2026-05-24        │  │
│  │ ...            │  │  │ v1 - 2026-05-22        │  │
│  └────────────────┘  │  └────────────────────────┘  │
│  [บันทึก Version ใหม่]│  [Load] [Activate] [Delete] │
├──────────────────────┴──────────────────────────────┤
│  File Upload: [เลือก PDF]                           │
│  [เริ่มทำ OCR Sandbox]                              │
├─────────────────────────────────────────────────────┤
│  ผลลัพธ์ JSON + [บันทึก Manual Note]               │
└─────────────────────────────────────────────────────┘
```

**Flow:**
1. เปิด tab → โหลด active version เข้า textarea อัตโนมัติ
2. Admin แก้ไข prompt → กด **"บันทึก Version ใหม่"** → สร้าง version ใหม่ (inactive)
3. Admin upload PDF → กด **"เริ่มทำ OCR Sandbox"** → รันด้วย active version
4. ผลลัพธ์ auto-save ลง active version's `test_result_json`
5. Admin ตรวจสอบผล → กด **"นำไปใช้จริง"** บน version ที่ต้องการ → activate

---

## ผลกระทบ (Consequences)

### ผลดี
- Admin ปรับ prompt ได้ real-time ไม่ต้อง redeploy
- Sandbox สะท้อนพฤติกรรม migrate-document ได้แม่นยำ (8 fields เหมือนกัน)
- Version history เปรียบเทียบผลลัพธ์ระหว่าง prompt versions ได้
- Bug timeout ได้รับการแก้ไข

### ผลเสีย / ข้อระวัง
- ถ้าไม่มี active prompt → processor throw error → ต้องมี seed data พร้อมก่อน deploy
- `processMigrateDocument` อาจเปลี่ยน prompt กลางชุด batch ถ้า admin activate ระหว่างที่ batch กำลังรัน — **acceptable tradeoff** เนื่องจาก batch มักสั้น และ admin ควร activate เมื่อไม่มี batch running
- เพิ่ม DB query ต่อ job (query active prompt) — **mitigate** ด้วย Redis cache TTL 60s สำหรับ active prompt

---

## Redis Cache Strategy สำหรับ Active Prompt

```
Key: ai:prompt:active:ocr_extraction
TTL: 60 วินาที
Invalidate: หลัง activate สำเร็จ (AiPromptsService.activate())
```

---

## Grilling Session Log

```
2026-05-25 — grilling session ผ่าน Devin Cascade
Q1: prompt_type scope → 'ocr_extraction' เดียว (8 fields) ร่วมกันทั้งคู่
Q2: activation model → Option A (single is_active flag)
Q3: result storage → Option C (auto-save + manual_note)
Q4: versioning → Option A (immutable, every save = new version, deletable)
Q5: template format → Option A ({{ocr_text}} placeholder, validated)
Bug: AI_TIMEOUT_MS 30s too short → fix: timeoutMs: 120000 for sandbox-extract
```
