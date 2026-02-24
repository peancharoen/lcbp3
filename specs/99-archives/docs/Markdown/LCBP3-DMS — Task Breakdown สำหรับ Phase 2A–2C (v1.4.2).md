# LCBP3-DMS — Task Breakdown สำหรับ Phase 2A–2C (v1.4.2)

เอกสารนี้เป็นรายละเอียด Task Breakdown เชิงลึกของ Phase 2A, 2B, 2C ที่ถูกแยกออกตามสถาปัตยกรรม v1.4.2

โครงสร้างประกอบด้วย:

* Objectives
* Deliverables
* Task Breakdown (ละเอียดเป็นลำดับงาน)
* Developer Checklist
* Test Coverage
* Dependencies & Risks

---

# 🟦 Phase 2A — Security Layer

**Objective:** วาง Security Foundation ให้ระบบทั้งหมดใช้ร่วมกัน: Validation Pipeline, Security Headers, Rate Limiting, Request Guards

## ✔ Deliverables

* Global ValidationPipe
* Sanitization Layer
* Rate Limit Rules (anonymous/authenticated)
* Security Headers (Helmet)
* XSS / SQL Injection safeguards
* Security Tests

## 🛠 Task Breakdown

### 2A.1 Validation Pipeline

* ตั้งค่า Global ValidationPipe
* เปิด whitelist, forbidNonWhitelisted
* เพิ่ม custom exception mapping → ErrorModel
* เชื่อม RequestIdInterceptor

### 2A.2 Input Sanitization Layer

* ติดตั้ง sanitize-html หรือ DOMPurify server-side
* เพิ่ม sanitization middleware สำหรับ:

  * query params
  * body JSON
  * form inputs
* เพิ่ม unit test: sanitized input → safe output

### 2A.3 Security Headers (Helmet)

* เปิดใช้งาน Helmet ทั้งระบบ
* ปรับ policy: `contentSecurityPolicy`, `xssFilter`, `noSniff`
* เพิ่ม config per environment

### 2A.4 Rate Limiting

* Rate limit แบบ 2 ชั้น:

  * anonymous (เช่น 30 req/min)
  * authenticated (100 req/min)
* สร้าง Redis key pattern: `ratelimit:{ip}`
* สร้าง RateLimitGuard + decorator
* ทดสอบ burst traffic (locust หรือ autocannon)

### 2A.5 SQL Injection / XSS Protection

* เปิด TypeORM parameterized queries
* Sanitizer ตรวจจับ script tags
* เขียน test ที่ inject payload จำลอง

### 2A.6 Logging + Error Model Integration

* ผูก SecurityException → Error Model
* เพิ่ม request_id logging

## ✔ Developer Checklist (Phase 2A)

* [ ] ทุก controller มี ValidationPipe ครอบ
* [ ] Sanitization ทำงานในทุก input source
* [ ] Error ทั้งหมดออกตาม Error Model กลาง
* [ ] RateLimitGuard ทำงานผ่าน Redis
* [ ] มี security test อย่างน้อย 10 ชุด

## ✔ Test Coverage (Phase 2A)

* Input injection tests
* Rate limit tests
* Validation rejects undefined fields
* ErrorModel mapping

---

# 🟪 Phase 2B — JSON Schema System

**Objective:** จัดการ JSON Schema แบบ versioned, ตรวจสอบ payload, บังคับใช้ format ก่อนเก็บ DB

## ✔ Deliverables

* Schema Registry
* Schema Versioning
* Schema Validation Service
* Compatibility Rules
* Schema Migration Tests

## 🛠 Task Breakdown

### 2B.1 Schema Registry

* Entity: `json_schemas`, `json_schema_versions`
* Endpoint: `POST /json-schemas`
* ฟิลด์สำคัญ: schema_id, version, schema_json
* สร้าง SchemaStore class

### 2B.2 Schema Versioning

* Version rule: semantic versioning (major.minor.patch)
* Migration notes per version
* นโยบาย: Breaking change → major bump
* API: `GET /json-schemas/:id?version=`

### 2B.3 Schema Validation Service

* ใช้ AJV หรือ Fastest-Validator
* preload schema เมื่อ boot server
* mapping validation error → Error Model
* เพิ่ม test: invalid schema / missing fields / wrong types

### 2B.4 Compatibility Rules

* ตรวจสอบ backward compatibility:

  * field removal → major version
  * enum shrink → major version
* เพิ่ม script ตรวจ schema diff

### 2B.5 Schema Migration Tests

* ทดสอบ schema upgrade (v1 → v2)
* ทดสอบ payload ที่ใช้ version เก่า

## ✔ Developer Checklist (Phase 2B)

* [ ] ทุก JSON field อ้างอิง schema version
* [ ] ทุก schema ผ่าน validation
* [ ] Schema diff pass
* [ ] Schema test ครอบครบทุก field

## ✔ Test Coverage (Phase 2B)

* Schema version switch tests
* Incompatible payload rejection
* Schema registry CRUD

---

# 🟧 Phase 2C — JSON Processing

**Objective:** จัดการ JSON payload: sanitization, compression, encryption, size limits

## ✔ Deliverables

* JSON size validator
* JSON sanitizer
* JSON compressor (gzip/deflate)
* Sensitive fields encryption
* JSON transformation layer

## 🛠 Task Breakdown

### 2C.1 JSON Size Controls

* ตั้ง global limit (เช่น 2MB ต่อฟิลด์)
* เพิ่ม JSONSizeGuard
* เขียน test: oversize JSON → error_code: `JSON.TOO_LARGE`

### 2C.2 JSON Sanitization (ลึกกว่า Phase 2A)

* ล้าง nested fields
* ล้าง `<script>`, `<iframe>`, inline JS
* รองรับ JSON array sanitization

### 2C.3 Compression Layer

* ใช้ gzip ด้วย `zlib`
* เก็บ compressed JSON ใน DB
* สร้าง helper: `compressJson()`, `decompressJson()`
* Test: compression ratio > 30%

### 2C.4 Sensitive Fields Encryption

* AES-256-GCM สำหรับฟิลด์ที่กำหนด เช่น:

  * personal fields
  * confidential fields
* สร้าง decorator: `@EncryptedField()`
* Test: decrypt → original JSON

### 2C.5 JSON Transformation Layer

* Map JSON fields → internal format
* ใช้กับ Correspondence / RFA
* รองรับ schema version migration (เชื่อมกับ Phase 2B)

## ✔ Developer Checklist (Phase 2C)

* [ ] JSON size guard ครอบทุก endpoint
* [ ] Compression + encryption ทำงานก่อน persist
* [ ] Sanitizer ผ่าน nested objects
* [ ] Transform layer มี test ครบ

## ✔ Test Coverage (Phase 2C)

* Oversize JSON tests
* Encryption/decryption tests
* Compression tests
* Schema-versioned transformation tests

---

# 🔗 Dependencies

* Phase 2A → จำเป็นก่อน 2B, 2C
* Phase 2B → ต้องเสร็จเพื่อให้ 2C ทำ transformation

---

# ⚠ Risks

* Schema versioning อาจกระทบ payload เดิม → ต้องมี migration plan
* Compression/encryption ทำให้ debug ยาก → ต้องพึ่ง request_id + audit logs
* Rate limiting ไม่เหมาะสมอาจ block ผู้ใช้จริง

---

เอกสารนี้พร้อมใช้วางแผน Sprint สำหรับทีมพัฒนา หรือสร้าง Gantt Chart ต่อได้ทันที
