# 📋 คู่มือการตั้งค่า n8n สำหรับ Legacy Data Migration

เอกสารนี้จัดทำขึ้นเพื่อรองรับการ Migration เอกสาร PDF 20,000 ฉบับ ตามแผนใน `03-04-legacy-data-migration.md` และ `ADR-017-ollama-data-migration.md`

> **Note:** Category Enum system-driven, Idempotency-Key Header, Storage Enforcement, Audit Log, Encoding Normalization, Security Hardening, Nginx Rate Limit, Docker Hardening, Orchestrator on QNAP, AI Physical Isolation (Desktop Desk-5439), Folder Standard (/share/np-dms/n8n)

---

## 📌 ส่วนที่ 1: การติดตั้งและตั้งค่าเบื้องต้น

### 1.1 ปรับปรุง n8n บน QNAP NAS (Docker)

คุณสามารถเพิ่ม PostgreSQL Service เข้าไปใน `docker-compose-lcbp3-n8n.yml` ปัจจุบันบน QNAP NAS ได้ดังนี้:

```yaml
version: '3.8'

x-restart: &restart_policy
  restart: unless-stopped

x-logging: &default_logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"

services:
  n8n-db:
    <<: [*restart_policy, *default_logging]
    image: postgres:16-alpine
    container_name: n8n-db
    environment:
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=<strong_password>
      - POSTGRES_DB=n8n
    volumes:
      - "/share/np-dms/n8n/postgres-data:/var/lib/postgresql/data"
    networks:
      lcbp3: {}
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -h localhost -U n8n -d n8n']
      interval: 10s
      timeout: 5s
      retries: 5

  n8n:
    <<: [*restart_policy, *default_logging]
    image: n8nio/n8n:1.78.0
    container_name: n8n
    depends_on:
      n8n-db:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 2G
    environment:
      TZ: "Asia/Bangkok"
      NODE_ENV: "production"
      N8N_PUBLIC_URL: "https://n8n.np-dms.work/"
      WEBHOOK_URL: "https://n8n.np-dms.work/"
      N8N_EDITOR_BASE_URL: "https://n8n.np-dms.work/"
      N8N_PROTOCOL: "https"
      N8N_HOST: "n8n.np-dms.work"
      N8N_PORT: 5678
      N8N_PROXY_HOPS: "1"
      N8N_DIAGNOSTICS_ENABLED: 'false'
      N8N_SECURE_COOKIE: 'true'
      N8N_ENCRYPTION_KEY: "9AAIB7Da9DW1qAhJE5/Bz4SnbQjeAngI"
      N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'true'
      GENERIC_TIMEZONE: "Asia/Bangkok"
      # DB Setup
      DB_TYPE: postgresdb
      DB_POSTGRESDB_DATABASE: n8n
      DB_POSTGRESDB_HOST: n8n-db
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_USER: n8n
      DB_POSTGRESDB_PASSWORD: <strong_password>
      # Data Prune
      EXECUTIONS_DATA_PRUNE: 'true'
      EXECUTIONS_DATA_MAX_AGE: 168
      EXECUTIONS_DATA_PRUNE_TIMEOUT: 60
    ports:
      - "5678:5678"
    networks:
      lcbp3: {}
    volumes:
      - "/share/np-dms/n8n:/home/node/.n8n"
      - "/share/np-dms/n8n/cache:/home/node/.cache"
      - "/share/np-dms/n8n/scripts:/scripts"
      - "/share/np-dms/n8n/data:/data"
      - "/var/run/docker.sock:/var/run/docker.sock"
      # read-only: อ่านไฟล์ PDF ต้นฉบับเท่านั้น
      - "/share/np-dms/staging_ai:/share/np-dms/staging_ai:ro"
      # read-write: เขียน Log และ CSV ทั้งหมด
      - "/share/np-dms/n8n/migration_logs:/share/np-dms/n8n/migration_logs:rw"
```

> ⚠️ **Volume หมายเหตุ:** `/share/np-dms/staging_ai` = **read-only** (อ่านไฟล์ต้นฉบับ) และ `/share/np-dms/n8n/migration_logs` = **read-write** (เขียน Log/CSV) — ห้ามเขียน CSV ลง `staging_ai` เพราะจะ Error ทันที

### 1.2 Nginx Rate Limit

เพิ่มใน Nginx config สำหรับ Migration API:

```nginx
# nginx.conf หรือ site config
limit_req_zone $binary_remote_addr zone=migration:10m rate=1r/s;

location /api/correspondences/import {
    limit_req zone=migration burst=5 nodelay;
    proxy_pass http://backend:3001;
}
```

