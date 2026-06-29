// File: specs/200-fullstacks/232-typhoon-ocr-integration/walkthrough.md
// Change Log
// - 2026-05-30: Initial walkthrough documentation for Typhoon OCR and LLM dynamic integration.

# Walkthrough: Typhoon OCR & LLM Integration

เอกสารนี้สรุปผลงานการพัฒนาระบบรองรับโมเดลภาษาไทยผสมอังกฤษ **Typhoon OCR-3B** และโมเดล **typhoon2.1-gemma3-4b** ภายใต้ระบบ dynamic config, VRAM Guard และระบบสำรอง Graceful Fallback ตามมาตรฐาน ADR-019, ADR-023, ADR-023A และ ADR-032

---

## 🛠️ รายการสิ่งที่คุณได้ปรับปรุงและแก้ไข (Changes Made)

### 1. ระบบหลังบ้าน (NestJS Backend Service & Controller)
- **[MODIFY] [ocr.service.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/services/ocr.service.ts)**:
  - เพิ่มระบบสลับเอนจิน OCR แบบไดนามิก (`getOcrEngines`, `selectOcrEngine`) จัดเก็บสถานะหลักใน DB `system_settings` (`OCR_ACTIVE_ENGINE`) พร้อมแคชใน Redis 30 วินาทีเพื่อจำกัดคิวรี
  - พัฒนาเมธอด `processWithTyphoon()` ร่วมกับ `OcrCacheService` เพื่อแคชข้อความจากรูปภาพ (24-hour Redis caching TTL) ป้องกันค่าลิมิตการเรียกใช้ API ซ้ำซ้อน
  - ติดตั้ง **VRAM Monitor Guard** ตรวจสอบ GPU VRAM (> 4GB) ก่อนอนุญาตให้ Typhoon ทำงาน
  - พัฒนาระบบ **Graceful Fallback** ไปยัง Tesseract OCR ในเวลา 5 วินาทีเมื่อ Ollama/Typhoon มีปัญหาหรือ VRAM ไม่เพียงพอ บันทึก error ที่เกิดขึ้นจริงลง `ai_audit_logs` อย่างชัดเจน
- **[MODIFY] [ai.service.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/ai.service.ts)**:
  - พัฒนา endpoints รองรับ AI Model Management: `GET /models`, `POST /models`, `PATCH /models/:modelId/activate` (ตรวจสอบ VRAM capacity ก่อน activate) และ `GET /vram/status`
  - นำเข้า `OllamaService` และ `AiQdrantService` ที่ขาดหายไปในส่วน constructor ป้องกันข้อผิดพลาดของตัวตรวจสอบภาษา TypeScript (Build errors)
