# 📋 คู่มือการตั้งค่า n8n สำหรับ Legacy Data Migration (Free Plan Edition)

> **สำหรับ n8n Free Plan (Self-hosted)** - ไม่ใช้ Environment Variables
> **Version:** 1.8.0-free | **Last Updated:** 2026-03-04

เอกสารนี้จัดทำขึ้นเพื่อรองรับการ Migration เอกสาร PDF 20,000 ฉบับ ตามแผนใน `03-04-legacy-data-migration.md` และ `ADR-017-ollama-data-migration.md`

---

## ⚠️ ความแตกต่างจากเวอร์ชัน Enterprise

| ฟีเจอร์                 | Enterprise              | Free Plan (นี้)                  |
| --------------------- | ----------------------- | ------------------------------ |
| Environment Variables | ✅ ใช้ `$env`             | ❌ ใช้ `Set Node` + `staticData` |
| External Secrets      | ✅ Vault/Secrets Manager | ❌ Hardcode ใน Set Node         |
| Multiple Workflows    | ✅ Unlimited             | ⚠️ รวมเป็น Workflow เดียว         |
| Error Handling        | ✅ Advanced              | ⚠️ Manual Retry                 |
| Webhook Triggers      | ✅                       | ✅ ใช้ได้                         |

---

## 🏗️ สถาปัตยกรรม Free Plan

```
┌─────────────────────────────────────────────────────────────┐
│              MIGRATION WORKFLOW v1.8.0-FREE                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Schedule Trigger 22:00]                                    │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────┐    ค่า Config ทั้งหมดอยู่ที่นี่              │
│  │ Set Config  │    (แก้ไขใน Code Node นี้เท่านั้น)           │
│  │  (Node 0)   │                                             │
│  └──────┬──────┘                                             │
│         │                                                    │
│  ┌──────▼──────┐    ┌──────────────┐    ┌──────────────┐   │
│  │Pre-flight   │───▶│DB Lookup &   │──▶│File Upload &  │   │
│  │Checks       │    │Data Fetch    │    │Temp Storage  │   │
│  └─────────────┘    └──────────────┘    └──────┬───────┘   │
│                                                 │           │
│                    ┌────────────────────────────┤           │
│                    │                            │           │
│              Valid │                      Error │           │
│                    ▼                            ▼           │
│         ┌─────────────────┐          ┌─────────────────┐   │
│         │  AI Analysis    │          │  Error Logger   │   │
│         │  (Ollama)       │          │  (CSV + DB)     │   │
│         └────────┬────────┘          └─────────────────┘   │
│                  │                                           │
│         ┌────────▼────────┐                                 │
│         │ Confidence      │                                 │
│         │ Router          │                                 │
│         │ (4 outputs)     │                                 │
│         └────┬───┬───┬────┘                                 │
│              │   │   │                                      │
│    ┌─────────┘   │   └─────────┐                           │
│    ▼             ▼             ▼                           │
│ ┌──────┐   ┌──────────┐   ┌────────┐                      │
│ │Review│   │ Review   │   │Reject  │                      │
│ │Queue │   │ Queue    │   │Log     │                      │
│ │(AUTO)│   │(FLAGGED) │   │(CSV)   │                      │
│ └──────┘   └──────────┘   └────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📌 ส่วนที่ 1: การติดตั้ง

### 1.1 Docker Compose สำหรับ QNAP

ดู Config จริงที่ใช้งาน: `specs/04-Infrastructure-OPS/04-00-docker-compose/docker-compose-lcbp3-n8n.yml`

**สิ่งสำคัญ:**

| Item         | ค่า Production                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Image        | `n8nio/n8n:latest`                                                                              |
| Container    | `n8n`                                                                                           |
| Database     | PostgreSQL 16 (`n8n-db` service)                                                                |
| Network      | `lcbp3` (external)                                                                              |
| File Access  | `N8N_RESTRICT_FILE_ACCESS_TO: /home/node/.n8n-files`                                            |
| Staging (RO) | Host: `/share/np-dms-as/Legacy` → Container: `/home/node/.n8n-files/staging_ai:ro`              |
| Logs (RW)    | Host: `/share/np-dms/n8n/migration_logs` → Container: `/home/node/.n8n-files/migration_logs:rw` |
| Memory Limit | 2GB (reservation 512M)                                                                          |
| Healthcheck  | `wget healthz` (30s interval)                                                                   |

> ⚠️ **Volume:** Staging mount = **read-only** (อ่านไฟล์ PDF ต้นฉบับ) — ห้ามเขียน CSV ลง `staging_ai` เพราะจะ Error ทันที

> ⚠️ **File Access Control:** n8n จำกัดสิทธิ์อ่านไฟล์เฉพาะ `/home/node/.n8n-files` — workflow ต้องใช้ path นี้เท่านั้น

### 1.2 Nginx Rate Limit

```nginx
# nginx.conf หรือ site config
limit_req_zone $binary_remote_addr zone=migration:10m rate=1r/s;

