# 03-04: Legacy Data Migration Plan (PDF 20k Docs)

| description                                                        | version |
| ------------------------------------------------------------------ | ------- |
| legacy PDF document migration to system v1.8.0 uses n8n and Ollama | 1.8.0   |

> **Note:** Category Enum system-driven, Idempotency Contract, Duplicate Handling Clarification, Storage Enforcement, Audit Log Enhancement, Review Queue Integration, Revision Drift Protection, Execution Time, Encoding Normalization, Security Hardening, Orchestrator on QNAP, AI Physical Isolation (Desktop Desk-5439), Folder Standard (/share/np-dms/n8n), **AI Tag Extraction & Auto-Tagging**

---

## 1. วัตถุประสงค์ (Objectives)

- นำเข้าเอกสาร PDF 20,000 ฉบับ พร้อม Metadata จาก Excel (Legacy system export) เข้าสู่ระบบ LCBP3-DMS
- ใช้ AI (Ollama Local Model) เพื่อตรวจสอบความถูกต้องของลักษณะข้อมูล (Data format, Title consistency) ก่อนการนำเข้า
- **AI Tag Extraction:** ใช้ Ollama วิเคราะห์เอกสารและสกัด Tags ที่เกี่ยวข้อง (เช่น สาขางาน, ประเภทเอกสาร, องค์กร) อัตโนมัติ
- รักษาโครงสร้างความสัมพันธ์ (Project / Contract / Ref No.) และระบบการทำ Revision ตาม Business Rules
- **Checkpoint Support:** รองรับการหยุดและเริ่มงานต่อ (Resume) จากจุดที่ค้างอยู่ได้กรณีเกิดเหตุขัดข้อง

> **Note:** เอกสารนี้ขยายความถึงวิธีปฏิบัติ (Implementation) จากการตัดสินใจทางสถาปัตยกรรมใน [ADR-017: Ollama Data Migration Architecture](../06-Decision-Records/ADR-017-ollama-data-migration.md)

---

## 2. โครงสร้างพื้นฐาน (Migration Infrastructure)

- **Migration Orchestrator:** n8n (รันจาก Docker Container บน QNAP NAS)
- **AI Validator:** Ollama (รันใน Internal Network บน Desktop Desk-5439, RTX 2060 SUPER 8GB)
- **Target Database:** MariaDB (`correspondences` table) บน QNAP NAS
- **Target Storage:** QNAP File System — **ผ่าน Backend StorageService API เท่านั้น** (ห้าม move file โดยตรง)
- **Connection:** 2.5G LAN + LACP / Internal VLAN

---

## 3. ขั้นตอนการดำเนินงาน (Implementation Steps)

### Phase 1: การเตรียม Infrastructure และ Storage (สัปดาห์ที่ 1)

**File Migration:**
- ย้ายไฟล์ PDF ทั้งหมดจากแหล่งเก็บไปยัง Folder ชั่วคราวบน NAS (QNAP)
- Target Path: `/share/np-dms/staging_ai/`

**Mount Folder:**
- Bind Mount `/share/np-dms/staging_ai/` เข้ากับ n8n Container แบบ **read-only**
- สร้าง `/share/np-dms/n8n/migration_logs/` Volume แยกสำหรับเขียน Log แบบ **read-write**

**Ollama Config:**
- ติดตั้ง Ollama บน Desktop (Desk-5439, RTX 2060 SUPER 8GB)
- No DB credentials, Internal network only

```bash
# แนะนำ: llama3.2:3b (เร็ว, VRAM ~3GB, เหมาะ Classification) หรือ ollama run llama3.2:3b
ollama pull llama3.2:3b
ollama pull qwen2.5:7b-instruct-q4_K_M
# Fallback: mistral:7b-instruct-q4_K_M (แม่นกว่า, VRAM ~5GB)
# ollama pull mistral:7b-instruct-q4_K_M
```

**ทดสอบ Ollama:**
```bash
curl http://192.168.20.100:11434/api/generate \
  -d '{"model":"llama3.2:3b","prompt":"reply: ok","stream":false}'
```

