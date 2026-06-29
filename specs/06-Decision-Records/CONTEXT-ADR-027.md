# แผนการพัฒนา: AI Admin Panel (สำหรับสิทธิ์ Superadmin เท่านั้น)

แผนงานนี้จัดทำขึ้นเพื่อแสดงแนวทางการพัฒนาและติดตั้งระบบ **AI Admin Panel** เพื่อให้ผู้ดูแลระบบสูงสุด (Superadmin) สามารถตรวจสอบสถานะการทำงานของเครื่อง AI Host (`Desk-5439`), เปิด/ปิดการใช้งานฟีเจอร์ AI สำหรับผู้ใช้ทั่วไปได้แบบไดนามิก, ตรวจสอบคิวงานของ BullMQ และเวกเตอร์ใน Qdrant รวมถึงมีห้องทดสอบ (Playground Sandbox) ส่วนตัวสำหรับประมวลผล RAG และสกัด Metadata ของเอกสาร

---

## 🎯 วัตถุประสงค์และข้อกำหนดทางเทคนิค

1. **การตรวจสอบสถานะระบบ AI (Health Check):**
   - พัฒนาระบบตรวจสอบสุขภาพการเชื่อมต่อและความเร็ว (Latency) ของระบบ **Ollama** และ **Qdrant** บนเครื่อง `Desk-5439`
   - ตรวจสอบสถานะและความยาวคิวงานของ **BullMQ** ทั้งหมดในระบบ รวมถึงคิวสำหรับห้องทดสอบของแอดมิน
2. **ปุ่มสวิตช์เปิด/ปิดการตั้งค่า AI (Dynamic Toggle Switch):**
   - บันทึกสถานะการเปิด/ปิดลงในฐานข้อมูลตารางใหม่ `system_settings` พร้อมจัดทำ Cache ในระบบ Redis เพื่อการตรวจสอบที่รวดเร็วและไม่มี Latency
   - หากแอดมินตั้งค่าเป็น **ปิดใช้งาน AI (false)**:
     - **ฝั่งผู้ใช้ทั่วไป (UX Soft Fallback):** ปุ่มขอคำแนะนำจาก AI (AI Suggestion) ในหน้าจอสร้างหรือแก้ไขเอกสาร (RFA / Correspondence) จะเปลี่ยนสถานะเป็น **Disabled (ใช้งานไม่ได้)** และเมื่อผู้ใช้ชี้เมาส์ (Hover) จะมีข้อความแจ้งเตือนสีเหลือง/ส้มว่า `"⚠️ ระบบ AI ไม่พร้อมใช้งานชั่วคราว กรุณากรอกข้อมูลด้วยตนเอง"` พร้อมกับแสดงแถบแจ้งเตือน **Global Banner** ด้านบนสุดของระบบ
     - **ฝั่ง API (Block Protection):** ตรวจสอบผ่าน Guard หากผู้ใช้ทั่วไปพยายามเรียกยิง API AI จะตอบกลับด้วยรหัส **HTTP 503 Service Unavailable** ทันที
     - **การซิงก์ข้อมูล (Frontend Sync):** Frontend จะใช้ระบบ **Polling ดึงข้อมูลเช็คสถานะระบบทุกๆ 30 วินาที** เพื่อตรวจสอบและปรับเปลี่ยนหน้าจออัตโนมัติ
     - **สิทธิ์แอดมิน (Superadmin Bypass):** แอดมินที่มีสิทธิ์ Superadmin จะยังคงเข้าถึงและใช้งานห้องทดสอบ Sandbox ได้ตามปกติ แม้ว่าระบบด้านนอกจะถูกปิดให้บริการอยู่ก็ตาม