### 1.3 Environment Variables

**Settings → Environment Variables ใน n8n UI:**

| Variable                    | ค่าที่แนะนำ                       | คำอธิบาย                             |
| --------------------------- | ----------------------------- | ---------------------------------- |
| `OLLAMA_HOST`               | `http://192.168.20.100:11434` | URL ของ Ollama (Desktop Desk-5439) |
| `OLLAMA_MODEL_PRIMARY`      | `llama3.2:3b`                 | Model หลัก                          |
| `OLLAMA_MODEL_FALLBACK`     | `mistral:7b-instruct-q4_K_M`  | Model สำรอง                         |
| `MIGRATION_BATCH_SIZE`      | `10`                          | จำนวน Record ต่อ Batch               |
| `MIGRATION_DELAY_MS`        | `2000`                        | Delay ระหว่าง Request (ms)          |
| `CONFIDENCE_THRESHOLD_HIGH` | `0.85`                        | Threshold Auto Ingest              |
| `CONFIDENCE_THRESHOLD_LOW`  | `0.60`                        | Threshold Review Queue             |
| `MAX_RETRY_COUNT`           | `3`                           | จำนวนครั้ง Retry                      |
| `FALLBACK_ERROR_THRESHOLD`  | `5`                           | Error ที่ trigger Fallback           |
| `BACKEND_URL`               | `https://<BACKEND_URL>`       | URL ของ LCBP3 Backend              |
| `MIGRATION_BATCH_ID`        | `migration_20260226`          | ID ของ Batch                       |

---

## 📌 ส่วนที่ 2: การเตรียม Database

รัน SQL นี้บน MariaDB **ก่อน** เริ่ม n8n Workflow:

```sql
-- Checkpoint
CREATE TABLE IF NOT EXISTS migration_progress (
    batch_id             VARCHAR(50) PRIMARY KEY,
    last_processed_index INT DEFAULT 0,
    status               ENUM('RUNNING','COMPLETED','FAILED') DEFAULT 'RUNNING',
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Review Queue (Temporary — ไม่ใช่ Business Schema)
CREATE TABLE IF NOT EXISTS migration_review_queue (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    document_number       VARCHAR(100) NOT NULL,
    title                 TEXT,
    original_title        TEXT,
    ai_suggested_category VARCHAR(50),
    ai_confidence         DECIMAL(4,3),
    ai_issues             JSON,
    review_reason         VARCHAR(255),
    status                ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
    reviewed_by           VARCHAR(100),
    reviewed_at           TIMESTAMP NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_doc_number (document_number)
);

-- Error Log
CREATE TABLE IF NOT EXISTS migration_errors (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    batch_id        VARCHAR(50),
    document_number VARCHAR(100),
    error_type      ENUM('FILE_NOT_FOUND','AI_PARSE_ERROR','API_ERROR','DB_ERROR','UNKNOWN'),
    error_message   TEXT,
    raw_ai_response TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_batch_id   (batch_id),
    INDEX idx_error_type (error_type)
);

-- Fallback State
CREATE TABLE IF NOT EXISTS migration_fallback_state (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    batch_id           VARCHAR(50) UNIQUE,
    recent_error_count INT DEFAULT 0,
    is_fallback_active BOOLEAN DEFAULT FALSE,
    updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Idempotency (Patch)
CREATE TABLE IF NOT EXISTS import_transactions (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    idempotency_key  VARCHAR(255) UNIQUE NOT NULL,
    document_number  VARCHAR(100),
    batch_id         VARCHAR(100),
    status_code      INT DEFAULT 201,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_idem_key (idempotency_key)
);

-- Daily Summary
CREATE TABLE IF NOT EXISTS migration_daily_summary (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    batch_id        VARCHAR(50),
    summary_date    DATE,
    total_processed INT DEFAULT 0,
    auto_ingested   INT DEFAULT 0,
    sent_to_review  INT DEFAULT 0,
    rejected        INT DEFAULT 0,
    errors          INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_batch_date (batch_id, summary_date)
);
```

---

## 📌 ส่วนที่ 3: Credentials

**Credentials → Add New:**

#### 🔐 Ollama API
| Field          | ค่า                            |
| -------------- | ----------------------------- |
| Name           | `Ollama Local API`            |
| Type           | `HTTP Request`                |
| Base URL       | `http://192.168.20.100:11434` |
| Authentication | `None`                        |

