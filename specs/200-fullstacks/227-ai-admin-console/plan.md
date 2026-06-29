// File: specs/200-fullstacks/227-ai-admin-console/plan.md
// Change Log:
// - 2026-05-20: แผนการพัฒนาฉบับภาษาไทยสำหรับระบบ AI Admin Console

# Implementation Plan: AI Admin Console

**Branch**: `227-ai-admin-console` | **Date**: 2026-05-20 | **Spec**: [spec.md](./spec.md) | **ADR**: [ADR-027](../../06-Decision-Records/ADR-027-ai-admin-console-and-dynamic-control.md)

---

## สรุปแนวทางเชิงเทคนิค (Technical Summary)

แผนงานนี้จัดทำขึ้นเพื่อออกแบบและติดตั้งระบบ **AI Admin Panel** สำหรับสิทธิ์ **Superadmin** เท่านั้น เพื่อให้ผู้ดูแลระบบสามารถตรวจสอบสุขภาพของเครื่อง AI Host (`Desk-5439`), เปิด/ปิดการใช้งานฟีเจอร์ AI สำหรับผู้ใช้ทั่วไปได้แบบ Dynamic, ตรวจสอบสถานะ BullMQ/Qdrant, และใช้งาน Playground ทดสอบคำสั่ง RAG และการทำ OCR/Metadata extraction โดยอ้างอิงตามข้อสรุปการตัดสินใจจากการ Grill Session และสอดคล้องกับนโยบายเอกสารของโครงการอย่างครบถ้วน

---

## วัตถุประสงค์และข้อกำหนดทางเทคนิค

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

## รายละเอียดการเปลี่ยนแปลงในระบบ (Proposed Changes)

### 🗄️ 1. โครงสร้างฐานข้อมูล (Database Layer)

สร้างตาราง `system_settings` ในฐานข้อมูล MariaDB เพื่อเก็บค่าการตั้งค่าแบบไดนามิก (ตามแนวทาง ADR-009)

#### [NEW] [03-09-add-system-settings.sql](file:///E:/np-dms/lcbp3/backend/migrations/03-09-add-system-settings.sql)
- เขียนคำสั่ง SQL เพื่อสร้างตาราง `system_settings` และ Seed ข้อมูลเบื้องต้น:
```sql
-- File: backend/migrations/03-09-add-system-settings.sql
-- Change Log
-- - 2026-05-20: สร้างตาราง system_settings และ seed ค่าเปิด/ปิด AI

CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  setting_key VARCHAR(100) NOT NULL UNIQUE COMMENT 'คีย์การตั้งค่าระบบ (เช่น AI_FEATURES_ENABLED)',
  setting_value TEXT NOT NULL COMMENT 'ค่าที่บันทึก',
  description TEXT COMMENT 'คำอธิบายข้อมูลการตั้งค่า',
  updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บข้อมูลการตั้งค่าระบบไดนามิก';

-- Seed ค่าเริ่มต้นสำหรับการควบคุมสถานะระบบ AI
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('AI_FEATURES_ENABLED', 'true', 'สถานะเปิด/ปิดการใช้งานฟีเจอร์ AI ทั้งระบบ สำหรับผู้ใช้ทั่วไป (true/false)')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
```

---

### 💻 2. ส่วนของระบบหลังบ้าน (Backend Layer - NestJS)

#### [MODIFY] [queue.constants.ts](file:///E:/np-dms/lcbp3/backend/src/modules/common/constants/queue.constants.ts)
- เพิ่มรหัสคิวใหม่สำหรับห้องทดสอบของแอดมิน:
```typescript
export const QUEUE_AI_ADMIN_SANDBOX = 'ai-admin-sandbox';
```

