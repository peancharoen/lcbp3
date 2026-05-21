# ADR-027: AI Admin Panel and Dynamic Control Architecture

**Status:** Accepted
**Date:** 2026-05-20
**Decision Makers:** Development Team, System Architect, DevOps Engineer
**Related Documents:**
- [CONTEXT-ADR-027: AI Admin Panel Development Plan](./CONTEXT-ADR-027.md)
- [ADR-023A: Unified AI Architecture — Model Revision](./ADR-023A-unified-ai-architecture.md)
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md)
- [ADR-016: Security & Authentication](./ADR-016-security-authentication.md)
- [ADR-009: Database Migration Strategy](./ADR-009-database-migration-strategy.md)
- [ADR-008: Email & Notification Strategy (BullMQ)](./ADR-008-email-notification-strategy.md)

> **หมายเหตุ:** ADR นี้กำหนดสถาปัตยกรรมการพัฒนาแผงควบคุมระบบ AI (AI Admin Panel) สำหรับสิทธิ์ **Superadmin** เท่านั้น เพื่อใช้ในการควบคุมความพร้อมใช้งานของบริการ AI แบบ Dynamic, ตรวจสอบสุขภาพระบบโครงสร้างพื้นฐาน (Ollama/Qdrant/BullMQ) และการรัน Sandbox ทดสอบภายใต้สภาพแวดล้อมที่ควบคุมความปลอดภัยสูงสุด

---

## บริบทและปัญหา (Context and Problem Statement)

เนื่องจากระบบปัญญาประดิษฐ์ของโครงการ LCBP3 DMS (Ollama & Qdrant) รันอยู่บนสภาพแวดล้อมแบบ On-premises บนเครื่อง AI Host (`Desk-5439`) ซึ่งมีความเสี่ยงที่จะเกิดเหตุสุดวิสัย เช่น เครื่องล่ม, Latency สูงขึ้นอย่างผิดปกติจากการประมวลผลงานชุดใหญ่ หรือมีความจำเป็นต้องปิดปรับปรุง Prompt หรือตัวโมเดลชั่วคราว

ปัญหากลุ่มนี้ทำให้ระบบต้องการกลไกควบคุมและติดตามดังนี้:
1. **Dynamic Switch:** แอดมินจำเป็นต้องสั่งปิดการให้บริการ AI แก่ผู้ใช้ปกติได้ทันทีโดยไม่ต้องรัน Build หรือ Restart เซิร์ฟเวอร์
2. **Graceful Degradation:** เมื่อปิดระบบ AI, หน้าจอของผู้ใช้ปกติและ API จะต้องปิดตัวลงอย่างสง่างาม ไม่โยนข้อผิดพลาดแปลกๆ ที่ไม่เป็นมิตรต่อผู้ใช้
3. **Isolated Test Laboratory:** ในขณะที่ AI ถูกปิดปรับปรุง แอดมินยังคงต้องการพื้นที่ Sandbox ในการทดสอบประมวลผลจริงเพื่อปรับปรุงความถูกต้อง โดยงานประมวลผลของแอดมินจะต้องไม่ถูกรบกวนจากงานตกค้างของผู้ใช้ทั่วไป หรือทำตัวโมเดลล่ม

---

## ปัจจัยขับเคลื่อนการตัดสินใจ (Decision Drivers)

- **Security Isolation (Tier 1):** แผงควบคุมและ Sandbox ทั้งหมดต้องควบคุมสิทธิ์อย่างเหนียวแน่นสำหรับสิทธิ์ Superadmin เท่านั้น (`system.manage_all`)
- **Latency-free Status Check:** การตรวจสอบสวิตช์เปิด/ปิด AI ใน API ผู้ใช้ภายนอกต้องไม่มี Overhead ในการคิวรีฐานข้อมูลตลอดเวลา
- **User Experience (UX):** หน้าจอผู้ใช้ปกติในฟอร์มเอกสารต้องตอบสนองได้อย่างนุ่มนวล (Soft Fallback) เมื่อ AI ถูกปิด แทนการกดปุ่มแล้วแจ้งเตือนข้อผิดพลาดสีแดง
- **Resource Protection:** การรัน Playground Sandbox ของแอดมินจะต้องไม่ก่อให้เกิด Race Condition หรือโหลดกระแทกบน VRAM ของ GPU RTX 2060 Super (8GB) บนเครื่อง `Desk-5439`