**Concurrency Configuration:**
- Sequential: Batch Size = 1, Delay ≥ 2 วินาที, ปิด Parallel Execution
- เพิ่ม Health Check Node ก่อนเริ่ม Batch เพื่อป้องกัน Workflow ค้างหาก Desktop Sleep หรือ Overheat

---

### Phase 2: การเตรียม Target Database และ API (สัปดาห์ที่ 1)

**SQL Indexing:**
```sql
ALTER TABLE correspondences ADD INDEX idx_doc_number (document_number);
ALTER TABLE correspondences ADD INDEX idx_deleted_at (deleted_at);
ALTER TABLE correspondences ADD INDEX idx_created_by (created_by);
```

**Checkpoint Table:**
```sql
CREATE TABLE IF NOT EXISTS migration_progress (
    batch_id             VARCHAR(50) PRIMARY KEY,
    last_processed_index INT DEFAULT 0,
    status               ENUM('RUNNING','COMPLETED','FAILED') DEFAULT 'RUNNING',
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Tags Table (สำหรับ AI Tag Extraction):**
```sql
-- ตาราง Master เก็บ Tags (Global หรือ Project-specific)
CREATE TABLE tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NULL COMMENT 'NULL = Global Tag',
  tag_name VARCHAR(100) NOT NULL,
  color_code VARCHAR(30) DEFAULT 'default',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  deleted_at DATETIME NULL,
  UNIQUE KEY ux_tag_project (project_id, tag_name),
  INDEX idx_tags_deleted_at (deleted_at),
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL
);

