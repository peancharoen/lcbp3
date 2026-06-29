# CONTEXT: N8N Workflow Refactor

> **Version:** 1.0.0 | **Last Updated:** 2026-05-23
> **Status:** APPROVED — Ready for Implementation
> **Related:** `03-05-n8n-migration-setup-guide.md`, `ADR-023A`, `ADR-028`

---

## 1. ขอบเขต (Scope)

n8n มีหน้าที่เดียว: **Migration Legacy Documents เท่านั้น**

| Use Case | Pipeline | ผ่าน n8n? |
|---|---|---|
| Migrate Legacy Documents (Excel + PDF) | **Pipeline A** | ✅ ใช่ |
| New Correspondence จาก Frontend | **Pipeline B** | ❌ ไม่ใช่ — Backend/BullMQ เท่านั้น |

---

## 2. Pipeline A — Migration Legacy Documents (n8n)

### 2.1 ภาพรวม Flow

```
n8n (Form Trigger)
  │
  ├─► Set Configuration (BATCH_ID, BACKEND_URL, MIGRATION_TOKEN, paths)
  │
  ├─► Pre-flight Checks
  │     ├─ GET /api/auth/me         (validate token)
  │     ├─ GET /health              (backend health)
  │     ├─ File Mount Check         (Excel + PDF dir exists)
  │     └─ Fetch Master Data        (categories, tags, projects, orgs)
  │
  ├─► Read Excel → Batch (BATCH_SIZE records)
  │     └─ Resume from Checkpoint (migration_progress table)
  │
  ├─► [Per Record Loop]
  │     │
  │     ├─► File Validator (PDF exists on disk)
  │     │
  │     ├─► POST /api/storage/upload
  │     │     → temp_attachment_id
  │     │
  │     ├─► POST /api/ai/jobs
  │     │     type: "migrate-document"
  │     │     payload: {
  │     │       tempAttachmentId,
  │     │       documentNumber,    ← จาก Excel
  │     │       title,             ← จาก Excel
  │     │       batchId,
  │     │       existingTags[],    ← จาก master data fetch
  │     │       systemCategories[] ← จาก master data fetch
  │     │     }
  │     │     Idempotency-Key: "{batchId}:{documentNumber}"
  │     │     → { jobId }
  │     │
  │     ├─► GET /api/ai/jobs/{jobId}
  │     │     Poll ทุก 5 วินาที (timeout 120 วินาที)
  │     │     รอ status = "completed"
  │     │
  │     ├─► Parse & Validate AI Response
  │     │
  │     ├─► Confidence Router (4 สาย)
  │     │     ├─ ≥ 0.85 + is_valid   → PENDING (Auto Ready)    → migration_review_queue
  │     │     ├─ 0.60–0.84           → PENDING (Flagged)        → migration_review_queue
  │     │     ├─ < 0.60 / is_valid=F → REJECTED                 → migration_review_queue
  │     │     └─ Parse Error         → Error Log (CSV + DB)
  │     │
  │     └─► Checkpoint (ทุก 10 records)
  │
  └─► [Loop: Delay → Read Checkpoint → Next Batch → ...]
        Exit condition: ไม่มี records เหลือ (allItems.length === 0)
```

### 2.2 Excel Metadata ที่ส่งไปพร้อม AI Job

Excel metadata ส่งไปเป็น **context** ให้ AI — AI ยังคงทำ OCR จาก PDF ด้วย:

| Excel Column | DTO Field | หมายเหตุ |
|---|---|---|
| `document_number` | `documentNumber` | Required — Idempotency Key |
| `title` / `Subject` | `title` | Pre-fill subject suggestion |
| `Batch Size` / `batch_id` | `batchId` | Idempotency grouping |
| existing tags (from DB) | `existingTags[]` | AI match ก่อนสร้างใหม่ |
| categories (from API) | `systemCategories[]` | Constrain AI classification |

> **หมายเหตุ:** `sender`, `receiver`, `issued_date` จาก Excel ใช้เป็น context ใน Backend prompt — Backend รับผิดชอบ prompt construction (ไม่ใช่ n8n)

### 2.3 AI Job Endpoint (ที่มีอยู่แล้วใน Backend)

```
POST /api/ai/jobs
  Authorization: Bearer {MIGRATION_TOKEN}
  Idempotency-Key: {batchId}:{documentNumber}
  Body: SubmitAiJobDto {
    type: "migrate-document",
    payload: MigrateDocumentPayloadDto
  }
  → HTTP 202 Accepted: { jobId: string }

GET /api/ai/jobs/{jobId}
  → { status: "completed" | "processing" | "failed", result: {...} }
```

> ✅ **Endpoint นี้มีอยู่แล้วใน Backend** — ไม่ต้องสร้างใหม่ (verified 2026-05-23)