location /api/migration/import {
    limit_req zone=migration burst=5 nodelay;
    proxy_pass http://backend:3001;
}
```

---

## 📌 ส่วนที่ 2: การตั้งค่า Configuration (สำคัญมาก)

### ขั้นตอนที่ 1: แก้ไข Node "Set Configuration"

**เปิด Workflow → คลิก Node "Set Configuration" → แก้ไข Code:**

```javascript
// ============================================
// CONFIGURATION - แก้ไขค่าที่นี่เท่านั้น
// ============================================
const CONFIG = {
  // 🔴 สำคัญ: เปลี่ยนทุกค่าที่มี <...>

  // Ollama Settings
  OLLAMA_HOST: 'http://192.168.20.100:11434',
  OLLAMA_MODEL_PRIMARY: 'llama3.2:3b',
  OLLAMA_MODEL_FALLBACK: 'mistral:7b-instruct-q4_K_M',

  // Backend Settings
  BACKEND_URL: 'https://backend.np-dms.work',
  MIGRATION_TOKEN: 'Bearer YOUR_MIGRATION_TOKEN_HERE', // 🔴 เปลี่ยน

  // Batch Settings
  BATCH_SIZE: 10,
  BATCH_ID: 'migration_20260226',
  DELAY_MS: 2000,

  // Thresholds
  CONFIDENCE_HIGH: 0.85,
  CONFIDENCE_LOW: 0.60,
  MAX_RETRY: 3,
  FALLBACK_THRESHOLD: 5,

  // Paths (Container paths — ต้องตรงกับ volume mount ใน docker-compose)
  STAGING_PATH: '/home/node/.n8n-files/staging_ai',
  LOG_PATH: '/home/node/.n8n-files/migration_logs',

  // Database (MariaDB)
  DB_HOST: '192.168.1.100',
  DB_PORT: 3306,
  DB_NAME: 'lcbp3_production',
  DB_USER: 'migration_bot',
  DB_PASSWORD: 'YOUR_DB_PASSWORD_HERE' // 🔴 เปลี่ยน
};

// อย่าแก้โค้ดด้านล่างนี้
$workflow.staticData = $workflow.staticData || {};
$workflow.staticData.config = CONFIG;

