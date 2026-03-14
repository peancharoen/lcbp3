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

#### 🔍 เปรียบเทียบผลลัพธ์ที่คาดหวัง

| งาน | Typhoon2-4B | Qwen2.5-7B | OpenThaiGPT-7B |
|-----|-------------|------------|----------------|
| ความเร็ว (ток/วินาที) | ~35-45 | ~8-12 | ~10-15 |
| ความเข้าใจบริบทไทย | ดีมาก | ดี | ดีมาก |
| การสร้างแท็กแม่นยำ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| ความเสถียรบน 8GB | ✅ สูง | ⚠️ ปานกลาง | ⚠️ ปานกลาง |

```bash
# แนะนำ: llama3.2:3b (เร็ว, VRAM ~3GB, เหมาะ Classification) หรือ ollama run llama3.2:3b
ollama pull llama3.2:3b

# ทางเลือกที่ 1: เร็ว + ไทยดี (แนะนำ)
ollama pull scb10x/typhoon2.1-gemma3-4b
ollama run scb10x/typhoon2.1-gemma3-4b --system "คุณเป็นผู้ช่วยจัดหมวดหมู่เอกสารภาษาไทย โปรดตอบกลับในรูปแบบ JSON เท่านั้น" --option temperature=0.2 --option num_ctx=4096

# ทางเลือกที่ 2: คุณภาพสูง (โมเดลที่คุณใช้อยู่)
ollama pull qwen2.5:7b-instruct-q4_K_M
ollama run qwen2.5:7b-instruct-q4_K_M --system "คุณเป็นผู้ช่วยจัดหมวดหมู่เอกสารภาษาไทย โปรดตอบกลับในรูปแบบ JSON เท่านั้น" --option temperature=0.2 --option num_ctx=4096
# ถ้า Q4_K_M ยังหนักไป ลอง Q3_K_M (คุณภาพลดเล็กน้อย แต่ประหยัดแรม)
ollama pull qwen2.5:7b-instruct-q3_K_M

# ทางเลือกที่ 3: ไทยเฉพาะทาง
ollama pull promptnow/openthaigpt1.5-7b-instruct-q4_k_m
ollama run openthaigpt1.5-7b-instruct-q4_k_m --system "คุณเป็นผู้ช่วยจัดหมวดหมู่เอกสารภาษาไทย โปรดตอบกลับในรูปแบบ JSON เท่านั้น" --option temperature=0.2 --option num_ctx=4096

# เปิด terminal อีกหน้าต่างแล้วรัน
watch -n 1 nvidia-smi

# Fallback: mistral:7b-instruct-q4_K_M (แม่นกว่า, VRAM ~5GB)
# ollama pull mistral:7b-instruct-q4_K_M
```
ใช้ ทางเลือกที่ 1

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

#### Node 1: Data Reader & Checkpoint

- อ่าน Checkpoint จาก **MariaDB Node แยก** 
- Batch ทีละ **50–100 แถว** ตาม `$env.MIGRATION_BATCH_SIZE` (ควรจำกัด Batch Size ป้องกัน DB Connection Overload)
- ติด `original_index` ทุก Item และ Normalize Encoding (UTF-8 NFC) สำหรับ ชื่อไฟล์ และ เลขเอกสารเก่า

#### Node 2: DB Lookup & Data Augmentation

- **Task:** ให้ n8n นำข้อมูลจาก Excel (เช่น รหัสโปรเจ็กต์, รหัสผู้ส่ง) ยิงคำสั่ง Query ไปยัง MariaDB เพื่อแปลงเป็น `id`
- **Queries:**
  1. แปลง `project_code` -> `project_id`
  2. แปลง `sender_code` -> `sender_organization_id`
  3. แปลง `receiver_code` -> `receiver_organization_id`
  4. หา Tags ที่มีอยู่ในโปรเจ็กต์: `SELECT * FROM tags WHERE project_id = {{project_id}}`
- **Output:** n8n เก็บ `project_id`, `organization_ids` และ `existing_tags_json` ไว้ในแต่ละ item
- *ถ้าหารหัสโปรเจ็กต์ไม่เจอ ให้ส่งเข้า Error Log ไม่ทำต่อ*