#### 🔐 LCBP3 Backend API
| Field          | ค่า                          |
| -------------- | --------------------------- |
| Name           | `LCBP3 Migration Token`     |
| Type           | `HTTP Request`              |
| Base URL       | `https://<BACKEND_URL>/api` |
| Authentication | `Header Auth`               |
| Header Name    | `Authorization`             |
| Header Value   | `Bearer <MIGRATION_TOKEN>`  |

#### 🔐 MariaDB
| Field    | ค่า                 |
| -------- | ------------------ |
| Name     | `LCBP3 MariaDB`    |
| Type     | `MariaDB`          |
| Host     | `<DB_IP>`          |
| Port     | `3306`             |
| Database | `lcbp3_production` |
| User     | `migration_bot`    |
| Password | `<password>`       |

---

## 📌 ส่วนที่ 4: Workflow (Step-by-Step)

### 4.1 โครงสร้างภาพรวม

```
┌──────────────────────────────────────────────────────────────────────┐
│                      MIGRATION WORKFLOW v1.8.0                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐              │
│  │ Node 0  │──▶│ Node 1  │──▶│ Node 2  │──▶│ Node 3  │              │
│  │Pre-     │   │  Data   │   │  File   │   │   AI    │              │
│  │flight + │   │ Reader  │   │ Validat.│   │Analysis │              │
│  │Fetch Cat│   │+Encoding│   │+Sanitize│   │+Enum Chk│              │
│  └─────────┘   └─────────┘   └──┬──┬───┘   └────┬────┘              │
│                                  │  │             │                   │
│                            valid │  │ error  ┌───▼──────────────┐   │
│                                  │  └──────▶ │  Node 3.5        │   │
│                                  │           │ Fallback Manager │   │
│                                  │           └──────────────────┘   │
│                                  ▼                   │               │
│                             ┌─────────┐         ┌────▼────┐         │
│                             │ Node 5D │         │ Node 4  │         │
│                             │  Error  │         │Confidence│         │
│                             │   Log   │         │+Revision │         │
│                             └─────────┘         │ Drift   │         │
│                                                  └┬──┬──┬──┘         │
│                                                   │  │  │            │
│                                      ┌────────────┘  │  └──────┐    │
│                                      ▼               ▼         ▼    │
│                                ┌──────────┐  ┌──────────┐ ┌──────┐  │
│                                │  Node 5A │  │  Node 5B │ │ 5C  │  │
│                                │  Auto    │  │  Review  │ │Reject│  │
│                                │  Ingest  │  │  Queue   │ │ Log  │  │
│                                │+Idempot. │  │(Temp only│ └──────┘  │
│                                └────┬─────┘  └──────────┘           │
│                                     │                                 │
│                                ┌────▼──────┐                         │
│                                │ Checkpoint│                         │
│                                └───────────┘                         │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Node 0: Pre-flight + Fetch System Categories

Fetch System Categories ก่อน Batch ทุกครั้ง

**Sub-flow:**
```
[Trigger] → [HTTP: Ollama /api/tags] → [MariaDB: SELECT 1]
          → [HTTP: Backend /health]  → [Code: File Mount Check]
          → [HTTP: GET /api/meta/categories] → [Store in Workflow Variable]
          → [IF all pass → Node 1]  [ELSE → Stop + Alert]
```

**HTTP Node — Fetch Categories:**
```json
{
  "method": "GET",
  "url": "={{ $env.BACKEND_URL }}/api/meta/categories",
  "authentication": "genericCredentialType",
  "genericAuthType": "lcbp3MigrationToken"
}
```

**Code Node — Store Categories + File Mount Check:**
```javascript
const fs = require('fs');

// เก็บ categories ใน Workflow Variable
const categories = $input.first().json.categories;
if (!categories || !Array.isArray(categories) || categories.length === 0) {
  throw new Error('Failed to fetch system categories from backend');
}

// Set Workflow Variable เพื่อใช้ใน Node 3
$workflow.variables = $workflow.variables || {};
$workflow.variables.system_categories = categories;

// ตรวจ File Mount
try {
  const files = fs.readdirSync('/share/np-dms/staging_ai');
  if (files.length === 0) throw new Error('staging_ai is empty');
  fs.writeFileSync('/share/np-dms/n8n/migration_logs/.preflight_ok', new Date().toISOString());
} catch (err) {
  throw new Error(`File mount check failed: ${err.message}`);
}