return [{ json: { config_loaded: true, timestamp: new Date().toISOString() }}];
```

### ขั้นตอนที่ 2: ตั้งค่า Credentials ใน n8n UI

เนื่องจาก Free Plan ไม่สามารถซ่อน Sensitive Data ได้ทั้งหมด แนะนำให้:

1. **สร้าง Dedicated User สำหรับ Migration เท่านั้น** (แนะนำใช้ชื่อ `migration_bot`)
2. **ใช้ Token ที่มีสิทธิ์จำกัด** (เฉพาะ API ที่จำเป็น)
3. **Rotate Token ทันทีหลัง Migration เสร็จ**
4. **💡 หมายเหตุ:** Backend ระบบ DMS ได้ถูกตั้งค่าให้สร้าง Token แบบไม่มีวันหมดอายุ (100 ปี) สำหรับ User ชื่อ `migration_bot` โดยเฉพาะ เพื่อป้องกันปัญหา Token หมดอายุระหว่างที่ Workflow กำลังทำงานข้ามวัน


**Credentials (ถ้าใช้):**

| Credential | Type | ใช้ใน Node |
| ---------- | ---- | --------- ||
| Ollama API | HTTP Request | Ollama AI Analysis |
| LCBP3 Backend | HTTP Request | Import to Backend, Fetch Categories |
| MariaDB | MySQL | ทุก Database Node |


### ขั้นตอนที่ 3: วิธีการรับ MIGRATION_TOKEN

เนื่องจากหน้าเว็บ DMS ใช้ระบบ Session Cookies (Auth.js) จึงไม่สามารถคัดลอก JWT Token จาก Network Tab ในเบราว์เซอร์ได้โดยตรง

ให้ใช้วิธี **เรียก API ตรงไปที่ Backend** ด้วยเครื่องมืออย่าง Postman, cURL หรือ Thunder Client แทน:

**ตัวอย่างคำสั่ง cURL:**
```bash
curl -X POST https://api.np-dms.work/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"migration_bot","password":"YOUR_PASSWORD"}'
```

**การนำไปใช้งาน:**
1. เปลี่ยน URL ให้ตรงกับ Backend ของคุณ (เช่น `http://localhost:3001/api/auth/login` สำหรับ Local)
2. นำรหัสผ่านของบัญชี `migration_bot` มาใส่แทนที่ `YOUR_PASSWORD`
3. ในผลลัพธ์ที่ได้ ให้คัดลอกเฉพาะค่าจากฟิลด์ `access_token` (ข้อความยาวๆ)
4. นำมาตั้งค่าใน n8n Node "Set Configuration" (Node 0) ในรูปแบบ:
   `MIGRATION_TOKEN: 'Bearer <คัดลอก Token มาวางที่นี่>'`

---

## 📌 ส่วนที่ 3: การเตรียม Database

รัน SQL จากไฟล์แยก **ก่อน** เริ่ม Workflow:

```bash
mysql -h <DB_HOST> -u migration_bot -p lcbp3_production < lcbp3-v1.8.0-migration.sql
```

> ดูรายละเอียดตาราง: [`lcbp3-v1.8.0-migration.sql`](./lcbp3-v1.8.0-migration.sql)

**ตารางที่สร้าง (6 ตาราง ชั่วคราว — ลบได้หลัง Migration เสร็จ):**

| ตาราง                      | วัตถุประสงค์                       |
| -------------------------- | ------------------------------- |
| `migration_progress`       | Checkpoint ติดตามความคืบหน้า Batch |
| `migration_review_queue`   | รายการที่ต้องตรวจสอบโดยคน          |
| `migration_errors`         | Error Log                       |
| `migration_fallback_state` | สถานะ AI Model Fallback         |
| `import_transactions`      | Idempotency ป้องกัน Import ซ้ำ      |
| `migration_daily_summary`  | สรุปผลรายวัน                      |

---

## 📌 ส่วนที่ 4: การทำงานของแต่ละ Node

### Node 0: Set Configuration
- เก็บค่า Config ทั้งหมดใน `$workflow.staticData.config`
- อ่านผ่าน `$workflow.staticData.config.KEY` ใน Node อื่น

### Node 1: Pre-flight Checks & Data Reader
- ตรวจสอบ Backend Health และ Ollama Ping
- อ่าน Checkpoint (`last_processed_index`) จาก `migration_progress`
- Batch ข้อมูลจาก Excel ตามตาราง `BATCH_SIZE` ปกติ (50-100)
- Normalize ข้อมูล UTF-8 (NFC) และสร้าง `original_index`

### Node 2: DB Lookup & Categories Fetch
- ดึง Categories จาก `/api/meta/categories` เพื่อเตรียม Prompt
- Query ทะลวง DB: แปลงรหัสใน Excel (`project_code`, `sender`, `receiver`) ให้เป็น IDs จาก MariaDB
- Query ดึง Master Tags ของโปรเจ็กต์: `SELECT tag_name, description FROM tags WHERE project_id = ...`
- Output: แปลง ID เรียบร้อยและเตรียม `existing_tags_json` ให้ Ollama