### 2.4 สิ่งที่ n8n ไม่ทำ (ADR-023A)

- ❌ ไม่ call Ollama โดยตรง (`/api/generate`)
- ❌ ไม่ call Qdrant โดยตรง
- ❌ ไม่ทำ OCR เอง — Backend BullMQ Worker รับผิดชอบ
- ❌ ไม่ INSERT ตรงลง `correspondences` table — ต้องผ่าน Human Review

### 2.5 Human Review Flow (หลัง n8n เสร็จ)

```
migration_review_queue (PENDING)
        │
        ▼
SUPERADMIN/ADMIN เปิด Frontend Review UI
        │
        ▼
Review → Approve / Edit / Reject
        │
        ▼ (Approve)
POST /api/migration/review/{id}/commit
        │
        ▼
Backend INSERT → correspondences table
        │
        ▼
Auto-trigger: RAG embed (parallel, BullMQ ai-batch)
```

---

## 3. Pipeline B — New Correspondence (Frontend/Backend เท่านั้น)

### 3.1 ภาพรวม Flow

```
User อัพโหลด PDF ใน Frontend
        │
        ▼
POST /api/storage/upload → temp_attachment_id
        │
        ▼
Backend BullMQ ai-realtime
  → OCR (PyMuPDF / PaddleOCR)
  → AI Metadata Extraction (gemma4:e4b Q8_0)
  → Tag Suggestion (Existing + New)
        │
        ▼
Frontend แสดง AI Suggestions (editable form)
  - subject           (แก้ไขได้)
  - category          (แก้ไขได้)
  - discipline        (แก้ไขได้)
  - tags[]            (แก้ไขได้ — เพิ่ม/ลบ/เปลี่ยน)
  - confidence score  (แสดงเท่านั้น)
        │
        ▼
User review & approve (กด Submit)
        │
        ▼
POST /api/correspondences (พร้อม temp_attachment_id + metadata)
        │
        ▼
Backend commit → correspondences table
Auto-trigger: RAG embed (parallel)
```

### 3.2 AI Tag Suggestion — ทาง C

AI แนะนำ Tags แบบ 2 ชั้น:

```typescript
interface TagSuggestion {
  tagName: string;
  colorCode?: string;
  isNew: boolean;        // true = tag ใหม่ที่ AI แนะนำ, false = existing tag
  publicId?: string;     // มีเฉพาะ isNew = false (ADR-019)
  confidence: number;
}
```

| `isNew` | หมายความว่า | UI แสดง |
|---|---|---|
| `false` | match กับ existing tag ในโปรเจกต์ | chip สีตาม tag |
| `true` | AI แนะนำ tag ใหม่ที่ไม่มีในระบบ | chip สี default + icon "new" |

User สามารถ:
- ✅ Accept existing tag suggestion
- ✅ Accept new tag suggestion (สร้างใหม่เมื่อ commit)
- ✅ Remove tag ที่ AI แนะนำ
- ✅ Add tag เองแบบ manual

---

## 4. สิ่งที่ต้องอัพเดตใน Backend (ถ้าต้องการ Pipeline B สมบูรณ์)

| Component | สถานะ | หมายเหตุ |
|---|---|---|
| `POST /api/ai/jobs` (type: migrate-document) | ✅ พร้อม | verified |
| `GET /api/ai/jobs/{jobId}` polling | ✅ พร้อม | verified |
| `POST /api/storage/upload` | ✅ พร้อม | two-phase upload |
| AI Tag Suggestion ใน ai-realtime response | ⚠️ ตรวจสอบ | ต้อง return `suggestedTags[]` พร้อม `isNew` flag |
| Frontend Editable Review Form | ⚠️ ตรวจสอบ | pre-fill + tag suggestion UI |

---

## 5. Decisions Log (จาก QuizMe Session 2026-05-23)

| # | คำถาม | คำตอบ |
|---|---|---|
| S1 | n8n รองรับ 2 mode? | ไม่ — n8n = Migration เท่านั้น |
| S2 | New Correspondence ผ่าน n8n? | ไม่ — Backend BullMQ เท่านั้น |
| S3 | n8n call Ollama ตรง? | ไม่ — เปลี่ยนเป็น Backend API (`POST /api/ai/jobs`) |
| S4 | Loop exit condition? | ออกจาก scope (migration only) |
| S5 | Admin monitoring? | ออกจาก scope |
| PA | Excel metadata ส่งไปกับ AI job? | ✅ ใช่ — เป็น context ให้ AI |
| PB-tags | Tag suggestion mode? | ทาง C — existing match + สร้างใหม่ได้ |
| PB-UX | User approve form? | Editable — แก้ไข AI suggestions ได้ก่อน submit |