- **[MODIFY] [ai.controller.ts](file:///E:/np-dms/lcbp3/backend/src/modules/ai/ai.controller.ts)**:
  - ติดตั้ง dynamic mapping endpoint สำหรับ Next.js frontend และ n8n API integrations พร้อมประยุกต์ใช้ CASL Guard ตามระดับสิทธิ์ความปลอดภัยในระดับ Tier 1

### 2. ระบบหน้าบ้าน (Next.js Frontend Pages & Service)
- **[MODIFY] [admin-ai.service.ts](file:///E:/np-dms/lcbp3/frontend/lib/services/admin-ai.service.ts)**:
  - เพิ่ม interface `LoadedModelInfo` และ `VramStatusResponse`
  - อัปเดต `getVramStatus`, `getAvailableModels`, `setActiveModel`, และ `addModel` ให้รองรับ Dynamic UUIDv7 (`modelId`) และ Idempotency headers ตามมาตรฐานความปลอดภัย (ADR-016 / ADR-019)
- **[MODIFY] [page.tsx](file:///E:/np-dms/lcbp3/frontend/app/(admin)/admin/ai/page.tsx)**:
  - เพิ่ม **VRAM GPU Monitor Card** สดใหม่ในส่วน Overview & Health แสดง Used/Free VRAM และรายการโมเดลที่ทำงานบน GPU เรียลไทม์ (Auto-refresh ทุกๆ 15 วินาทีผ่าน React Query)
  - อัปเกรด Card การบริหารจัดการโมเดล AI ในระบบ AI Admin console ให้ทำงานสลับโมเดลหลักผ่าน UUIDv7 และแสดง VRAM Requirement ของแต่ละโมเดลอย่างสมดุลสวยงาม

### 3. เอกสารสถาปัตยกรรม (Architecture Decision Records)
- **[MODIFY] [ADR-023](file:///E:/np-dms/lcbp3/specs/06-Decision-Records/ADR-023-unified-ai-architecture.md)**: บันทึกการเพิ่ม Typhoon OCR และ Dynamic LLM dynamic models ภายใต้การควบคุม of VRAM Monitor (v1.2)
- **[MODIFY] [ADR-023A](file:///E:/np-dms/lcbp3/specs/06-Decision-Records/ADR-023A-unified-ai-architecture.md)**: บันทึก 2-model stack เคียงคู่กับ Dynamic Thai specialized models (v1.3)
- **[NEW] [ADR-032](file:///E:/np-dms/lcbp3/specs/06-Decision-Records/ADR-032-typhoon-ocr-integration.md)**: จัดทำเอกสารข้อตกลงสถาปัตยกรรม Typhoon OCR Integration อย่างเป็นทางการ

---

## 🧪 การตรวจสอบและการรันการทดสอบ (Verification & Testing)

### 1. การคอมไพล์โค้ดระบบหลังบ้าน (Backend Type Check & Build)
ดำเนินการคอมไพล์และตรวจสอบ TypeScript ใน NestJS backend:
```powershell
# รันตรวจสอบจาก e:\np-dms\lcbp3\backend
npm run build
```
**ผลลัพธ์**: คอมไพล์ผ่าน 100% ไร้ข้อผิดพลาดและไม่มี Type errors ในโมดูลระบบ AI ทั้งหมด

### 2. การคอมไพล์โค้ดระบบหน้าบ้าน (Frontend Type Check & Build)
ดำเนินการคอมไพล์และตรวจสอบ Next.js frontend:
```powershell
# รันตรวจสอบจาก e:\np-dms\lcbp3\frontend
npm run build
```
**ผลลัพธ์**: คอมไพล์ผ่าน 100% ไร้ข้อผิดพลาด หน้าจอและ dynamic routes ถูก compile และ traces เสร็จสมบูรณ์

---

## 📊 แผนการทดสอบใช้งานจริง (Manual UAT Plan)

### ขั้นตอนที่ 1: การเปลี่ยนเอนจิน OCR ใน OCR Sandbox
1. ล็อคอินด้วยสิทธิ์ Superadmin (`system.manage_all`)
2. เข้าสู่เมนู **AI Console** -> **OCR Sandbox**
3. สังเกตตัวเลือก **OCR Engine Selector** จะมีให้เลือก **Tesseract OCR** และ **Typhoon OCR-3B**
4. ทดลองสลับเป็น **Typhoon OCR-3B** และประมวลผลไฟล์เอกสารภาษาไทยผสมอังกฤษ
5. ตรวจสอบคุณภาพการแปลงข้อความภาษาไทย (ความถูกต้องของสระและพยัญชนะ)
6. จำลองสถานการณ์ Ollama ปิดตัวชั่วคราว -> ตรวจสอบว่าระบบเปลี่ยนไปใช้ **Tesseract OCR** สำรองอัตโนมัติภายใน 5 วินาทีอย่างราบรื่น

### ขั้นตอนที่ 2: การตรวจสอบ VRAM GPU Monitor & AI Model Management
1. ไปที่เมนู **AI Console** -> แท็บ **Overview & Health**
2. ตรวจสอบสถานะการทำงานของ GPU ผ่าน **VRAM GPU Monitor Card** (แสดง VRAM used/free เป็นแถบสเปกตรัมสวยงามเรียลไทม์)
3. ไปยังตาราง **AI Model Management**
4. ทดลองสลับโมเดลหลักเป็น **typhoon2.1-gemma3-4b**
5. ตรวจสอบว่าระบบความปลอดภัย VRAM Monitor ตรวจเช็คพื้นที่คงเหลือก่อนโหลดจริง หาก VRAM เหลือ < 4GB ระบบจะไม่อนุญาตให้สลับและแสดงหน้าต่างแจ้งเตือนป้องกัน VRAM OOM เสมอ