### Node 3: Text Extraction & Temp Upload
- ใช้ **Apache Tika** (ผ่าน `Extract PDF Text` node หรือ HTTP Request) สกัดข้อความ (OCR/Text) ออกจาก PDF ใน staging
- แนบไฟล์ไปยัง Backend: ยิง HTTP Request **`POST /api/storage/upload`** ของ Backend
- รอรับผลลัพธ์เป็น `temp_attachment_id` (หมายความว่าไฟล์นี้เข้าข่าย Temporary ถูกเก็บจัดการใน NAS เรียบร้อยแล้ว)
- Output: ไฟล์พร้อมใช้งาน, ได้เนื้อหา Text มาเตรียม prompt

### Node 4: AI Analysis
- วาง System Prompt บังคับ Output JSON
- โยน Metadata (Title, Date, DB Lookups) พร้อม Extracted PDF Text คุยกับ **Ollama `llama3.2:3b`**
- ให้ AI วิเคราะห์ และสรุปเป็น `ai_summary` 
- ให้ AI แนะนำ Tags ใหม่หรือเลือก Tags เดิมจาก `existing_tags_json`

### Node 5: Parse & Validate
- Schema Validation (ดูให้แน่ใจว่า AI ตอบ `is_valid`, `confidence`, `summary`, `suggested_tags`)
- Normalizing categories, trimming tags (`is_new: true / false` flag สำคัญมาก)
- จัดชุดค่า Status ใหม่

### Node 6: Confidence Router & Staging Ingest
**แยกสาย 4 สาย:**
1. **PENDING (Auto Ready):** (`confidence ≥ 0.85` && `is_valid = true`) → INSERT เข้า `migration_review_queue` 
2. **PENDING (Flagged):** (`confidence 0.60 - 0.84`) → INSERT เข้า `migration_review_queue` พร้อม Highlight/Remarks ให้ Admin ดูละเอียด
3. **REJECTED:** (`confidence < 0.60` หรือ `is_valid = false`) → INSERT เข้า `migration_review_queue` สถานะรอแก้แบบ Manual
4. **Error/Parse Fail:** ไปลง CSV Reject Log + DB `migration_errors`

**สำคัญมาก:** *n8n จะทำหน้าที่สูบข้อมูลและจัดเตรียมเข้า `migration_review_queue` เท่านั้น จะไม่มีการข้ามขั้นตอนไป Import ลงตารางหลัก `correspondences` อัตโนมัติ (Final Commit ต้องทำบน Frontend UI)*

---

## 📌 ส่วนที่ 5: Rollback Workflow

**Workflow: `Migration Rollback`** — Manual Trigger เท่านั้น

```
[Manual Trigger: {confirmation: "CONFIRM_ROLLBACK"}]
        │
        ▼
[Code: Guard — ต้องพิมพ์ "CONFIRM_ROLLBACK"]
        │ PASS
        ▼
[MariaDB: Disable Token]
UPDATE users SET is_active = 0 WHERE username = 'migration_bot';
        │
        ▼
[MariaDB: Delete Attachments]
DELETE ca FROM correspondence_attachments ca
  INNER JOIN correspondences c ON c.id = ca.correspondence_id
  WHERE c.created_by = (SELECT user_id FROM users WHERE username = 'migration_bot');
        │
        ▼
[MariaDB: Delete Correspondence Records]
DELETE FROM correspondences
  WHERE created_by = (SELECT user_id FROM users WHERE username = 'migration_bot');
        │
        ▼
[MariaDB: Clear Idempotency Records]
DELETE FROM import_transactions WHERE batch_id = '<BATCH_ID>';
        │
        ▼
[MariaDB: Reset Checkpoint + Fallback State]
DELETE FROM migration_progress WHERE batch_id = '<BATCH_ID>';
DELETE FROM migration_fallback_state WHERE batch_id = '<BATCH_ID>';
        │
        ▼
[Email: Rollback Report → Admin]
```

**Confirmation Guard:**
```javascript
if ($input.first().json.confirmation !== 'CONFIRM_ROLLBACK') {
  throw new Error('Rollback cancelled: type "CONFIRM_ROLLBACK" to proceed.');
}
return $input.all();
```

---

## 📌 ส่วนที่ 6: Daily Operation