---

## ทางเลือกที่ถูกพิจารณา (Considered Options)

### Option A: Synchronous Direct Sandbox & API Hard Block
- สั่งรัน RAG และ OCR Sandbox ของแอดมินตรงเข้าสู่ API Controller แบบ Synchronous โดยตรง (ไม่ผ่านคิว BullMQ) และเมื่อสวิตช์เปิด/ปิด AI ถูกตั้งค่าเป็นปิดใช้งาน จะทำการซ่อนปุ่มสกัดข้อมูลทั้งหมดในหน้าผู้ใช้ทั่วไปทันที

### Option B: Shared BullMQ Queue & Soft Fallback (ตัวเลือกที่ได้รับเลือก)
- สั่งรัน Sandbox ของแอดมินผ่านคิว `ai-batch` ที่มีอยู่แล้ว (ตาม ADR-023A) โดยใช้ job type `sandbox-rag` และ `sandbox-extract` พร้อม priority สูงกว่างาน batch ปกติ
- จัดทำตาราง `system_settings` โดยเพิ่มลงใน schema file หลัก (ตาม ADR-009) ร่วมกับ Redis Cache และใช้กลไก Polling (ทุก 30 วินาที) ของ Frontend เพื่ออัปเดตสถานะปุ่ม AI Suggestion บนฟอร์มเป็นสถานะ **Disabled (ใช้งานไม่ได้)** พร้อมแสดงข้อความอธิบายความจำเป็นเมื่อชี้เมาส์ (Hover Tooltip)

---

## ผลการตัดสินใจ (Decision Outcome)

**ทางเลือกที่ได้รับเลือก:** **Option B**
เนื่องจากเหตุผลความเสถียรของระบบ VRAM และประสบการณ์การใช้งานที่ดียิ่งขึ้นของผู้ใช้งานทั่วไป (UX) โดยมีตารางวิเคราะห์เปรียบเทียบดังนี้:

| เกณฑ์การประเมิน | Option A (Direct) | Option B (Shared Queue) |
| :--- | :--- | :--- |
| **ความเสถียรของ VRAM บน Desk-5439** | ❌ เสี่ยงล่มหากแอดมินรันโหลดหนักชนกับ Queue ปกติ | ✅ ปลอดภัยสูงสุด ควบคุม Concurrency ของ ai-batch queue ตาม ADR-023A (concurrency=1) |
| **ประสบการณ์การใช้งานทั่วไป (UX)** | ❌ ปุ่มหายกะทันหัน สร้างความสับสนว่าฟีเจอร์หายไปไหน | ✅ แสดงปุ่ม disabled + Tooltip ชี้แจง ทำให้เกิดความเข้าใจและเป็นมิตร |
| **การจำลองโหลดการทำงานจริง** | ❌ ไม่มีการเข้าคิว ไม่สะท้อนความเร็วจริงในสถานการณ์จริง | ✅ สะท้อนพฤติกรรมความเร็วจริงของคิวและ VRAM ได้แม่นยำ 100% |
| **ประสิทธิภาพของ Backend API** | ❌ เช็ค DB ทุกครั้งสร้าง Overhead | ✅ เช็คผ่าน Redis Cache คืนสถานะภายใน <1ms |
| **ความสอดคล้องกับ ADR-023A** | ❌ ไม่สอดคล้องกับ 2-Queue Architecture | ✅ สอดคล้องกับ ADR-023A (ใช้ ai-batch queue ร่วมกัน) |

---

## รายละเอียดเชิงสถาปัตยกรรม (Implementation Details)

### 1. โครงสร้างข้อมูลตาราง `system_settings` (Refined)
ระบบจะนำเสนอตารางเก็บข้อมูลการตั้งค่าระบบแบบรวมศูนย์ (generic) เพื่อรองรับ settings อื่นๆ ในอนาคต (ตามมาตรฐาน ADR-009) ดังนี้:
- **Persistence Layer:** เพิ่มตาราง `system_settings` ใน `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` โดยตรง (ไม่ใช้ migration file แยก)
- **Caching Layer:** จัดเก็บค่าแยกเป็น Redis Key ต่อ setting (เช่น `system_settings:AI_FEATURES_ENABLED`, `system_settings:MAX_UPLOAD_SIZE`) เพื่อให้อ่านค่าได้เร็วในระดับไมโครวินาที (Microseconds) เมื่อ API Guard เรียกตรวจสอบ

