# ADR-037: Unified Prompt Management UX/UI

**Status:** Implemented
**Date:** 2026-06-14
**Last Updated:** 2026-06-15
**Decision Makers:** Development Team, System Architect
**Supersedes:** ADR-029: Dynamic Prompt Management (extends prompt_type scope)
**Related Documents:**
- [ADR-027: AI Admin Console and Dynamic Control](./ADR-027-ai-admin-console-and-dynamic-control.md)
- [ADR-030: Context-Aware Prompt Templates](./ADR-030-context-aware-prompt-templates.md)
- [ADR-036: Unified AI Model Architecture](./ADR-036-unified-ocr-architecture.md)
- [ADR-035: AI Pipeline Flow Architecture](./ADR-035-ai-pipeline-flow-architecture.md)

---

## บริบทและปัญหา (Context and Problem Statement)

ADR-029 กำหนด architecture สำหรับ prompt management (ai_prompts table, versioning, activation) แต่จำกัด scope ไว้ที่ prompt_type='ocr_extraction' เดียว และไม่ได้ระบุ UX/UI อย่างละเอียด ทำให้เกิดปัญหาดังนี้:

1. **Version History สับสน:** ไม่แยกระหว่าง prompt types (OCR vs AI) ทำให้ admin ไม่รู้ว่า version ไหนใช้สำหรับ workflow ไหน
2. **Sandbox Workflow ไม่ตรง Production:** ปัจจุบันใช้ 2-step flow (OCR → AI Extract) แต่ production ใช้ 3-step flow (OCR → Extract → RAG Prep) ทำให้ sandbox ทดสอบไม่ครบ
3. **Context Config UI ขาดไป:** ADR-030 กำหนด context_config แต่ไม่มี UI สำหรับ View/Edit/Save/Apply ทำให้ไม่สามารถจัดการ context ได้
4. **Config Types ไม่เคลียร์:** Admin สับสนระหว่าง 3 config types:
   - Runtime Parameters (temperature, topP, ฯลฯ) - คุม AI model behavior
   - Context Config (projectId, contractId, ฯลฯ) - คุม data context
   - System Prompt (AI role/instruction) - คุม AI บทบาท

---

## ปัจัยขับเคลื่อนการตัดสินใจ (Decision Drivers)

- **Multi-Type Support:** ระบบต้องรองรับหลาย prompt types (ocr_extraction, rag_query_prompt, rag_prep_prompt, classification_prompt) ตาม ADR-035 flows
- **Sandbox-Production Parity:** Sandbox ต้องทดสอบทั้ง pipeline ที่ใช้ใน production (OCR → Extract → RAG Prep) เพื่อให้ผลลัพธ์ตรงความจริง
- **Context Config Management:** Admin ต้องสามารถ View/Edit/Save/Apply context_config ได้ผ่าน UI
- **Clear Separation:** 3 config types (Runtime Parameters, Context Config, System Prompt) ต้องแยก UI ชัดเจนเพื่อลดความสับสน
- **Single Page Layout:** ตาม ADR-027, AI Admin Console ควรเป็น single page layout

---

## ทางเลือกที่ถูกพิจารณา (Considered Options)

### Option 1: แยกหน้าตาม Prompt Type
- **ข้อดี:** UI เรียบง่าย แต่ละ prompt type มีหน้าของตัวเอง
- **ข้อเสีย:** ไม่ consistent กับ ADR-027 (single page), ยากต่อการเปรียบเทียบระหว่าง types

### Option 2: Single Page พร้อม Prompt Type Dropdown (ตัวเลือกที่ได้รับเลือก)
- **ข้อดี:** Consistent กับ ADR-027, ง่ายต่อการเปรียบเทียบ, ลดจำนวน components
- **ข้อเสีย:** UI ซับซ้อนขึ้นเล็กน้อย (ต้องจัดการ state หลาย prompt types)

---

## ผลการตัดสินใจ (Decision Outcome)

**ทางเลือกที่ได้รับเลือก:** Option 2 — Single Page พร้อม Prompt Type Dropdown

---

## ข้อตกลงหลัก (Core Decisions — Grilling Session 2026-06-14)

| # | ประเด็น | การตัดสินใจ |
|---|---------|-------------|
| 1 | Prompt Type Scope | รองรับ 4 types: ocr_extraction, rag_query_prompt, rag_prep_prompt, classification_prompt |
| 2 | Sandbox Workflow | Required 3-step flow: OCR → Extract → RAG Prep |
| 3 | UX/UI Layout | Single Page พร้อม Prompt Type Dropdown |
| 4 | Context Config UI | View/Edit/Save/Apply ครบถ้วน |
| 5 | Runtime Parameters UI | แยกจาก Context Config UI ชัดเจน |
| 6 | Version History | แยกตาม prompt_type, แสดง active badge, test result |
| 7 | Sandbox to Production | สามารถส่งต่อผลลัพธ์ sandbox ไป activate version ได้ |
| 8 | Supersede ADR-029 | ใช่ - ขยาย prompt_type scope จากเดียวเป็นหลาย types |