return [{ json: { preflight_ok: true, system_categories: categories } }];
```

---

### 4.3 Node 1: Load Checkpoint + Read Excel + Encoding Normalization

**Step 1 — MariaDB Node (Read Checkpoint):**
```sql
SELECT last_processed_index, status
FROM migration_progress
WHERE batch_id = '{{ $env.MIGRATION_BATCH_ID }}'
LIMIT 1;
```

**Step 2 — Spreadsheet File Node:**
```json
{ "operation": "toData", "binaryProperty": "data", "options": { "sheetName": "Sheet1" } }
```

**Step 3 — Code Node (Checkpoint + Batch + Encoding):**
```javascript
const checkpointResult = $('Read Checkpoint').first();
let startIndex = 0;
if (checkpointResult && checkpointResult.json.status === 'RUNNING') {
  startIndex = checkpointResult.json.last_processed_index || 0;
}

const allItems = $('Read Excel').all();
const remaining = allItems.slice(startIndex);
const batchSize = parseInt($env.MIGRATION_BATCH_SIZE) || 10;
const currentBatch = remaining.slice(0, batchSize);

// Encoding Normalization: Excel → UTF-8 NFC (Patch)
const normalize = (str) => {
  if (!str) return '';
  return Buffer.from(String(str), 'utf8').toString('utf8').normalize('NFC');
};

return currentBatch.map((item, i) => ({
  ...item,
  json: {
    ...item.json,
    document_number: normalize(item.json.document_number),
    title: normalize(item.json.title),
    original_index: startIndex + i
  }
}));
```

---

### 4.4 Node 2: File Validator & Sanitizer

**Node Type:** `Code` — **2 Outputs**

```javascript
const fs   = require('fs');
const path = require('path');
const items = $input.all();
const validatedItems = [];
const errorItems     = [];

for (const item of items) {
  const docNumber = item.json.document_number;
  // Sanitize + Normalize Filename (Patch)
  const safeName = path.basename(
    String(docNumber).replace(/[^a-zA-Z0-9\-_.]/g, '_')
  ).normalize('NFC');
  const filePath = path.resolve('/share/np-dms/staging_ai', `${safeName}.pdf`);

  if (!filePath.startsWith('/share/np-dms/staging_ai/')) {
    errorItems.push({ ...item, json: { ...item.json, error: 'Path traversal detected', error_type: 'FILE_NOT_FOUND' } });
    continue;
  }

  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      validatedItems.push({ ...item, json: { ...item.json, file_exists: true, file_size: stats.size, file_path: filePath } });
    } else {
      errorItems.push({ ...item, json: { ...item.json, error: `File not found: ${filePath}`, error_type: 'FILE_NOT_FOUND', file_exists: false } });
    }
  } catch (err) {
    errorItems.push({ ...item, json: { ...item.json, error: err.message, error_type: 'FILE_NOT_FOUND', file_exists: false } });
  }
}

// Output 0 → Node 3 | Output 1 → Node 5D
return [validatedItems, errorItems];
```

---

### 4.5 Node 3: Build Prompt + AI Analysis

**Step 1 — MariaDB (Read Fallback State):**
```sql
SELECT is_fallback_active FROM migration_fallback_state
WHERE batch_id = '{{ $env.MIGRATION_BATCH_ID }}' LIMIT 1;
```

**Step 2 — Code Node (Build Prompt: inject system_categories):**
```javascript
const fallbackState = $('Read Fallback State').first();
const isFallback = fallbackState?.json?.is_fallback_active || false;
const model = isFallback ? $env.OLLAMA_MODEL_FALLBACK : $env.OLLAMA_MODEL_PRIMARY;

// ใช้ system_categories จาก Workflow Variable (ไม่ hardcode)
const systemCategories = $workflow.variables?.system_categories
  || ['Correspondence','RFA','Drawing','Transmittal','Report','Other'];

const item = $input.first();

const systemPrompt = `You are a Document Controller for a large construction project.
Your task is to validate document metadata.
You MUST respond ONLY with valid JSON. No explanation, no markdown, no extra text.
If there are no issues, "detected_issues" must be an empty array [].`;

const userPrompt = `Validate this document metadata and respond in JSON:

Document Number: ${item.json.document_number}
Title: ${item.json.title}
Expected Pattern: [ORG]-[TYPE]-[SEQ] e.g. "TCC-COR-0001"
Category List (MUST match system enum exactly): ${JSON.stringify(systemCategories)}

Respond ONLY with this exact JSON structure:
{
  "is_valid": true | false,
  "confidence": 0.0 to 1.0,
  "suggested_category": "<one from Category List>",
  "detected_issues": ["<issue1>"],
  "suggested_title": "<corrected title or null>"
}`;