-- ตารางเชื่อมระหว่าง correspondences และ tags (M:N)
CREATE TABLE correspondence_tags (
  correspondence_id INT,
  tag_id INT,
  PRIMARY KEY (correspondence_id, tag_id),
  FOREIGN KEY (correspondence_id) REFERENCES correspondences (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
  INDEX idx_tag_lookup (tag_id)
);
```

**Idempotency Table :**
```sql
CREATE TABLE IF NOT EXISTS import_transactions (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    idempotency_key  VARCHAR(255) UNIQUE NOT NULL,
    document_number  VARCHAR(100),
    batch_id         VARCHAR(100),
    status_code      INT DEFAULT 201,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_idem_key (idempotency_key)
);
```

> **Idempotency Logic:** ถ้า `idempotency_key` ซ้ำ → Backend คืน HTTP 200 ทันที (ไม่สร้าง Revision ซ้ำ) ถ้าไม่ซ้ำ → ประมวลผลปกติ

**API Authentication — Migration Token:**
```sql
INSERT INTO users (username, email, role, is_active)
VALUES ('migration_bot', 'migration@system.internal', 'SYSTEM_ADMIN', true);
```

**Scope ของ Migration Token (Patch — คำนิยามชัดเจน):**

| สิทธิ์                                   | ปกติ | Migration Token | หมายเหตุ                           |
| ------------------------------------- | --- | --------------- | --------------------------------- |
| Bypass File Virus Scan                | ❌   | ✅               | ไฟล์ผ่าน Scan มาแล้วก่อน Import       |
| Bypass Duplicate **Validation Error** | ❌   | ✅               | **Revision Logic ยัง enforce ปกติ** |
| Bypass Created-by User validation     | ❌   | ✅               |                                   |
| Overwrite existing revision           | ❌   | ❌               | **ห้ามโดยเด็ดขาด**                  |
| Delete previous revision              | ❌   | ❌               | **ห้ามโดยเด็ดขาด**                  |
| ลบ / แก้ไข Record อื่น                   | ❌   | ❌               | **ห้ามโดยเด็ดขาด**                  |

> ⚠️ **Patch Clarification:** "Bypass Duplicate Number Check" ถูกแทนด้วย "Bypass Duplicate **Validation Error**" — Revision increment logic ยังทำงานตามปกติทุกกรณี

- **Token Expiry:** ไม่เกิน **7 วัน** ต้อง Revoke ทันทีหลัง Migration เสร็จ
- **IP Whitelist:** ใช้ได้เฉพาะจาก `<NAS_IP>` เท่านั้น
- **Audit:** ทุก Request บันทึก `created_by = 'SYSTEM_IMPORT'`

---

### Phase 3: การออกแบบ n8n Workflow (The Migration Logic)

#### Node 0: Pre-flight Health Check + Fetch System Categories

ตรวจสอบทุก dependency ก่อน Batch:

1. HTTP GET Ollama `/api/tags` → ต้อง HTTP 200
2. MariaDB `SELECT 1` → ต้องเชื่อมได้
3. HTTP GET Backend `/health` → ต้อง HTTP 200
4. File Mount Check → `staging_ai` มีไฟล์, `migration_logs` เขียนได้

**Fetch System Categories (Patch — ห้าม hardcode):**
```http
GET /api/meta/categories
Authorization: Bearer <MIGRATION_TOKEN>
```
Response:
```json
{ "categories": ["Correspondence","RFA","Drawing","Transmittal","Report","Other"] }
```
n8n ต้องเก็บ categories นี้ไว้ใน Workflow Variable (`system_categories`) และ inject เข้า AI Prompt ทุก Request

#### Node 1: Data Reader & Checkpoint

- อ่าน Checkpoint จาก **MariaDB Node แยก** (ไม่ใช่ async call ใน Code Node)
- Batch ทีละ **10–20 แถว** ตาม `$env.MIGRATION_BATCH_SIZE`
- ติด `original_index` ทุก Item

**Encoding Normalization:**
```javascript
// Normalize ข้อมูลจาก Excel เป็น UTF-8 NFC ก่อนประมวลผล
const normalize = (str) => {
  if (!str) return '';
  return Buffer.from(str, 'utf8').toString('utf8').normalize('NFC');
};

return items.map(item => ({
  ...item,
  json: {
    ...item.json,
    document_number: normalize(item.json.document_number),
    title: normalize(item.json.title),
    // Mapping เลขอ้างอิงเก่า (Legacy Number) เพื่อนำไปเก็บใน details JSON
    legacy_document_number: item.json.document_number
  }
}));
```

#### Node 2: File Validator & Sanitizer

- ตรวจสอบไฟล์ PDF มีอยู่จริงบน NAS
- Normalize ชื่อไฟล์เป็น **UTF-8 NFC**
- Path Traversal Guard: resolved path ต้องอยู่ใน `/share/np-dms/staging_ai` เท่านั้น
- **Output 0** → valid → Node 3
- **Output 1** → error → Node 5D (ไม่หายเงียบ)

#### Node 3: AI Analysis (Sequential เท่านั้น)

**System Prompt:**
```text
You are a Document Controller for a large construction project.
Your task is to validate document metadata and suggest relevant tags.
You MUST respond ONLY with valid JSON. No explanation, no markdown, no extra text.
If there are no issues, "detected_issues" must be an empty array [].
```

**User Prompt (Category List มาจาก Backend ไม่ hardcode):**
```text
Validate this document metadata and respond in JSON:

Document Number: {{$json.document_number}}
Title: {{$json.title}}
Expected Pattern: [ORG]-[TYPE]-[SEQ] e.g. "TCC-COR-0001"
Category List (MUST match system enum exactly): {{$workflow.variables.system_categories}}

Analyze the document and suggest relevant tags based on:
1. Document content/title keywords (e.g., "Foundation", "Structure", "Electrical", "Safety")
2. Document type indicators (e.g., "Drawing", "Report", "Inspection")
3. Organization codes present in document number
4. Any discipline or phase indicators

Respond ONLY with this exact JSON structure:
{
  "is_valid": true | false,
  "confidence": 0.0 to 1.0,
  "suggested_category": "<one from Category List>",
  "detected_issues": ["<issue1>"],
  "suggested_title": "<corrected title or null>",
  "suggested_tags": ["<tag1>", "<tag2>"],
  "tag_confidence": 0.0 to 1.0
}
```

**JSON Validation (ตรวจ Category ตรง Enum + Tag Normalization):**
```javascript
const systemCategories = $workflow.variables.system_categories;
if (!systemCategories.includes(result.suggested_category)) {
  throw new Error(`Category "${result.suggested_category}" not in system enum: ${systemCategories.join(', ')}`);
}

// Tag Validation
if (!Array.isArray(result.suggested_tags)) {
  result.suggested_tags = [];
}
// Normalize: trim, lowercase, remove duplicates
result.suggested_tags = [...new Set(result.suggested_tags.map(t => String(t).trim()).filter(t => t.length > 0))];

// Tag confidence validation
if (typeof result.tag_confidence !== 'number' || result.tag_confidence < 0 || result.tag_confidence > 1) {
  result.tag_confidence = 0.5;
}
```

#### Node 3.5: Fallback Model Manager

- อัปเดต `migration_fallback_state` ทุกครั้งที่เกิด Parse Error
- Auto-switch ไป `OLLAMA_MODEL_FALLBACK` เมื่อ Error ≥ `FALLBACK_ERROR_THRESHOLD`
- ส่ง Alert Email เมื่อ Fallback ถูก Activate

#### Node 4: Confidence Router (4 outputs)

| เงื่อนไข                                     | การดำเนินการ                       |
| ------------------------------------------ | -------------------------------- |
| `confidence >= 0.85` และ `is_valid = true` | **Output 0** → Auto Ingest       |
| `confidence >= 0.60` และ `< 0.85`          | **Output 1** → Review Queue      |
| `confidence < 0.60` หรือ `is_valid = false` | **Output 2** → Reject Log        |
| Parse Error / AI ไม่ตอบ                     | **Output 3** → Error Log         |
| Fallback: Error > 5 ใน 10 Request          | สลับ Model / หยุด Workflow + Alert |

**Revision Drift Protection:**
```javascript
// ถ้า Excel มี revision column — ตรวจสอบก่อน route
if (item.json.excel_revision !== undefined) {
  const expectedRevision = (item.json.current_db_revision || 0) + 1;
  if (parseInt(item.json.excel_revision) !== expectedRevision) {
    item.json.review_reason = `Revision drift: Excel=${item.json.excel_revision}, Expected=${expectedRevision}`;
    reviewQueue.push(item);
    continue;
  }
}
```

#### Node 5A: Auto Ingest — Backend API

> ⚠️ **Storage Enforcement:** n8n ส่งแค่ `source_file_path` — Backend จะ generate UUID, enforce path strategy (`/share/np-dms/staging_ai/...`), และ move file atomically ผ่าน StorageService

```http
POST /api/correspondences/import
Authorization: Bearer <MIGRATION_TOKEN>
Idempotency-Key: <document_number>:<batch_id>
Content-Type: application/json
```

**Backend Tag Handling Logic:**

เมื่อ Backend รับ Payload พร้อม `ai_tags` ระบบจะ:

1. **Validate Tags:** ตรวจสอบว่า tag name อยู่ในรูปแบบที่ถูกต้อง (ไม่ว่าง, ไม่มีอักขระพิเศษ)
2. **Create Missing Tags:** ถ้า Tag ไม่มีอยู่ใน `tags` table → สร้างใหม่โดยอัตโนมัติ
   ```sql
   INSERT INTO tags (tag_name, created_by, created_at)
   VALUES ('<tag_name>', (SELECT user_id FROM users WHERE username = 'migration_bot'), NOW())
   ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id);
   ```
3. **Link Document Tags:** บันทึกความสัมพันธ์ใน `correspondence_tags`
   ```sql
   INSERT INTO correspondence_tags (correspondence_id, tag_id)
   SELECT LAST_INSERT_ID(), tag_id FROM tags WHERE tag_name IN (<ai_tags>);
   ```
4. **Tag Confidence Logging:** บันทึก `tag_confidence` ลงใน `details` JSON ของ Revision

Payload:
```json
{
  "document_number":   "{{document_number}}",
  "title":             "{{ai_result.suggested_title || title}}",
  "category":          "{{ai_result.suggested_category}}",
  "source_file_path":  "{{file_path}}",
  "ai_confidence":     "{{ai_result.confidence}}",
  "ai_issues":         "{{ai_result.detected_issues}}",
  "ai_tags":           "{{ai_result.suggested_tags}}",
  "tag_confidence":    "{{ai_result.tag_confidence}}",
  "migrated_by":       "SYSTEM_IMPORT",
  "batch_id":          "{{$env.MIGRATION_BATCH_ID}}"
}
```

**Audit Log ที่ Backend ต้องสร้าง:**
```json
{
  "action":     "IMPORT",
  "source":     "MIGRATION",
  "batch_id":   "migration_20260226",
  "created_by": "SYSTEM_IMPORT",
  "metadata": {
    "migration":     true,
    "batch_id":      "migration_20260226",
    "ai_confidence": 0.91
  }
}
```

**Checkpoint Update (ทุก 10 Records — ผ่าน IF Node + MariaDB Node):**
```sql
INSERT INTO migration_progress (batch_id, last_processed_index, status)
VALUES ('{{$env.MIGRATION_BATCH_ID}}', {{checkpoint_index}}, 'RUNNING')
ON DUPLICATE KEY UPDATE
  last_processed_index = {{checkpoint_index}},
  updated_at = NOW();