| เวลา  | กิจกรรม                         | ผู้รับผิดชอบ            |
| ----- | ------------------------------ | ------------------- |
| 08:00 | ตรวจสอบ Night Summary Email    | Admin               |
| 09:00 | Approve/Reject ใน Review Queue | Document Controller |
| 17:00 | ตรวจ Disk Space + GPU Temp     | DevOps              |
| 22:00 | Workflow เริ่มรันอัตโนมัติ           | System              |
| 06:30 | Night Summary Report ส่ง Email  | System              |

### Emergency Stop

```bash
# 1. หยุด n8n
docker stop n8n

# 2. Disable Token
mysql -h <DB_IP> -u root -p \
  -e "UPDATE users SET is_active = false WHERE username = 'migration_bot';"

# 3. Progress
mysql -h <DB_IP> -u root -p \
  -e "SELECT * FROM migration_progress WHERE batch_id = 'migration_20260226';"

# 4. Errors
mysql -h <DB_IP> -u root -p \
  -e "SELECT * FROM migration_errors ORDER BY created_at DESC LIMIT 20;"
```

---

## 🚨 ข้อควรระวังสำหรับ Free Plan

### 1. Security
- **อย่า Commit ไฟล์นี้เข้า Git** ถ้ามี Password/Token
- ใช้ `.gitignore` สำหรับไฟล์ JSON ที่มี Config
- Rotate Token ทันทีหลังใช้งาน

### 2. Limitations
- **Execution Timeout**: ตรวจสอบ n8n execution timeout (default 5 นาที)
- **Memory**: จำกัดที่ 2GB (ตาม Docker Compose)
- **Concurrent**: รัน Batch ต่อเนื่อง ไม่ parallel

### 3. Backup
- สำรอง PostgreSQL data ที่ `/share/np-dms/n8n/postgres-data`
- สำรอง n8n data ที่ `/share/np-dms/n8n`
- สำรอง Logs ที่ `/share/np-dms/n8n/migration_logs`

---

## ✅ Pre-Production Checklist (Free Plan)

| ลำดับ | รายการ                 | วิธีตรวจสอบ                                                         |
| --- | ---------------------- | ----------------------------------------------------------------- |
| 1   | Config ถูกต้อง           | รัน Test Execution ดูผลลัพธ์ Node 0                                   |
| 2   | Database Connect ได้    | Test Step ใน Node Read Checkpoint                                 |
| 3   | Ollama พร้อม            | `curl http://<OLLAMA_HOST>/api/tags`                              |
| 4   | Backend Token ใช้ได้     | Test Step ใน Node Fetch Categories                                |
| 5   | File Mount RO ถูกต้อง    | `docker exec n8n ls /home/node/.n8n-files/staging_ai`             |
| 6   | Log Mount RW ถูกต้อง     | `docker exec n8n touch /home/node/.n8n-files/migration_logs/test` |
| 7   | Categories ไม่ hardcode | ดูผลลัพธ์ Node Fetch Categories                                      |
| 8   | Tags โหลดถูกต้อง        | ดูผลลัพธ์ Node Fetch Tags (ควรแสดงรายการ Tags ที่มีอยู่)             |
| 9   | AI Tag Extraction ทำงาน | ตรวจ `suggested_tags` ใน Response จาก Parse & Validate Node       |
| 10  | Idempotency Key ถูกต้อง  | ตรวจ Header ใน Node Import                                        |
| 11  | Checkpoint บันทึก        | ตรวจสอบ `migration_progress` หลังรัน                                |
| 12  | Error Log สร้างไฟล์      | ตรวจสอบ `error_log.csv`                                           |

---

## 🔧 การแก้ไขปัญหาเฉพาะหน้า

### ปัญหา: Config ไม่ถูกต้อง
**แก้ไข:** แก้ที่ Node "Set Configuration" แล้ว Save → Execute Workflow ใหม่

### ปัญหา: Database Connection Error
**ตรวจสอบ:**
```javascript
// ใส่ใน Code Node ชั่วคราวเพื่อ Debug
const config = $workflow.staticData.config;
return [{ json: {
  host: config.DB_HOST,
  port: config.DB_PORT,
  // อย่าแสดง password ใน Production!
  test: 'Config loaded: ' + (config ? 'YES' : 'NO')
}}];
```