return [{
  json: {
    ...item.json,
    active_model: model,
    system_categories: systemCategories,
    ollama_payload: { model, prompt: `${systemPrompt}\n\n${userPrompt}`, stream: false, format: 'json' }
  }
}];
```

**Step 3 — HTTP Request Node (Ollama):**
```json
{
  "method": "POST",
  "url": "={{ $env.OLLAMA_HOST }}/api/generate",
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ $json.ollama_payload }}",
  "options": { "timeout": 30000, "retry": { "count": 3, "delay": 2000, "backoff": "exponential" } }
}
```

**Step 4 — Code Node (Parse + Validate: Enum check):**
```javascript
const items = $input.all();
const parsed      = [];
const parseErrors = [];

for (const item of items) {
  try {
    let raw = item.json.response || '';
    raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(raw);

    // Strict Schema Validation
    if (typeof result.is_valid !== 'boolean')
      throw new Error('is_valid must be boolean');
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1)
      throw new Error('confidence must be float 0.0–1.0');
    if (!Array.isArray(result.detected_issues))
      throw new Error('detected_issues must be array');

    // Enum Validation ตรง System Categories (Patch)
    const systemCategories = item.json.system_categories || [];
    if (!systemCategories.includes(result.suggested_category))
      throw new Error(`Category "${result.suggested_category}" not in system enum: [${systemCategories.join(', ')}]`);

    parsed.push({ ...item, json: { ...item.json, ai_result: result, parse_error: null } });
  } catch (err) {
    parseErrors.push({
      ...item,
      json: { ...item.json, ai_result: null, parse_error: err.message, raw_ai_response: item.json.response, error_type: 'AI_PARSE_ERROR' }
    });
  }
}

// Output 0 → Node 4 | Output 1 → Node 3.5 + Node 5D
return [parsed, parseErrors];
```

---

### 4.6 Node 3.5: Fallback Model Manager

**MariaDB Node:**
```sql
INSERT INTO migration_fallback_state (batch_id, recent_error_count, is_fallback_active)
VALUES ('{{ $env.MIGRATION_BATCH_ID }}', 1, FALSE)
ON DUPLICATE KEY UPDATE
  recent_error_count = recent_error_count + 1,
  is_fallback_active = CASE
    WHEN recent_error_count + 1 >= {{ $env.FALLBACK_ERROR_THRESHOLD }} THEN TRUE
    ELSE is_fallback_active
  END,
  updated_at = NOW();
```

**Code Node (Alert):**
```javascript
const state = $input.first().json;
if (state.is_fallback_active) {
  return [{ json: {
    ...state, alert: true,
    alert_message: `⚠️ Fallback model (${$env.OLLAMA_MODEL_FALLBACK}) activated after ${state.recent_error_count} errors`
  }}];
}
return [{ json: { ...state, alert: false } }];
```

---

### 4.7 Node 4: Confidence Router + Revision Drift Protection

**Node Type:** `Code` — **4 Outputs**

```javascript
const items = $input.all();
const autoIngest  = [];
const reviewQueue = [];
const rejectLog   = [];
const errorLog    = [];

const HIGH = parseFloat($env.CONFIDENCE_THRESHOLD_HIGH) || 0.85;
const LOW  = parseFloat($env.CONFIDENCE_THRESHOLD_LOW)  || 0.60;

for (const item of items) {
  if (item.json.parse_error || !item.json.ai_result) {
    errorLog.push(item); continue;
  }

  // Revision Drift Protection
  if (item.json.excel_revision !== undefined) {
    const expectedRev = (item.json.current_db_revision || 0) + 1;
    if (parseInt(item.json.excel_revision) !== expectedRev) {
      reviewQueue.push({
        ...item,
        json: { ...item.json, review_reason: `Revision drift: Excel=${item.json.excel_revision}, Expected=${expectedRev}` }
      });
      continue;
    }
  }

  const ai = item.json.ai_result;
  if (ai.confidence >= HIGH && ai.is_valid === true) {
    autoIngest.push(item);
  } else if (ai.confidence >= LOW) {
    reviewQueue.push({ ...item, json: { ...item.json, review_reason: `Confidence ${ai.confidence.toFixed(2)} < ${HIGH}` } });
  } else {
    rejectLog.push({
      ...item,
      json: { ...item.json, reject_reason: ai.is_valid === false ? 'AI marked invalid' : `Confidence ${ai.confidence.toFixed(2)} < ${LOW}` }
    });
  }
}