```

#### Node 5B: Review Queue

> ⚠️ **`migration_review_queue` เป็น Temporary Table เท่านั้น** — ห้ามสร้าง Correspondence record จนกว่า Admin จะ Approve

Approval Flow:
```
Review → Admin Approve → POST /api/correspondences/import (เหมือน Auto Ingest)
Admin Reject → ลบออกจาก queue ไม่สร้าง record
```

#### Node 5C: Reject Log → `/share/np-dms/n8n/migration_logs/reject_log.csv`

#### Node 5D: Error Log → `/share/np-dms/n8n/migration_logs/error_log.csv` + MariaDB

---

### Phase 4: แผนการทดสอบ (Testing & QA)

**Dry Run Policy (Mandatory):**
- All migrations MUST run with `--dry-run`
- No DB commit until validation approved

**Dry Run Validation (20–50 แถว):**
- JSON Parse Success Rate > 95%
- Category ที่ AI ตอบตรงกับ System Enum ทุกรายการ
- รัน Batch เดิมซ้ำ 2 รอบ → ต้องไม่สร้าง Duplicate หรือ Revision ซ้ำ (Idempotency Test)
- Storage Path ตรงตาม Core Storage Spec v1.8.0
- Revision Drift ถูก route ไป Review Queue

**Integrity Check:**
```sql
-- ตรวจยอด
SELECT COUNT(*) FROM correspondences WHERE created_by = 'SYSTEM_IMPORT';