---

## รายละเอียดเชิงสถาปัตยกรรม (Implementation Details)

### 1. Database Schema Changes (ADR-009)

**Table: ai_prompts** (มีอยู่แล้วจาก ADR-029, ไม่ต้องเปลี่ยน)
- `prompt_type` VARCHAR(50) - รองรับหลาย types
- `context_config` JSON NULL - เพิ่มจาก ADR-030 (มีอยู่แล้ว)

**Seed Data:**
```sql
-- OCR Extraction Prompt (มีอยู่แล้วจาก ADR-029)
INSERT INTO ai_prompts (prompt_type, version_number, template, context_config, is_active, created_by)
VALUES ('ocr_extraction', 1, '<template with {{ocr_text}} and {{master_data_context}}>',
        '{"filter": null, "pageSize": 3, "language": "th", "outputLanguage": "th"}',
        1, 1);

-- RAG Query Prompt (ใหม่)
INSERT INTO ai_prompts (prompt_type, version_number, template, context_config, is_active, created_by)
VALUES ('rag_query_prompt', 1, '<template for RAG Q&A>',
        '{"filter": null, "language": "th"}',
        1, 1);

-- RAG Prep Prompt (ใหม่)
INSERT INTO ai_prompts (prompt_type, version_number, template, context_config, is_active, created_by)
VALUES ('rag_prep_prompt', 1, '<template for Semantic Chunking>',
        '{"filter": null, "language": "th"}',
        1, 1);

-- Classification Prompt (ใหม่)
INSERT INTO ai_prompts (prompt_type, version_number, template, context_config, is_active, created_by)
VALUES ('classification_prompt', 1, '<template for document classification>',
        '{"filter": null, "language": "th"}',
        1, 1);
```

### 2. Backend API Endpoints

**Existing Endpoints (จาก ADR-029):**
- `GET /api/ai/prompts/:type` - ดึง all versions ของ prompt_type
- `POST /api/ai/prompts/:type` - สร้าง version ใหม่
- `DELETE /api/ai/prompts/:type/:version` - ลบ version
- `POST /api/ai/prompts/:type/:version/activate` - Activate version
- `PATCH /api/ai/prompts/:type/:version/note` - บันทึก manual_note

**New Endpoints (สำหรับ Context Config):**
- `GET /api/ai/prompts/:type/:version/context-config` - ดึง context_config ของ version
- `PUT /api/ai/prompts/:type/:version/context-config` - อัปเดต context_config

**Sandbox Endpoints (อัปเดตจาก ADR-035):**
- `POST /api/ai/admin/sandbox/ocr` - Step 1: OCR (มีอยู่แล้ว)
- `POST /api/ai/admin/sandbox/ai-extract` - Step 2: AI Extract (มีอยู่แล้ว)
- `POST /api/ai/admin/sandbox/rag-prep` - Step 3: RAG Prep (ใหม่)

### 3. Frontend UX/UI Layout

**Single Page Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ AI Admin Console - Prompt Management                          │
├─────────────────────────────────────────────────────────────┤
│ Prompt Type: [Dropdown: OCR Extraction ▼]                    │
├──────────────────────┬──────────────────────────────────────┤
│  Left Panel          │  Right Panel                          │
│  ┌────────────────┐  │  ┌────────────────────────────────┐  │
│  │ Version History│  │  │ Prompt Editor + Context Config │  │
│  │ v3 (active) ✅ │  │  │ ┌────────────────────────────┐ │  │
│  │ v2 - 2026-05-24│  │  │ │ Prompt Template Editor     │ │  │
│  │ v1 - 2026-05-22│  │  │ └────────────────────────────┘ │  │
│  └────────────────┘  │  │ ┌────────────────────────────┐ │  │
│                      │  │ │ Context Config Editor     │ │  │
│                      │  │ │ - Project Filter          │ │  │
│                      │  │ │ - Contract Filter         │ │  │
│                      │  │ │ - Page Size               │ │  │
│                      │  │ │ - Language                │ │  │
│                      │  │ └────────────────────────────┘ │  │
│                      │  │ [Save New Version] [Activate] │  │
│                      │  └────────────────────────────────┘  │
├──────────────────────┴──────────────────────────────────────┤
│  Sandbox Tabs                                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [OCR] [Extract] [RAG Prep]                              │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Sandbox Test Area                                      │  │
│  │ - Upload PDF                                           │  │
│  │ - Select Project/Contract                              │  │
│  │ - Run Test                                             │  │
│  │ - View Results                                        │  │
│  │ - [Activate This Version]                             │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- **PromptTypeDropdown:** เลือก prompt_type (ocr_extraction, rag_query_prompt, rag_prep_prompt, classification_prompt, All Types)
- **VersionHistory:** แสดง versions ของ prompt_type ที่เลือก (แยกตาม type) หรือทุก types (All Types view)
- **PromptEditor:** Textarea สำหรับแก้ prompt template (validate placeholders ตาม prompt type)
- **ContextConfigEditor:** Form สำหรับ edit context_config (projectId, contractId, pageSize, language)
- **SandboxTabs:** Tabs สำหรับทดสอบแต่ละ step (OCR, Extract, RAG Prep - required)
- **RuntimeParametersPanel:** Sliders สำหรับ runtime parameters (temperature, topP, repeatPenalty, ฯลฯ) - แยกจาก Context Config, label: "Runtime Parameters (Global - Applies to All AI Jobs)"

