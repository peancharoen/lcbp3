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
│  │Pre-flight   │───▶│Fetch Categories│──▶│File Validator│   │
│  │Checks       │    │from Backend    │    │+ Sanitize    │   │
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
│ │Auto  │   │ Review   │   │Reject  │                      │
│ │Ingest│   │ Queue    │   │Log     │                      │
│ │+Chkpt│   │(DB only) │   │(CSV)   │                      │
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
  BACKEND_URL: 'https://api.np-dms.work',
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

1. **เข้าสู่ระบบ DMS** ด้วยบัญชี `migration_bot` (หรือบัญชี Admin สำหรับทดสอบ)
2. กดปุ่ม `F12` เพื่อเปิด Developer Tools ของเบราว์เซอร์
3. ไปที่แท็บ **Network** (เครือข่าย)
4. ทำกิจกรรมใดกิจกรรมหนึ่งบนหน้าเว็บ (เช่น คลิกเปลี่ยนหน้าหรือโหลดข้อมูล)
5. คลิกดูรายละเอียดของ Request ใดก็ได้ที่เรียกไปยัง API
6. ภายใต้ส่วน **Request Headers** ให้มองหาแอตทริบิวต์ `Authorization`
7. ให้คัดลอกค่าที่ตามหลังตคำว่า `Bearer` (ซึงจะเป็นสายอักขระยาวๆ)
8. นำค่าดังกล่าวมาใส่ทดแทนในส่วนของค่าคอนฟิก `MIGRATION_TOKEN` ของ Node **Set Configuration**

*(หรือใช้เครื่องมือ API Testing เช่น Postman รันคำสั่ง `POST /api/auth/login` และนำตัวแปร `accessToken` จากผลลัพธ์มาใช้งานโดยตรง)*

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

### Node 1-2: Pre-flight Checks
- ตรวจสอบ Backend Health
- ดึง Categories จาก `/api/master/correspondence-types`
- ตรวจ File Mount (Read-only)
- เก็บ Categories ใน `$workflow.staticData.systemCategories`

### Node 3: Read Checkpoint
- อ่าน `last_processed_index` จาก `migration_progress`
- ถ้าไม่มี เริ่มจาก 0

### Node 4: Process Batch
- อ่าน Excel
- Normalize UTF-8 (NFC)
- ตัด Batch ตาม `BATCH_SIZE`

### Node 5: File Validator
- Sanitize filename (replace special chars)
- Path traversal check
- ตรวจสอบไฟล์มีอยู่จริง
- **Output 2 ทาง**: Valid → AI, Error → Log

### Node 6: Build AI Prompt
- ดึง Categories จาก `staticData` (ไม่ hardcode)
- เลือก Model ตาม Fallback State
- สร้าง Prompt ตาม Template

### Node 7: Ollama AI Analysis
- เรียก `POST /api/generate`
- Timeout 30 วินาที
- Retry 3 ครั้ง (n8n built-in)

### Node 8: Parse & Validate
- Parse JSON Response
- Schema Validation (is_valid, confidence, detected_issues)
- Enum Validation (ตรวจ Category ว่าอยู่ใน List หรือไม่)
- **Output 2 ทาง**: Success → Router, Error → Fallback

### Node 9: Confidence Router
- **4 Outputs**:
  1. Auto Ingest (confidence ≥ 0.85 && is_valid)
  2. Review Queue (0.60 ≤ confidence < 0.85)
  3. Reject Log (confidence < 0.60 หรือ is_valid = false)
  4. Error Log (parse error)

### Node 10A: Auto Ingest
- POST `/api/migration/import`
- Header: `Idempotency-Key: {doc_num}:{batch_id}`
- บันทึก Checkpoint ทุก 10 records

### Node 10B: Review Queue
- INSERT เข้า `migration_review_queue` เท่านั้น
- ยังไม่สร้าง Correspondence

### Node 10C: Reject Log
- เขียน CSV ที่ `/home/node/.n8n-files/migration_logs/reject_log.csv`

### Node 10D: Error Log
- เขียน CSV + INSERT เข้า `migration_errors`

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
| 8   | Idempotency Key ถูกต้อง  | ตรวจ Header ใน Node Import                                        |
| 9   | Checkpoint บันทึก        | ตรวจสอบ `migration_progress` หลังรัน                                |
| 10  | Error Log สร้างไฟล์      | ตรวจสอบ `error_log.csv`                                           |

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

### ปัญหา: Ollama Timeout
**แก้ไข:**
- เพิ่ม `DELAY_MS` เป็น 3000 หรือ 5000
- ลด `BATCH_SIZE` เหลือ 5
- ตรวจสอบ GPU/CPU ของ Ollama Server

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