#### Node 3: File Processor (Extract PDF Text & Temp Upload)

- ตรวจสอบไฟล์ PDF มีอยู่จริงบน NAS `/share/np-dms/staging_ai`
- **Extract PDF Text:** ใช้ Apache Tika สกัดข้อความจากเอกสาร
- **Two-Phase Storage (Upload):**
  - n8n ยิง `POST /api/storage/upload` ส่งไฟล์ PDF เข้า Backend
  - Backend อัพโหลดไฟล์, กำหนด `is_temporary = TRUE`
  - Backend ส่งคืน `attachment_id` ให้ n8n (จะเรียกว่า `temp_attachment_id`)

#### Node 4: AI Analysis (Sequential เท่านั้น)

**System Prompt:**
```text
You are a Document Controller for a large construction project.
Your task is to validate document metadata, summarize content, and suggest relevant tags.
You MUST respond ONLY with valid JSON. No explanation, no markdown.
```

**User Prompt:**
```text
Validate and summarize this document. Respond in JSON.
Document Number: {{$json.document_number}}
Title: {{$json.title}}
Extracted Text: {{$json.extracted_text}}

Existing Project Tags: {{$json.existing_tags_json}}

Analyze the content to provide:
1. Validation of Subject/Dates with PDF text.
2. A 4-5 sentence summary.
3. Suggest tags. Select from Existing Project Tags if applicable. If no existing tag fits, suggest a NEW one (set is_new: true).

Respond ONLY with this exact JSON structure:
{
  "is_valid": true | false,
  "confidence": 0.0 to 1.0,
  "category": "Correspondence",
  "summary": "<4-5 sentence summary>",
  "suggested_tags": [
    {"name": "Structural", "description": "...", "is_new": false}
  ],
  "detected_issues": []
}
```

#### Node 5: Staging Ingestion (Insert to Review Queue)

ข้อมูลทั้งหมดที่ผ่าน n8n และ AI Model **จะต้องไม่ถูกอัพเดทเข้าตารางหลักอัตโนมัติ** แต่จะถูกบังคับนำเข้าตาราง Staging `migration_review_queue` แทน เพื่อรอมนุษย์จัดการผ่าน Frontend UI

**Status Routing Policy:**
- `confidence >= 0.85` และ `is_valid = true` -> Status **`PENDING`** (พร้อมรับ Batch Import)
- `confidence >= 0.60` และ `< 0.85` -> Status **`PENDING`** (ติด Flag ให้ระวัง)
- `confidence < 0.60` หรือ `is_valid = false` -> Status **`REJECTED`**
- Parse Error / AI ไม่ตอบ -> **Error Log** (Node ถัดไป)

**Insert into staging:**
```sql
INSERT INTO migration_review_queue (
  document_number, title, project_id, sender_organization_id, receiver_organization_id,
  received_date, issued_date, remarks, ai_suggested_category, ai_confidence,
  ai_issues, ai_summary, extracted_tags, temp_attachment_id, status
) VALUES ( ... )
ON DUPLICATE KEY UPDATE status = VALUES(status), ai_summary = VALUES(ai_summary);
```

#### Node 6: Error Log & Reject Log

- Parse Error → เขียนลงไฟล์ `/share/np-dms/n8n/migration_logs/error_log.csv` 
- ทุก 10-50 ราบการอัพเดท MariaDB `migration_progress` เพื่อเป็น Checkpoint.

---

### Phase 4: Frontend Management & Final Commit (UI -> Backend API)

1. หน้าจอ **Frontend Management UI** ดึงข้อมูลจาก `migration_review_queue`
2. Admin สามารถ Browse & Edit ข้อมูล
3. **Tag Review:** Admin สามารถพิจารณา Tags ที่เป็น `is_new: true` ว่าควรตีตก หรือเปลี่ยนไปแมตช์ของเดิม
4. Admin กดปุ่ม **Execute Import** ส่งให้ Backend รัน Final Commit.
5. Backend ยิงคำสั่งสร้าง Correspondence, นำ `temp_attachment_id` ไปผูกกับ Revision, ปรับเป็น `is_temporary = FALSE` และสร้าง/เชื่อม Tags จริง.

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