3. **ห้องทดสอบส่วนตัวระบบคิวแยก (Isolated BullMQ Sandbox Queue):**
   - การสั่งประมวลผลคำถาม RAG และการอัปโหลดไฟล์ PDF สกัด Metadata ใน Sandbox ของแอดมิน จะส่งงานเข้าคิว BullMQ แยกเฉพาะตัวชื่อ `ai-admin-sandbox` เพื่อจำลองโหลดและความเร็วในการทำงานจริงของระบบคิว แต่แยกคิวออกมาเพื่อไม่ให้โดนบล็อกจากคิวค้างของผู้ใช้งานปกติในระบบ

---

## 📐 รายละเอียดการเปลี่ยนแปลงในระบบ (Proposed Changes)

### 🗄️ 1. โครงสร้างฐานข้อมูล (Database Layer)

เพิ่มตาราง `system_settings` ในฐานข้อมูล MariaDB เพื่อเก็บค่าการตั้งค่าแบบไดนามิก (ตามแนวทาง ADR-009)

#### [MODIFY] [lcbp3-v1.9.0-schema-02-tables.sql](file:///E:/np-dms/lcbp3/specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql)
เพิ่มตาราง `system_settings` ในส่วน Users & RBAC (หลังตาราง permissions):

```sql
-- ตารางเก็บการตั้งค่าระบบแบบไดนามิก (System Settings) - Generic Design
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
  FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL,
  INDEX idx_category (category),
  INDEX idx_is_public (is_public)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บข้อมูลการตั้งค่าระบบไดนามิก';

-- Seed ค่าเริ่มต้นสำหรับการควบคุมสถานะระบบ AI
INSERT INTO system_settings (setting_key, setting_value, data_type, category, description, is_public)
VALUES ('AI_FEATURES_ENABLED', 'true', 'boolean', 'ai', 'สถานะเปิด/ปิดการใช้งานฟีเจอร์ AI ทั้งระบบ สำหรับผู้ใช้ทั่วไป (true/false)', 1)
ON DUPLICATE KEY UPDATE setting_key = setting_key;
```

**การนำไปใช้งาน:** รัน SQL ด้านบนผ่าน manual execution หรือ n8n workflow ตาม ADR-009

---

### 💻 2. ส่วนของระบบหลังบ้าน (Backend Layer - NestJS)

#### [MODIFY] [queue.constants.ts](file:///E:/np-dms/lcbp3/backend/src/modules/common/constants/queue.constants.ts)
- เพิ่ม priority constant สำหรับ SUPERADMIN:
```typescript
export const PRIORITY_SUPERADMIN = 10; // Higher than HIGH (5)
```