**Responsive Design:**
- **Desktop (>1024px):** 2-column layout (Left Panel 50%, Right Panel 50%)
- **Tablet (768px-1024px):** 2-column layout (Left Panel 40%, Right Panel 60%)
- **Mobile (<768px):** Stack panels vertically (Left Panel collapsible accordion on top, Right Panel full width below, Sandbox full width below Editor)

**Context Config Field Validation:**
- **Project Filter:** Optional, UUID (publicId), must exist in projects table
- **Contract Filter:** Optional, UUID (publicId), must exist in contracts table
- **Page Size:** Optional, integer, min=1, max=1000, default=null (process all pages)
- **Language:** Optional, enum (TH, EN, MIXED), default=MIXED

### 4. Sandbox Workflow (Hybrid Flow)

**Step 1: OCR**
```
Admin Upload PDF
  → POST /api/ai/admin/sandbox/ocr
  → BullMQ (ai-realtime) job type: "sandbox-ocr-only"
  → OcrService → Sidecar (typhoon-np-dms-ocr)
  → Raw OCR text
```

**Step 2: AI Extract**
```
Admin Select Prompt Version
  → POST /api/ai/admin/sandbox/ai-extract
  → BullMQ (ai-realtime) job type: "sandbox-ai-extract"
  → Load prompt from ai_prompts (selected version)
  → OllamaService → typhoon2.5-np-dms
  → Structured metadata (JSON)
```

**Step 3: RAG Prep (Required)**
```
Admin Click "Test RAG Prep" (required)
  → POST /api/ai/admin/sandbox/rag-prep
  → BullMQ (ai-realtime) job type: "sandbox-rag-prep"
  → OllamaService → typhoon2.5-np-dms (Semantic Chunking)
  → Sidecar → BGE-M3 (Embedding)
  → Chunks + Vectors
```

**Activate to Production:**
```
Admin Click "Activate This Version"
  → POST /api/ai/prompts/:type/:version/activate
  → Update is_active flag
  → Invalidate Redis cache
  → Production jobs use new version
```

### 5. Three Config Types Separation

**Runtime Parameters Panel (ADR-036):**
- อยู่ใน Sandbox Tab
- Sliders: Temperature, Top-P, Repeat Penalty, Max Tokens, Ctx Size, Keep-Alive
- เก็บใน `ai_execution_profiles` (global per profile)
- Apply workflow: Sandbox draft → Apply to Production
- วัตถุประสงค์: คุม AI model behavior (LLM ตอบสนองอย่างไร)

**Context Config Editor (ADR-030):**
- อยู่ใน Prompt Editor Panel
- Form: Project Filter, Contract Filter, Page Size, Language
- เก็บใน `ai_prompts` (per prompt version)
- Apply workflow: Save version → Activate version
- วัตถุประสงค์: คุม data context ที่ AI เห็น (master data อะไรบ้าง)

**System Prompt Editor (ADR-029 + ADR-036):**
- อยู่ใน Prompt Editor Panel (รวมกับ Prompt Template)
- Textarea: System instruction สำหรับ AI model (เช่น "คุณคือเอนจิ้นสกัดข้อมูล...")
- เก็บใน `ai_prompts` (per prompt version) - เป็นส่วนหนึ่งของ `template` field
- Apply workflow: Save version → Activate version
- วัตถุประสงค์: กำหนดบทบาทและโครงสร้างผลลัพธ์ของ AI