// Output 0: Auto Ingest | 1: Review Queue | 2: Reject Log | 3: Error Log
return [autoIngest, reviewQueue, rejectLog, errorLog];
```

---

### 4.8 Node 5A: Auto Ingest + Idempotency + Checkpoint

**HTTP Request Node (Patch — Idempotency-Key Header + source_file_path):**
```json
{
  "method": "POST",
  "url": "={{ $env.BACKEND_URL }}/api/correspondences/import",
  "authentication": "genericCredentialType",
  "genericAuthType": "lcbp3MigrationToken",
  "sendHeaders": true,
  "headers": {
    "Idempotency-Key": "={{ $json.document_number }}:{{ $env.MIGRATION_BATCH_ID }}"
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": {
    "document_number":   "={{ $json.document_number }}",
    "title":             "={{ $json.ai_result.suggested_title || $json.title }}",
    "category":          "={{ $json.ai_result.suggested_category }}",
    "source_file_path":  "={{ $json.file_path }}",
    "ai_confidence":     "={{ $json.ai_result.confidence }}",
    "ai_issues":         "={{ $json.ai_result.detected_issues }}",
    "migrated_by":       "SYSTEM_IMPORT",
    "batch_id":          "={{ $env.MIGRATION_BATCH_ID }}",
    "details":           {
      "legacy_number":   "={{ $json.legacy_document_number }}"
    }
  },
  "options": { "timeout": 30000, "retry": { "count": 3, "delay": 5000 } }
}
```

> Backend จะ generate UUID, enforce Storage path `/storage/{project}/{category}/{year}/{month}/{uuid}.pdf`, move file ผ่าน StorageService และบันทึก Audit Log `action=IMPORT, source=MIGRATION`

**Checkpoint Code Node (ทุก 10 Records):**
```javascript
const item = $input.first();
return [{ json: {
  ...item.json,
  should_update_checkpoint: item.json.original_index % 10 === 0,
  checkpoint_index: item.json.original_index
}}];
```

**IF Node → MariaDB Checkpoint:**
```sql
INSERT INTO migration_progress (batch_id, last_processed_index, status)
VALUES ('{{ $env.MIGRATION_BATCH_ID }}', {{ $json.checkpoint_index }}, 'RUNNING')
ON DUPLICATE KEY UPDATE last_processed_index = {{ $json.checkpoint_index }}, updated_at = NOW();
```

---

### 4.9 Node 5B: Review Queue (Temporary Table)

> ⚠️ ห้ามสร้าง Correspondence record — รอ Admin Approve แล้วค่อย POST `/api/correspondences/import`

```sql
INSERT INTO migration_review_queue
  (document_number, title, original_title, ai_suggested_category,
   ai_confidence, ai_issues, review_reason, status, created_at)
VALUES (
  '{{ $json.document_number }}',
  '{{ $json.ai_result.suggested_title || $json.title }}',
  '{{ $json.title }}',
  '{{ $json.ai_result.suggested_category }}',
   {{ $json.ai_result.confidence }},
  '{{ JSON.stringify($json.ai_result.detected_issues) }}',
  '{{ $json.review_reason }}',
  'PENDING', NOW()
)
ON DUPLICATE KEY UPDATE status = 'PENDING', review_reason = '{{ $json.review_reason }}';
```

---

#### 4.10 Node 5C: Reject Log → `/share/np-dms/n8n/migration_logs/`

```javascript
const fs   = require('fs');
const item = $input.first();
const csvPath = '/share/np-dms/n8n/migration_logs/reject_log.csv';
const header  = 'timestamp,document_number,title,reject_reason,ai_confidence,ai_issues\n';
const esc = (s) => `"${String(s||'').replace(/"/g,'""')}"`;

if (!fs.existsSync(csvPath)) fs.writeFileSync(csvPath, header, 'utf8');

const line = [
  new Date().toISOString(),
  esc(item.json.document_number), esc(item.json.title),
  esc(item.json.reject_reason),
  item.json.ai_result?.confidence ?? 'N/A',
  esc(JSON.stringify(item.json.ai_result?.detected_issues || []))
].join(',') + '\n';