#### [NEW] [system-setting.entity.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/entities/system-setting.entity.ts)
- สร้าง Entity รองรับโครงสร้างตารางใหม่ (ไม่มีบรรทัดว่างในฟังก์ชันตามข้อตกลง):
```typescript
// File: src/modules/ai/entities/system-setting.entity.ts
// Change Log
// - 2026-05-21: สร้าง Entity SystemSetting สำหรับเก็บการตั้งค่า (Generic Design)
import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'setting_key', unique: true, length: 100 })
  settingKey: string;

  @Column({ name: 'setting_value', type: 'text' })
  settingValue: string;

  @Column({
    name: 'data_type',
    type: 'enum',
    enum: ['string', 'number', 'boolean', 'json'],
    default: 'string'
  })
  dataType: string;

  @Column({ name: 'category', length: 50, nullable: true })
  category: string;

  @Column({ name: 'is_encrypted', type: 'tinyint', default: 0 })
  isEncrypted: boolean;

  @Column({ name: 'validation_rules', type: 'json', nullable: true })
  validationRules: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_public', type: 'tinyint', default: 0 })
  isPublic: boolean;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

#### [MODIFY] [ai.module.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/ai.module.ts)
- ลงทะเบียน `SystemSetting` ใน TypeORM `forFeature`

#### [MODIFY] [ai-batch.processor.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/processors/ai-batch.processor.ts)
- เพิ่มการรองรับ job type ใหม่สำหรับ Sandbox:
  - `sandbox-rag` -> ค้นหาในเวกเตอร์และตอบคำถาม RAG พร้อมแสดง Citations (priority: SUPERADMIN)
  - `sandbox-extract` -> รัน OCR บนไฟล์ PDF เดี่ยวและประมวลผลสกัด Metadata คืนออกมาเป็นก้อนข้อมูล JSON (priority: SUPERADMIN)
- **Dynamic Rate Limiting:** เพิ่ม middleware ตรวจสอบความยาวคิว `ai-batch` ก่อน allow sandbox request (queue length < 3 → no limit, queue length ≥ 3 → 10 req/hr)

#### [MODIFY] [ai-queue.service.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/ai-queue.service.ts)
- เพิ่มฟังก์ชัน `enqueueSandboxJob(type: string, payload: any)` เพื่อส่งงานของแอดมินเข้าคิว `ai-batch` พร้อม priority SUPERADMIN
- เพิ่มฟังก์ชัน `getQueueLength(queueName: string)` เพื่อตรวจสอบความยาวคิวสำหรับ dynamic rate limiting

#### [MODIFY] [ai.service.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/ai.service.ts)
- เพิ่มเมธอดสำหรับอ่าน/เขียนการตั้งค่า:
  - `getAiFeaturesEnabled()`: ค้นหาค่า `AI_FEATURES_ENABLED` จาก Redis Key `system_settings:AI_FEATURES_ENABLED` ก่อน หากไม่มีจึงไปดึงจากตาราง `system_settings` แล้วเขียนลง Redis Cache เพื่อใช้ครั้งต่อไป
  - `setAiFeaturesEnabled(enabled: boolean, userId: number)`: อัปเดตสถานะในตารางฐานข้อมูล (TypeORM transaction) และอัปเดต Redis Cache ทันที (invalid key เดียว)
  - `getSystemHealth()`: รวบรวมข้อมูลสุขภาพของระบบ Ollama, Qdrant, และคิว BullMQ ต่างๆ (cache 30 วินาที, 5s timeout per service)

#### [NEW] [ai-enabled.guard.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/guards/ai-enabled.guard.ts)
- สร้าง Guard สำหรับเช็คสถานะการปิด AI ทั่วระบบ:
  - **Layered Check Logic:** Superadmin ต้องมีทั้ง `system.manage_all` **และ** `ai.suggest`/`ai.rag_query` เพื่อ bypass เมื่อ AI disabled
  - หากคีย์การเปิดใช้งานถูกตั้งค่าเป็น `'false'` และผู้ใช้ไม่ผ่าน layered check จะปฏิเสธการเข้าใช้งาน API ด้วยรหัสข้อผิดพลาด **HTTP 503 Service Unavailable**
  - Guard นี้ติดตั้งบน endpoints AI ทั่วไป (AI Suggestion, RAG Query) ไม่ใช่ admin endpoints
  - **Admin Endpoints:** ไม่ใช้ AiEnabledGuard (ใช้ permission guard `system.manage_all` เพียงพอ)
  - **Job Polling:** ไม่ block job status requests (audit trail ไม่ใช่ AI inference)
- **Error Handling (ตาม ADR-007):**
  - Response body ประกอบด้วย: `{ message: "AI features are temporarily unavailable", userMessage: "ระบบ AI ไม่พร้อมใช้งานชั่วคราว กรุณากรอกข้อมูลด้วยตนเอง", recoveryAction: "ติดต่อผู้ดูแลระบบหากต้องการความช่วยเหลือ" }`
  - Backend Logger: `warn` level แต่ rate limit (log ทุก 10 ครั้งต่อ user ต่อนาที) เพื่อป้องกัน log spam
  - Frontend Error Display: Custom Global Banner + debounce 5 วินาที

#### [MODIFY] [ai.controller.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/ai.controller.ts)
- นำ Guard `AiEnabledGuard` ไปติดตั้งใน Endpoints ยิงทำงาน AI ของผู้ใช้ทั่วไป (AI Suggestion, RAG Query)
- เพิ่มกลุ่ม API สำหรับ Superadmin เท่านั้น (ควบคุมด้วย `@RequirePermission('system.manage_all')` ตาม ADR-016):
  - `GET /ai/admin/settings` -> แสดงสถานะเปิด/ปิด AI ปัจจุบัน
  - `POST /ai/admin/toggle` -> สลับสถานะเปิด/ปิดระบบ AI (พร้อม Audit logging)
  - `GET /ai/admin/health` -> ดึงรายงานสุขภาพระบบ Ollama, Qdrant, คิว BullMQ ทั้งระบบ
  - `POST /ai/admin/sandbox/rag` -> ส่งงานคำถาม RAG เข้าคิว ai-batch (priority: SUPERADMIN) + dynamic rate limiting
  - `POST /ai/admin/sandbox/extract` -> ส่ออัปโหลด PDF สกัด metadata เข้าคิว ai-batch (priority: SUPERADMIN) + dynamic rate limiting
  - `GET /ai/admin/sandbox/job/:id` -> Polling ตรวจสอบความคืบหน้าของงานในคิว (ไม่ block)
- **Security Measures (ตาม ADR-016):**
  - ทุก admin endpoints ใช้ `@RequirePermission('system.manage_all')`
  - `POST /ai/admin/toggle` มี Audit logging บันทึกใน `audit_logs` table (action: 'AI_FEATURES_TOGGLED', details: { enabled: boolean })
  - ใช้ `@Audit()` decorator บนทุก admin endpoints
  - มี Rate limiting ตาม ADR-016 (ThrottlerGuard) บน auth endpoints

---

### 🎨 3. ส่วนหน้าจอแสดงผล (Frontend Layer - Next.js)

#### [NEW] [admin-ai.service.ts](file:///E:/np-dms/lcbp3/frontend/lib/services/admin-ai.service.ts)
- พัฒนา API Service สำหรับดึงข้อมูลและสั่งงานของระบบ Admin AI Panel:
  - ดึงข้อมูลสุขภาพ ตรวจสอบการตั้งค่า สลับปุ่มเปิด/ปิด
  - ส่งงาน Sandbox RAG/Extraction และ Polling เช็คผลลัพธ์ของ Job
- **UUID Handling (ตาม ADR-019):**
  - ใช้ `publicId` (string UUID) สำหรับ job ID จาก BullMQ เท่านั้น
  - ห้ามใช้ `id ?? ''` fallback ในกรณีใดๆ

#### [NEW] [page.tsx](file:///E:/np-dms/lcbp3/frontend/app/(admin)/admin/ai/page.tsx)
- หน้าต่าง **AI Control Panel & Playground** ออกแบบอย่างพรีเมียม สไตล์ Glassmorphism:
  - **Layout:** Single page พร้อม tabs (RAG Playground / OCR Sandbox)
  - **Header Switch:** สวิตช์ปุ่มเรืองแสงสีเขียว/ส้มขนาดใหญ่ สำหรับเปิด/ปิดใช้งานระบบ AI
  - **Health Indicators:** การ์ดประเมินสถานะของ Ollama, Qdrant, และ คิว BullMQ แบบเรียลไทม์ (cache 30 วินาที)
  - **RAG Playground Tab:** แชทบอทโต้ตอบผ่าน ai-batch queue พร้อมสถานะความคืบหน้าของคิว (poll ทุก 5 วินาที) แสดงคำตอบและเอกสารอ้างอิงสวยงาม
  - **OCR Sandbox Tab:** กล่องวางอัปโหลดไฟล์ PDF เดี่ยวเพื่อจำลองการรัน OCR และดึง Metadata แสดงก้อน JSON ด้วย Syntax highlighting สวยงาม
  - **Error Display:** Inline error ใน output area (red box) + toast notification
- **i18n (ตาม i18n Guidelines):**
  - ใช้ i18n keys สำหรับข้อความทั้งหมด (เช่น `ai.admin.panel.title`, `ai.admin.panel.health.status`)
  - ห้าม hardcode ข้อความภาษาไทยใน component

#### [MODIFY] [sidebar.tsx](file:///E:/np-dms/lcbp3/frontend/components/admin/sidebar.tsx)
- เพิ่มปุ่มเมนู **"AI Console"** (ไอคอน Brain) ใน Sidebar สำหรับแอดมิน เพื่อลิงก์ไปหน้าจอ `/admin/ai`

#### [MODIFY] [layout.tsx](file:///E:/np-dms/lcbp3/frontend/app/layout.tsx)
- เพิ่มกลไก Polling ตรวจเช็คสถานะการเปิดใช้ AI **ทุก 30 วินาที** แต่ **เฉพาะ users ที่มี AI permissions** (`ai.suggest` หรือ `ai.rag_query`)
- หากระบบ AI ปิดตัวลง จะแสดงแถบแจ้งเตือน **Global Banner** ด้านบนสุด (debounce 5 วินาที) และส่งสัญญาณบอกหน้าจอฟอร์มเพื่อ Disable ปุ่ม AI Suggestion
- **Cache:** React Context + refresh on mount
- **Implementation:** `useAiStatus()` hook ใน `SessionProvider`
- **i18n:** ใช้ i18n keys สำหรับ Global Banner message (เช่น `ai.disabled.banner.message`, `ai.disabled.banner.tooltip`)

---

## 📋 Grilling Session Decisions Summary (2026-05-21)

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

## 🧪 แผนการตรวจสอบความถูกต้อง (Verification Plan)

### 🤖 1. การทดสอบอัตโนมัติ (Automated Tests)
- พัฒนา Unit Test ใน Backend ครอบคลุมพฤติกรรมการบล็อกสิทธิ์ผ่าน Guard, การทำงานของ Cache, และการทำงานของระบบคิว Sandbox แยกเฉพาะ
- **Coverage Goals (ตาม ADR-023A):**
  - Business Logic: 80%+ สำหรับ SystemSettingService, AiService, AiQueueService
  - Backend Overall: 70%+ สำหรับ AI Module ทั้งหมด
- **Test Files:**
  - `system-setting.service.spec.ts` - CRUD operations + Cache invalidation
  - `ai-enabled.guard.spec.ts` - Guard logic (block non-superadmin when AI disabled, allow superadmin)
  - `ai-queue.service.spec.ts` - Queue operations (sandbox job enqueue with HIGH priority)
  - `ai.service.spec.ts` - getAiFeaturesEnabled (Redis Cache miss/hit), setAiFeaturesEnabled (DB + Cache update), getSystemHealth
- สั่งรันการทดสอบผ่าน PowerShell บน Windows:
  ```powershell
  cd backend
  npm run test src/modules/ai
  npm run test:cov src/modules/ai
  ```

### 🧑‍💻 2. การทดสอบด้วยตนเอง (Manual Tests)
1. **การจำกัดสิทธิ์:** ตรวจสอบว่าผู้ใช้ทั่วไปต้องไม่สามารถเข้าถึงหน้าจอและ API ระบบแอดมินได้
2. **การสลับปิดระบบ AI:**
   - ทดสอบสลับสวิตช์เป็นปิดใช้งาน
   - ตรวจสอบว่าหน้าจอผู้ใช้ปกติแสดง Global Banner และปุ่มขอแนะนำ Metadata ถูกปรับเป็น Disabled มี Tooltip ชี้แจง
   - ตรวจสอบว่า Superadmin ยังสามารถเข้าไปคุยแชท RAG และโยนไฟล์ PDF ทดสอบสกัดข้อมูลใน Sandbox ได้เสมือนปกติทุกประการ
3. **การทดสอบความถูกต้องของคิว Sandbox:** ตรวจสอบว่าข้อมูลไหลผ่านคิว `ai-batch` (job types: sandbox-rag, sandbox-extract) ได้สำเร็จและได้รับผลลัพธ์ประมวลผลถูกต้อง