#### [NEW] [system-setting.entity.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/entities/system-setting.entity.ts)
- สร้าง Entity รองรับโครงสร้างตารางใหม่ (ไม่มีบรรทัดว่างในฟังก์ชันตามข้อตกลง):
```typescript
// File: src/modules/ai/entities/system-setting.entity.ts
// Change Log
// - 2026-05-20: สร้าง Entity SystemSetting สำหรับเก็บการตั้งค่า
import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'setting_key', unique: true, length: 100 })
  settingKey: string;

  @Column({ name: 'setting_value', type: 'text' })
  settingValue: string;

  @Column({ type: 'text', nullable: true })
  description: string;

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
- ลงทะเบียนคิว BullMQ `QUEUE_AI_ADMIN_SANDBOX` และตัวประมวลผลคิว `AiSandboxProcessor`

#### [NEW] [ai-sandbox.processor.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/processors/ai-sandbox.processor.ts)
- พัฒนาตัวประมวลผลงานคิว `ai-admin-sandbox` โดยเฉพาะ:
  - รับงานประเภท `sandbox-rag` -> ค้นหาในเวกเตอร์และตอบคำถาม RAG พร้อมแสดง Citations
  - รับงานประเภท `sandbox-extract` -> รัน OCR บนไฟล์ PDF เดี่ยวและประมวลผลสกัด Metadata คืนออกมาเป็นก้อนข้อมูล JSON

#### [MODIFY] [ai-queue.service.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/ai-queue.service.ts)
- เพิ่มฟังก์ชัน `enqueueSandboxJob(type: string, payload: any)` เพื่อส่งงานของแอดมินเข้าคิว Sandbox แยกต่างหาก

#### [MODIFY] [ai.service.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/ai.service.ts)
- เพิ่มเมธอดสำหรับอ่าน/เขียนการตั้งค่า:
  - `getAiFeaturesEnabled()`: ค้นหาค่า `AI_FEATURES_ENABLED` จาก Redis Cache ก่อน หากไม่มีจึงไปดึงจากตาราง `system_settings` แล้วเขียนลง Redis Cache เพื่อใช้ครั้งต่อไป
  - `setAiFeaturesEnabled(enabled: boolean, userId: number)`: อัปเดตสถานะในตารางฐานข้อมูลและอัปเดต Redis Cache ทันที
  - `getSystemHealth()`: รวบรวมข้อมูลสุขภาพของระบบ Ollama, Qdrant, และคิว BullMQ ต่างๆ (รวมความยาวคิว sandbox)

#### [NEW] [ai-enabled.guard.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/guards/ai-enabled.guard.ts)
- สร้าง Guard สำหรับเช็คสถานะการปิด AI ทั่วระบบ:
  - หากคีย์การเปิดใช้งานถูกตั้งค่าเป็น `'false'` และผู้ใช้ไม่มีสิทธิ์จัดการระบบสูงสุด (`system.manage_all`) จะปฏิเสธการเข้าใช้งาน API ด้วยรหัสข้อผิดพลาด **HTTP 503 Service Unavailable**

#### [MODIFY] [ai.controller.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/ai.controller.ts)
- นำ Guard `AiEnabledGuard` ไปติดตั้งใน Endpoints ยิงทำงาน AI ของผู้ใช้ทั่วไป
- เพิ่มกลุ่ม API ปลอดภัยสำหรับ Superadmin เท่านั้น (ควบคุมด้วย `@RequirePermission('system.manage_all')`):
  - `GET /ai/admin/settings` -> แสดงสถานะเปิด/ปิด AI ปัจจุบัน
  - `POST /ai/admin/toggle` -> สลับสถานะเปิด/ปิดระบบ AI
  - `GET /ai/admin/health` -> ดึงรายงานสุขภาพระบบ Ollama, Qdrant, คิว BullMQ ทั้งระบบ
  - `POST /ai/admin/sandbox/rag` -> ส่งงานคำถาม RAG เข้าคิว Sandbox
  - `POST /ai/admin/sandbox/extract` -> ส่งอัปโหลด PDF สกัด metadata เข้าคิว Sandbox
  - `GET /ai/admin/sandbox/job/:id` -> Polling ตรวจสอบความคืบหน้าของงานในคิว Sandbox

---

### 🎨 3. ส่วนหน้าจอแสดงผล (Frontend Layer - Next.js)

#### [NEW] [admin-ai.service.ts](file:///E:/np-dms/lcbp3/frontend/lib/services/admin-ai.service.ts)
- พัฒนา API Service สำหรับดึงข้อมูลและสั่งงานของระบบ Admin AI Panel:
  - ดึงข้อมูลสุขภาพ ตรวจสอบการตั้งค่า สลับปุ่มเปิด/ปิด
  - ส่งงาน Sandbox RAG/Extraction และ Polling เช็คผลลัพธ์ของ Job

#### [NEW] [page.tsx](file:///E:/np-dms/lcbp3/frontend/app/%28admin%29/admin/ai/page.tsx)
- หน้าต่าง **AI Control Panel & Playground** ออกแบบอย่างพรีเมียม สไตล์ Glassmorphism:
  - **Header Switch:** สวิตช์ปุ่มเรืองแสงสีเขียว/ส้มขนาดใหญ่ สำหรับเปิด/ปิดใช้งานระบบ AI
  - **Health Indicators:** การ์ดประเมินสถานะของ Ollama, Qdrant, และ คิว BullMQ แบบเรียลไทม์
  - **RAG Playground Tab:** แชทบอทโต้ตอบผ่าน Isolated Queue พร้อมสถานะความคืบหน้าของคิว แสดงคำตอบและเอกสารอ้างอิงสวยงาม
  - **OCR Sandbox Tab:** กล่องวางอัปโหลดไฟล์ PDF เดี่ยวเพื่อจำลองการรัน OCR และดึง Metadata แสดงก้อน JSON ด้วย Syntax highlighting สวยงาม

#### [MODIFY] [sidebar.tsx](file:///E:/np-dms/lcbp3/frontend/components/admin/sidebar.tsx)
- เพิ่มปุ่มเมนู **"AI Console"** (ไอคอน Brain) ใน Sidebar สำหรับแอดมิน เพื่อลิงก์ไปหน้าจอ `/admin/ai`

#### [MODIFY] [layout.tsx](file:///E:/np-dms/lcbp3/frontend/app/layout.tsx)
- เพิ่มกลไก Polling ตรวจเช็คสถานะการเปิดใช้ AI ทุก 30 วินาที
- หากระบบ AI ปิดตัวลง จะแสดงแถบแจ้งเตือน **Global Banner** ด้านบนสุด และส่งสัญญาณบอกหน้าจอฟอร์มเพื่อ Disable ปุ่ม AI Suggestion

---

## แผนการตรวจสอบความถูกต้อง (Verification Plan)

### 🤖 1. การทดสอบอัตโนมัติ (Automated Tests)
- พัฒนา Unit Test ใน Backend ครอบคลุมพฤติกรรมการบล็อกสิทธิ์ผ่าน Guard, การทำงานของ Cache, และการทำงานของระบบคิว Sandbox แยกเฉพาะ
- สั่งรันการทดสอบผ่าน PowerShell บน Windows:
  ```powershell
  cd backend
  npm run test src/modules/ai
  ```

### 🧑‍💻 2. การทดสอบด้วยตนเอง (Manual Tests)
1. **การจำกัดสิทธิ์:** ตรวจสอบว่าผู้ใช้ทั่วไปต้องไม่สามารถเข้าถึงหน้าจอและ API ระบบแอดมินได้
2. **การสลับปิดระบบ AI:**
   - ทดสอบสลับสวิตช์เป็นปิดใช้งาน
   - ตรวจสอบว่าหน้าจอผู้ใช้ปกติแสดง Global Banner และปุ่มขอแนะนำ Metadata ถูกปรับเป็น Disabled มี Tooltip ชี้แจง
   - ตรวจสอบว่า Superadmin ยังสามารถเข้าไปคุยแชท RAG และโยนไฟล์ PDF ทดสอบสกัดข้อมูลใน Sandbox ได้เสมือนปกติทุกประการ
3. **การทดสอบความถูกต้องของคิว Sandbox:** ตรวจสอบว่าข้อมูลไหลผ่านคิว `ai-admin-sandbox` ได้สำเร็จและได้รับผลลัพธ์ประมวลผลถูกต้อง