-- ตรวจ Revision ซ้ำ
SELECT document_number, COUNT(*) as cnt
FROM correspondences WHERE created_by = 'SYSTEM_IMPORT'
GROUP BY document_number HAVING cnt > 1;

-- ตรวจ Idempotency Key ไม่ซ้ำ
SELECT idempotency_key, COUNT(*) as cnt
FROM import_transactions GROUP BY idempotency_key HAVING cnt > 1;

-- ตรวจ Audit Log ครบ
SELECT COUNT(*) FROM audit_logs
WHERE created_by = 'SYSTEM_IMPORT' AND action = 'IMPORT';
```

---

### Phase 5: การรันงานจริง (Execution & Monitoring)

- **Scheduling:** รันอัตโนมัติ 22:00–06:00
- **Expected Runtime:** ~3 วินาที/record (2 sec delay + ~1 sec inference) → 20,000 records ≈ **60,000 วินาที (~16.6 ชั่วโมง)** → ใช้เวลาประมาณ **3–4 คืน**
- **Daily Check:** Admin ตรวจ Review Queue และ Reject Log ทุกเช้าจาก Night Summary Email
- **Progress Tracking:** อัปเดต `migration_progress` ทุก 10 Records

---

## 4. Rollback Plan

**Step 1:** หยุด n8n และ Disable Token
```sql
UPDATE users SET is_active = false WHERE username = 'migration_bot';
```

**Step 2:** ลบ Records (Transaction)
```sql
START TRANSACTION;
DELETE FROM correspondence_files
WHERE correspondence_id IN (SELECT id FROM correspondences WHERE created_by = 'SYSTEM_IMPORT');
DELETE FROM correspondences WHERE created_by = 'SYSTEM_IMPORT';
DELETE FROM import_transactions WHERE batch_id = 'migration_20260226';
SELECT ROW_COUNT();
COMMIT;
```

**Step 3:** ย้ายไฟล์กลับ `/share/np-dms/staging_ai/` ผ่าน Script แยก

**Step 4:** Reset State
```sql
UPDATE migration_progress
SET status = 'FAILED', last_processed_index = 0
WHERE batch_id = 'migration_20260226';