### ปัญหา: AI Tag Extraction ไม่ทำงาน
**ตรวจสอบ:**
1. ดู Response ใน Node "Parse & Validate" ว่ามี field `suggested_tags` หรือไม่
2. ถ้าไม่มี → ตรวจสอบ Prompt ใน "Build AI Prompt" ว่ารวม Tag Extraction Instructions แล้ว
3. ถ้า AI ตอบแต่ Tags ไม่ถูกต้อง → ปรับ Threshold หรือส่งไป Review Queue

```javascript
// Debug Code Node ชั่วคราว
return [{
  json: {
    has_suggested_tags: !!$json.ai_result?.suggested_tags,
    tag_count: $json.ai_result?.suggested_tags?.length || 0,
    suggested_tags: $json.ai_result?.suggested_tags,
    tag_confidence: $json.ai_result?.tag_confidence
  }
}];
```

### ปัญหา: Tags ซ้ำหรือผิดพลาด
**แก้ไข:**
- ใช้ SQL ตรวจสอบ Tags ที่ซ้ำ:
```sql
SELECT tag_name, COUNT(*) as cnt FROM tags
WHERE created_by = (SELECT user_id FROM users WHERE username = 'migration_bot')
GROUP BY tag_name HAVING cnt > 1;
```
- ถ้าพบซ้ำ → ใช้ Node Normalize ก่อนบันทึก (มีแล้วใน Parse & Validate)

---

## 📊 การ Monitor (Manual)

เนื่องจาก Free Plan ไม่มี Advanced Monitoring:

```bash
# ดู Progress ล่าสุด
docker exec n8n sh -c "tail -5 /home/node/.n8n-files/migration_logs/reject_log.csv"

# ดู Error ล่าสุด
docker exec n8n sh -c "tail -10 /home/node/.n8n-files/migration_logs/error_log.csv"

# ดู Checkpoint ใน DB
mysql -h <DB_HOST> -u migration_bot -p -e "SELECT * FROM migration_progress WHERE batch_id = 'migration_20260226'"

# ดู Tags ที่สร้างจาก Migration
mysql -h <DB_HOST> -u migration_bot -p -e "SELECT tag_name, created_at FROM tags WHERE created_by = (SELECT user_id FROM users WHERE username = 'migration_bot') ORDER BY created_at DESC LIMIT 20"

# ดูสถิติการผูก Tag กับเอกสาร
mysql -h <DB_HOST> -u migration_bot -p -e "SELECT COUNT(DISTINCT ct.correspondence_id) as docs_with_tags, COUNT(DISTINCT ct.tag_id) as unique_tags_used FROM correspondence_tags ct JOIN correspondences c ON ct.correspondence_id = c.id WHERE c.created_by = (SELECT user_id FROM users WHERE username = 'migration_bot')"
```

---

## 📥 วิธี Import Workflow

1. เปิดไฟล์ `n8n.workflow` (JSON) จาก `specs/03-Data-and-Storage/`
2. เข้า n8n UI → **Workflows** → **Import from File**
3. เลือกไฟล์ `n8n.workflow`
4. เปิด Workflow → แก้ไข Node **"Set Configuration"** ตามข้อมูลจริง
5. ตั้งค่า **Schedule Trigger** หรือเปลี่ยนเป็น **Manual Trigger** สำหรับทดสอบ
6. **Save** → **Execute Workflow** เพื่อทดสอบ

---

## 📞 การติดต่อสนับสนุน

| ปัญหา            | ช่องทางติดต่อ                                  |
| --------------- | ------------------------------------------- |
| Technical Issue | DevOps Team (Slack: #migration-support)     |
| Data Issue      | Document Controller (Email: dc@lcbp3.local) |
| Security Issue  | Security Team (Email: security@lcbp3.local) |

---

**เอกสารฉบับนี้จัดทำขึ้นสำหรับ n8n Free Plan (Self-hosted) ตาม ADR-017 และ 03-04**
**Version:** 1.8.0-free | **Last Updated:** 2026-03-04 | **Author:** Development Team