```
[Client App] ---> [API Guard] ---> [Redis Cache (Key: system_settings:AI_FEATURES_ENABLED)]
                        |
                        +--(Miss)--> [MariaDB (system_settings)]
```

**Schema Design (Generic):**
```sql
CREATE TABLE system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  setting_key VARCHAR(100) NOT NULL UNIQUE COMMENT 'คีย์การตั้งค่าระบบ (เช่น AI_FEATURES_ENABLED, MAX_UPLOAD_SIZE)',
  setting_value TEXT NOT NULL COMMENT 'ค่าที่บันทึก (stringified)',
  data_type ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string' COMMENT 'ประเภทข้อมูลสำหรับ validation',
  category VARCHAR(50) COMMENT 'หมวดหมู่ (เช่น ai, security, storage, notification)',
  is_encrypted TINYINT(1) DEFAULT 0 COMMENT 'เข้ารหัสค่า sensitive (เช่น API keys)',
  validation_rules JSON COMMENT 'กฎ validation (min, max, allowed_values)',
  description TEXT COMMENT 'คำอธิบายข้อมูลการตั้งค่า',
  is_public TINYINT(1) DEFAULT 0 COMMENT 'เผยแพร่ให้ frontend อ่านได้ (หรือ admin only)',
  updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_category (category),
  INDEX idx_is_public (is_public)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บข้อมูลการตั้งค่าระบบไดนามิก';
```

### 2. ระบบคิว Sandbox ร่วมกัน (Shared Queue)
ระบบจะใช้คิว `ai-batch` ที่มีอยู่แล้ว (ตาม ADR-023A) สำหรับงาน Sandbox ของแอดมิน โดย:
- เพิ่ม job type `sandbox-rag` สำหรับคำถาม RAG ใน Playground
- เพิ่ม job type `sandbox-extract` สำหรับ OCR/Extraction ใน Sandbox
- ใช้ priority **SUPERADMIN** (ระดับใหม่ higher than HIGH) สำหรับงาน Sandbox เพื่อให้ได้รับการประมวลผลก่อนงาน batch ปกติโดยไม่ jump queue
- Processor ใน `ai-batch.processor.ts` จะจัดการ job types เหล่านี้เพิ่มเติม
- Concurrency คงที่ที่ 1 ตาม ADR-023A เพื่อป้องกัน VRAM overload
- **Dynamic Rate Limiting:** ตรวจสอบความยาวคิว `ai-batch` ก่อน allow request (queue length < 3 → no limit, queue length ≥ 3 → 10 requests/hour)

### 3. มาตรการควบคุมสิทธิ์ (Security Controls)
- การสลับสวิตช์ AI และการยิง Sandbox Endpoints ทั้งหมดจะถูกปิดกั้นอย่างเข้มงวดด้วยการเช็ค JWT Token และการใช้ `@RequirePermission('system.manage_all')` (CASL Guard)
- **AiEnabledGuard Layered Check:** Superadmin ต้องมีทั้ง `system.manage_all` **และ** `ai.suggest`/`ai.rag_query` เพื่อ bypass เมื่อ AI disabled
- **Admin Endpoints:** ไม่ใช้ AiEnabledGuard (ใช้ permission guard `system.manage_all` เพียงพอ)
- **Job Polling:** ไม่ block job status requests (audit trail ไม่ใช่ AI inference)
- ห้ามระบุ ID หลักเป็น Integer PK ในการทำงาน (เช่น การทดสอบ RAG หรือ Sandbox ประมวลผล) แต่จะใช้ UUIDv7 `publicId` ในการระบุโครงการและจัดกลุ่มเสมอตามข้อตกลง **ADR-019 (Hybrid Identifier Strategy)**

---

## Grilling Session Decisions (2026-05-21)

การตัดสินใจต่อไปนี้ได้รับการ refine ผ่าน grilling session เพื่อความชัดเจนและความพร้อมในการ implement:

| # | ประเด็น | การตัดสินใจ |
|---|---------|--------------|
| 1 | Infrastructure Dependency | ADR-023A infrastructure มีอยู่แล้ว (ai-realtime, ai-batch, permissions) ✅ |
| 2 | system_settings Schema | Generic พร้อม `data_type`, `category`, `is_encrypted`, `validation_rules`, `is_public` |
| 3 | Redis Cache Strategy | Cache แยก key ต่อ setting (เช่น `system_settings:AI_FEATURES_ENABLED`) |
| 4 | Security Controls | Dynamic rate limiting ขึ้นกับ queue length (queue < 3 → no limit, queue ≥ 3 → 10 req/hr) |
| 5 | Frontend Polling | Poll เฉพาะ users ที่มี AI permissions (ทุก 30 วินาที) |
| 6 | AiEnabledGuard | Layered check (system.manage_all + ai.suggest/ai.rag_query) |
| 7 | Error Handling | HTTP 503 + rate-limited warn logs (10 req/user/min) + custom banner debounce 5s |
| 8 | Cache Invalidation | Invalid หลัง DB success (TypeORM transaction) + single key + ยอมรับ 30s latency |
| 9 | Sandbox Priority | Priority ระดับใหม่ `SUPERADMIN` (higher than HIGH) |
| 10 | Health Check | 5s timeout per service + 30s cache + basic queue metrics (waiting, active, failed, rate) |
| 11 | UI/UX | Single page layout + 5s job polling + inline error (red box) + toast |
| 12 | Implementation Priority | Phased (backend → frontend) |

---

## Refined Implementation Details

### 4. AiEnabledGuard Implementation
**Logic:**
```typescript
const aiEnabled = await this.getAiFeaturesEnabled(); // from Redis/DB
const isSuperadmin = user.permissions.includes('system.manage_all');
const hasAiPermission = user.permissions.includes('ai.suggest') || user.permissions.includes('ai.rag_query');

if (!aiEnabled && !(isSuperadmin && hasAiPermission)) {
  throw new ServiceUnavailableException({
    message: 'AI features are temporarily unavailable',
    userMessage: 'ระบบ AI ไม่พร้อมใช้งานชั่วคราว กรุณากรอกข้อมูลด้วยตนเอง',
    recoveryAction: 'ติดต่อผู้ดูแลระบบหากต้องการความช่วยเหลือ'
  });
}
```

**Error Response (ADR-007):**
- HTTP Status: `503 Service Unavailable`
- Logging: `warn` level แต่ rate limit (log ทุก 10 ครั้งต่อ user ต่อนาที)
- Frontend: Custom Global Banner + debounce 5 วินาที

### 5. Cache Invalidation Strategy
**Timing:** Invalid Redis cache หลัง DB update success (TypeORM transaction)
**Scope:** Invalid เฉพาะ key `system_settings:AI_FEATURES_ENABLED` (efficient)
**Frontend Sync:** ยอมรับ latency 30 วินาที (polling strategy เพียงพอสำหรับ use case นี้)

### 6. Health Check Service
**Timeout:** 5 วินาที per service → timeout return `DEGRADED` (not `DOWN`)
**Frequency:** Cache 30 วินาที (synchronized กับ AI status polling)
**Queue Metrics:** Basic metrics (waiting, active, failed) + processing rate (jobs/second)
**Services:** Ollama (Desk-5439), Qdrant (Desk-5439), BullMQ (ai-realtime, ai-batch)

### 7. Frontend Polling Strategy
**Condition:** Poll เฉพาะ users ที่มี `ai.suggest` หรือ `ai.rag_query` permission
**Frequency:** ทุก 30 วินาที
**Cache:** React Context + refresh on mount
**Implementation:** `useAiStatus()` hook ใน `SessionProvider`

### 8. Admin Console UI/UX
**Layout:** Single page พร้อม tabs (RAG Playground / OCR Sandbox)
**Job Polling:** 5 วินาที (reasonable balance ระหว่าง real-time และ performance)
**Error Display:** Inline error ใน output area (red box) + toast notification
**Style:** Glassmorphism + Health Indicators + Header Switch