fs.appendFileSync(csvPath, line, 'utf8');
return [$input.first()];
```

---

#### 4.11 Node 5D: Error Log → `/share/np-dms/n8n/migration_logs/` + MariaDB

```javascript
const fs   = require('fs');
const item = $input.first();
const csvPath = '/share/np-dms/n8n/migration_logs/error_log.csv';
const header  = 'timestamp,document_number,error_type,error_message,raw_ai_response\n';
const esc = (s) => `"${String(s||'').replace(/"/g,'""')}"`;

if (!fs.existsSync(csvPath)) fs.writeFileSync(csvPath, header, 'utf8');

const line = [
  new Date().toISOString(),
  esc(item.json.document_number),
  esc(item.json.error_type || 'UNKNOWN'),
  esc(item.json.error || item.json.parse_error),
  esc(item.json.raw_ai_response || '')
].join(',') + '\n';

fs.appendFileSync(csvPath, line, 'utf8');
return [$input.first()];
```

**MariaDB Node:**
```sql
INSERT INTO migration_errors
  (batch_id, document_number, error_type, error_message, raw_ai_response, created_at)
VALUES (
  '{{ $env.MIGRATION_BATCH_ID }}', '{{ $json.document_number }}',
  '{{ $json.error_type || "UNKNOWN" }}', '{{ $json.error || $json.parse_error }}',
  '{{ $json.raw_ai_response || "" }}', NOW()
);
```

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
UPDATE users SET is_active = false WHERE username = 'migration_bot';
        │
        ▼
[MariaDB: Delete File Records]
DELETE FROM correspondence_files WHERE correspondence_id IN
  (SELECT id FROM correspondences WHERE created_by = 'SYSTEM_IMPORT');
        │
        ▼
[MariaDB: Delete Correspondence Records]
DELETE FROM correspondences WHERE created_by = 'SYSTEM_IMPORT';
        │
        ▼
[MariaDB: Clear Idempotency Records]
DELETE FROM import_transactions WHERE batch_id = '{{$env.MIGRATION_BATCH_ID}}';
        │
        ▼
[MariaDB: Reset Checkpoint + Fallback State]
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

## 📌 ส่วนที่ 6: End-of-Night Summary (06:30 ทุกวัน)

**MariaDB:**
```sql
SELECT
  mp.last_processed_index AS total_progress,
  (SELECT COUNT(*) FROM correspondences
   WHERE created_by = 'SYSTEM_IMPORT' AND DATE(created_at) = CURDATE()) AS auto_ingested,
  (SELECT COUNT(*) FROM migration_review_queue WHERE DATE(created_at) = CURDATE()) AS sent_to_review,
  (SELECT COUNT(*) FROM migration_errors
   WHERE batch_id = '{{ $env.MIGRATION_BATCH_ID }}' AND DATE(created_at) = CURDATE()) AS errors
FROM migration_progress mp WHERE mp.batch_id = '{{ $env.MIGRATION_BATCH_ID }}';
```

**Code Node (Build Report):**
```javascript
const s = $input.first().json;
const total = 20000;
const pct = ((s.total_progress / total) * 100).toFixed(1);
const nightsLeft = Math.ceil((total - s.total_progress) / (8 * 3600 / 3));

const report = `
📊 Migration Night Summary — ${new Date().toLocaleDateString('th-TH')}
${'─'.repeat(50)}
✅ Auto Ingested   : ${s.auto_ingested}
🔍 Sent to Review  : ${s.sent_to_review}
❌ Errors          : ${s.errors}
─────────────────────────────────────────────────
📈 Progress  : ${s.total_progress} / ${total} (${pct}%)
🌙 Est. Nights Left: ~${nightsLeft} คืน
${'─'.repeat(50)}
${s.errors > 50 ? '⚠️  WARNING: High error count — investigate before next run' : '✅ Error rate OK'}
`;
return [{ json: { report, stats: s } }];
```

---

## 📌 ส่วนที่ 7: Monitoring (Hourly Alert — เฉพาะเมื่อเกิน Threshold)

**Code Node (Evaluate):**
```javascript
const s = $input.first().json;
const alerts = [];

if (s.minutes_since_update > 30)
  alerts.push(`⚠️ No progress for ${s.minutes_since_update} min — may be stuck`);
if (s.is_fallback_active)
  alerts.push(`⚠️ Fallback model active — errors: ${s.recent_error_count}`);
if (s.recent_error_count >= 20)
  alerts.push(`🔴 Critical: ${s.recent_error_count} errors — consider stopping`);