**Summary Table:**

| Config Type | Table | Per Version? | Purpose | Apply Workflow |
|-------------|-------|--------------|---------|----------------|
| Runtime Parameters | `ai_execution_profiles` | ไม่ (global) | คุม AI model behavior | Sandbox draft → Production |
| Context Config | `ai_prompts` | ใช่ | คุม data context | Save version → Activate |
| System Prompt | `ai_prompts` (template) | ใช่ | คุม AI role/instruction | Save version → Activate |

---

## ผลกระทบ (Consequences)

### ผลดี
- Admin จัดการ prompt ได้ครบทุก type (OCR, RAG, Classification)
- Sandbox ทดสอบครบ pipeline ตรงกับ production
- Context config มี UI ครบถ้วน (View/Edit/Save/Apply)
- Runtime Parameters กับ Context Config แยกชัดเจน
- Single page layout consistent กับ ADR-027

### ผลเสีย / ข้อระวัง
- UI ซับซ้อนขึ้นเล็กน้อย (ต้องจัดการ state หลาย prompt types)
- ต้องเพิ่ม backend endpoints สำหรับ context config CRUD
- ต้องเพิ่ม sandbox endpoint สำหรับ RAG Prep
- ต้อง seed data สำหรับ prompt types ใหม่

---

## Migration Plan

### Phase 1: Database
1. Run seed data สำหรับ prompt types ใหม่ (rag_query_prompt, rag_prep_prompt, classification_prompt)
2. Verify context_config column มีอยู่แล้ว (จาก ADR-030)

### Phase 2: Backend
1. เพิ่ม endpoints สำหรับ context config CRUD
2. เพิ่ม sandbox endpoint สำหรับ RAG Prep
3. Update AiPromptsService รองรับหลาย prompt types

### Phase 3: Frontend
1. สร้าง PromptTypeDropdown component
2. อัปเดต VersionHistory แยกตาม prompt_type
3. สร้าง ContextConfigEditor component
4. อัปเดต SandboxTabs เพิ่ม RAG Prep tab
5. แยก Runtime Parameters Panel ออกจาก Context Config Editor

### Phase 4: Testing
1. Unit tests สำหรับ context config CRUD
2. Integration tests สำหรับ sandbox RAG Prep
3. E2E tests สำหรับ full workflow (OCR → Extract → RAG Prep → Activate)

---

## Grilling Session Log

```
2026-06-14 — grilling session ผ่าน Devin Cascade
Q1: ปัญหาหลัก → B + C (UX ไม่ครอบคลุม + ใช้งานยาก)
Q2: UX ปัจจุบันอยู่ที่ไหน → OcrSandboxPromptManager + PromptVersionHistory
Q3: Context config คืออะไร → JSON column ใน ai_prompts (filter, pageSize, language)
Q4: Context config ใช้ที่ไหน → ทั้ง sandbox และ production
Q5: Context config เก็บที่ไหน → A (ใน ai_prompts per version)
Q6: ปัญหา UX ละเอียด → 6.1 Version ไม่แยก OCR/AI, 6.2 2-step flow ไม่เหมือ production, 6.3 Context config UI ขาด
Q7: Prompt type รองรับอะไร → D (ocr_extraction, rag_query_prompt, rag_prep_prompt, classification_prompt)
Q8: Sandbox workflow เพิ่มอะไร → A (RAG Prep step - required)
Q9: UX layout อย่างไร → A (Single Page พร้อม Dropdown + ส่งต่อผลลัพธ์)
Q10: Sandbox workflow อย่างไร → A (Required 3-step: OCR → Extract → RAG Prep)
Q11: ขัดแย้ง ADR-029 → สร้าง ADR ใหม่ supersede
Q12: ขัดแย้ง ADR-027 → ไม่ขัดแย้ง (single page ยังใช้ได้)
Q13: ขัดแย้ง ADR-036 → ไม่ขัดแย้ง (runtime vs context แยก concern)
Q14: Runtime vs Context แตกต่างอย่างไร → Runtime คุม AI, Context คุม data
Q15: ADR ชื่ออะไร → A (ADR-037: Unified Prompt Management UX/UI)
Q16: Scope อะไร → C (UX/UI + Backend API + Database)
```

---

## Related ADRs

- **ADR-029:** Dynamic Prompt Management (superseded - extends prompt_type scope)
- **ADR-027:** AI Admin Console and Dynamic Control (single page layout)
- **ADR-030:** Context-Aware Prompt Templates (context_config architecture)
- **ADR-036:** Unified AI Model Architecture (runtime parameters management)
- **ADR-035:** AI Pipeline Flow Architecture (sandbox + production flows)