UPDATE migration_fallback_state
SET recent_error_count = 0, is_fallback_active = FALSE
WHERE batch_id = 'migration_20260226';
```

---

## 5. แผนรับมือความเสี่ยง (Risk Management)

| ลำดับที่ | ความเสี่ยง                   | การจัดการ (Mitigation)                              |
| ---- | -------------------------- | -------------------------------------------------- |
| 1    | AI Node หรือ GPU ค้าง        | Timeout 30 วินาที, Retry 3 รอบ, Delay 60 วินาที        |
| 2    | Ollama ตอบไม่ใช่ JSON        | JSON Pre-processor + ส่ง Human Review Queue         |
| 3    | Category ไม่ตรง System Enum | Fetch `/api/meta/categories` ก่อน Batch ทุกครั้ง       |
| 4    | Idempotency ซ้ำ              | `import_transactions` table + Backend คืน HTTP 200  |
| 5    | Revision Drift             | ตรวจ Excel revision column → Route ไป Review Queue |
| 6    | Storage bypass             | ห้าม move file โดยตรง — ผ่าน Backend API เท่านั้น       |
| 7    | GPU VRAM Overflow          | ใช้เฉพาะ Quantized Model (q4_K_M)                   |
| 8    | ดิสก์ NAS เต็ม                | ปิด "Save Successful Executions" ใน n8n             |
| 9    | Migration Token ถูกขโมย     | Token 7 วัน, IP Whitelist `<NAS_IP>` เท่านั้น          |
| 11   | AI Tag Extraction ผิดพลาด | Tag confidence < 0.6 → ส่งไป Review Queue / บันทึกใน metadata |
| 12   | Tag ซ้ำ/คล้ายกัน        | Normalization ก่อนบันทึก (lowercase, trim, deduplicate) |

---

## 6. Post-Migration Verification

```sql
-- 1. ตรวจยอดครบ 20,000
SELECT COUNT(*) FROM correspondences WHERE created_by = 'SYSTEM_IMPORT';

-- 2. ตรวจ Revision ผิดปกติ
SELECT document_number, COUNT(*) FROM correspondences
WHERE created_by = 'SYSTEM_IMPORT'
GROUP BY document_number HAVING COUNT(*) > 5;

-- 3. ตรวจ Audit Log ครบ
SELECT COUNT(*) FROM audit_logs
WHERE created_by = 'SYSTEM_IMPORT' AND action = 'IMPORT';

-- 4. ตรวจ Idempotency ไม่มีซ้ำ
SELECT idempotency_key, COUNT(*) FROM import_transactions
GROUP BY idempotency_key HAVING COUNT(*) > 1;

-- 5. ตรวจ Tags ที่สร้างจาก Migration
SELECT COUNT(*) as total_tags FROM tags WHERE created_by = (SELECT user_id FROM users WHERE username = 'migration_bot');

-- 6. ตรวจเอกสารที่มี Tag ผูกอยู่
SELECT COUNT(DISTINCT correspondence_id) as docs_with_tags
FROM correspondence_tags ct
JOIN correspondences c ON ct.correspondence_id = c.id
WHERE c.created_by = (SELECT user_id FROM users WHERE username = 'migration_bot');

-- 7. ตรวจ Tag Distribution
SELECT t.tag_name, COUNT(ct.correspondence_id) as doc_count
FROM tags t
JOIN correspondence_tags ct ON t.id = ct.tag_id
JOIN correspondences c ON ct.correspondence_id = c.id
WHERE c.created_by = (SELECT user_id FROM users WHERE username = 'migration_bot')
GROUP BY t.id, t.tag_name
ORDER BY doc_count DESC
LIMIT 20;
```

---

> **ข้อแนะนำด้าน Physical Storage:** ไฟล์ PDF ทั้ง 20,000 ไฟล์จะถูก move โดย Backend StorageService ไปยัง path ที่ถูกต้องโดยอัตโนมัติ ไม่ปล่อยค้างไว้ที่ `/share/np-dms/staging_ai/`