return [{ json: { ...s, has_alerts: alerts.length > 0, alerts } }];
```

**IF `has_alerts = true` → Email Alert ทันที**

---

## 📌 ส่วนที่ 8: Pre-Production Checklist

| ลำดับ | รายการทดสอบ                                   | ผลลัพธ์ที่คาดหวัง           | ✅/❌ |
| --- | --------------------------------------------- | ---------------------- | --- |
| 1   | Pre-flight ผ่านทุก Check                        | All green              |     |
| 2   | `GET /api/meta/categories` สำเร็จ               | categories array ไม่ว่าง |     |
| 3   | Enum ใน Prompt ไม่ hardcode                    | ตรงกับ Backend          |     |
| 4   | Idempotency: รัน Batch ซ้ำ                       | ไม่สร้าง Revision ซ้ำ      |     |
| 5   | Storage path ตาม Spec                         | UUID + /year/month/    |     |
| 6   | Audit Log มี `action=IMPORT, source=MIGRATION` | Verified               |     |
| 7   | Review Queue ไม่สร้าง record อัตโนมัติ             | Verified               |     |
| 8   | Revision drift → Review Queue                 | Verified               |     |
| 9   | Error ≥ 5 → Fallback Model สลับ                | mistral:7b active      |     |
| 10  | Reject/Error CSV เขียนลง `migration_logs/`     | ไม่ใช่ `staging_ai/`     |     |
| 11  | Rollback Guard ต้องพิมพ์ CONFIRM_ROLLBACK        | Block ทำงาน             |     |
| 12  | Night Summary 06:30 + Est. nights left        | Email ถึง Admin         |     |
| 13  | Monitoring Alert เฉพาะเกิน Threshold           | ไม่ spam ทุกชั่วโมง        |     |
| 14  | Nginx Rate Limit `burst=5`                    | Configured             |     |
| 15  | Docker `mem_limit=2g` + log rotation          | Configured             |     |

**คำสั่งทดสอบ:**
```bash
# Ollama
docker exec -it n8n-migration curl http://<ASUSTOR_IP>:11434/api/tags

# RO mount
docker exec -it n8n-migration ls /data/dms/staging_ai | head -5

# RW mount
docker exec -it n8n-migration sh -c "echo ok > /data/dms/migration_logs/test.txt && echo '✅ rw OK'"

# DB
docker exec -it n8n-migration mysql -h <DB_IP> -u migration_bot -p -e "SELECT 1"

# Backend + Category endpoint
curl -H "Authorization: Bearer <TOKEN>" https://<BACKEND>/api/meta/categories
```

---

## 📌 ส่วนที่ 9: การรันงานจริง

### 9.1 Daily Operation

| เวลา  | กิจกรรม                         | ผู้รับผิดชอบ            |
| ----- | ------------------------------ | ------------------- |
| 08:00 | ตรวจสอบ Night Summary Email    | Admin               |
| 09:00 | Approve/Reject ใน Review Queue | Document Controller |
| 17:00 | ตรวจ Disk Space + GPU Temp     | DevOps              |
| 22:00 | Workflow เริ่มรันอัตโนมัติ           | System              |
| 06:30 | Night Summary Report ส่ง Email  | System              |

### 9.2 Emergency Stop

```bash
# 1. หยุด n8n
docker stop n8n-migration

# 2. Disable Token
mysql -h <DB_IP> -u root -p \
  -e "UPDATE users SET is_active = false WHERE username = 'migration_bot';"

# 3. Progress
mysql -h <DB_IP> -u root -p \
  -e "SELECT * FROM migration_progress WHERE batch_id = 'migration_20260226';"

# 4. Errors
mysql -h <DB_IP> -u root -p \
  -e "SELECT * FROM migration_errors ORDER BY created_at DESC LIMIT 20;"

# 5. Rollback ผ่าน Webhook
curl -X POST http://<NAS_IP>:5678/webhook/rollback \
  -H "Content-Type: application/json" \
  -d '{"confirmation":"CONFIRM_ROLLBACK"}'
```

---

## 📞 การติดต่อสนับสนุน

| ปัญหา            | ช่องทางติดต่อ                                  |
| --------------- | ------------------------------------------- |
| Technical Issue | DevOps Team (Slack: #migration-support)     |
| Data Issue      | Document Controller (Email: dc@lcbp3.local) |
| Security Issue  | Security Team (Email: security@lcbp3.local) |

---

**เอกสารฉบับนี้จัดทำขึ้นเพื่อรองรับ Migration ตาม ADR-017 และ 03-04**
**Version:** 1.8.0 | **Last Updated:** 2026-02-27 | **Author:** Development Team
