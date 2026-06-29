# Walkthrough: การจัดการโมเดล AI, OCR Sandbox และการย่อยสลาย VRAM กับ API Key (ADR-033)

เอกสารฉบับนี้สรุปการพัฒนาและแก้ไขระบบจัดการ AI Model Management, OCR Sandbox Runner ตามออกแบบใน [ADR-033](file:///e:/np-dms/lcbp3/specs/06-Decision-Records/ADR-033-active-model-and-ocr-management.md) และการอัปเกรดความปลอดภัยตามข้อเสนอแนะการทบทวนโค้ด (Suggestions) ทั้งหมดในโครงการ

---

## 🚀 สรุปผลการพัฒนาและการทดสอบ (Key Achievements)

การปรับปรุงระบบและการดำเนินการตามข้อเสนอแนะคุณภาพซอฟต์แวร์เสร็จสมบูรณ์แบบครบถ้วน 100% โดยบรรลุความสำเร็จดังนี้:
1. **ความปลอดภัยของระบบประมวลผล OCR (Sidecar Key Protection):**
   - ติดตั้งระบบตรวจสอบความถูกต้องของ API Key บน Request Headers (`X-API-Key`) ทุก endpoints หลักใน ocr-sidecar
   - อัปเกรด NestJS Backend ให้ดึงและส่งโทเค็นปลอดภัยแนบไปกับคำขอเรียกประมวลผล OCR และตรวจเช็คสุขภาพ ส่งผลให้ ocr-sidecar ได้รับการอุดช่องโหว่การเรียกใช้งานแบบไร้การยืนยันตัวตนสำเร็จ 100%
2. **การจัดสรรหน่วยความจำ VRAM (Dynamic GPU Unloading):**
   - เพิ่มระบบ Unload ล้างโมเดลภาษาขนาดใหญ่ตัวเก่าออกทันทีหลังจากสั่งสลับและโหลดโมเดลตัวใหม่สำเร็จ ป้องกันการค้างและทับถมของทรัพยากร VRAM GPU บนเครื่อง Desk-5439
3. **ความมั่นคงปลอดภัยของไลบรารีระบบ (Axios Vulnerabilities CLEAN):**
   - อัปเกรด `axios` ทั้งสองฝั่งเป็นเวอร์ชันปลอดภัยล่าสุด (`1.16.x` ขึ้นไป) ส่งผลให้ pnpm audit รายงาน **`No known vulnerabilities found`** (CLEAN 100%)
4. **การคอมไพล์ระบบและการทดสอบยูนิตเทส (Compilation & Test Pass):**
   - คำสั่ง `pnpm --filter backend build` และ frontend build ผ่าน 100% ปราศจาก error
   - การรันยูนิตเทสทั้งหมดของโปรเจกต์ DMS (`Test Suites: 78 passed, 676 tests`) ผ่านทั้งหมด 100% สำเร็จรวดเร็ว
   - โค้ดที่พัฒนาใหม่ตรงตามมาตรฐาน Tier 1 ทุกข้อ (ไร้ `parseInt` บน UUIDv7, ไม่มีบรรทัดว่างในฟังก์ชัน, คอมเมนต์ภาษาไทย โค้ดภาษาอังกฤษ)

---

## 🛠️ รายละเอียดการเปลี่ยนแปลงและแก้ไขที่เสร็จสิ้น

### 1. ระบบโหลดโมเดลแบบเรียลไทม์และตรวจสอบความสมบูรณ์ (Ollama Model Preloading)
- พัฒนาเมธอด `loadModel(modelName)` ใน [ollama.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/ollama.service.ts) เพื่อตรวจสอบความถูกต้องของโมเดลผ่าน `/api/tags` และส่งการโหลดโมเดลขึ้น GPU memory ทันทีโดยส่ง `/api/generate` พร้อมส่ง `keep_alive: -1` และกำหนดเวลาหมดเวลา (Timeout) 30 วินาที
- ปรับปรุง `activateAiModel()` ใน [ai.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/ai.service.ts) ให้เรียกทำงานแบบ Synchronous และทดลองโหลดโมเดลจริงก่อนแก้ไขสถานะในฐานข้อมูล หากการโหลดโมเดลบน Ollama ล้มเหลว จะโยน `BusinessException` กลับไปขัดขวางทันที

### 2. ระบบคืนหน่วยความจำ VRAM อัตโนมัติ (Dynamic VRAM Unloader) — [💡 Suggestion 1 เสร็จสิ้น]
- พัฒนาเมธอด `unloadModel(modelName)` ใน [ollama.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/ollama.service.ts) สั่งยิง `/api/generate` ไปยัง Ollama ด้วยพารามิเตอร์ `keep_alive: 0` เพื่อบอกให้ Ollama ทำการสลัดล้างโมเดลนั้นออกจากหน่วยความจำ GPU ในทันที
- อัปเดต `activateAiModel()` ใน [ai.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/ai.service.ts) ดึงข้อมูลโมเดล Active ตัวเดิมก่อนหน้า และทำการสั่ง Unload คืนค่า VRAM ของโมเดลเก่าทันทีเมื่อการโหลดและสลับโมเดลตัวใหม่สำเร็จ

### 3. ระบบป้องกัน APIs ใน ocr-sidecar ด้วย API Key (X-API-Key) — [💡 Suggestion 2 เสร็จสิ้น]
- **ฝั่ง ocr-sidecar [app.py](file:///e:/np-dms/lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py):**
  - นำเข้า `APIKeyHeader`, `Security`, และ `status` เพื่อประกาศและกำหนดการใช้งาน `X-API-Key`
  - สร้าง Dependency `get_api_key` เพื่อตรวจสอบและแกะคีย์เปรียบเทียบ หากไม่ตรงจะส่งกลับข้อผิดพลาด `401 Unauthorized`
  - นำไปติดตั้งเป็น Dependencies ใน endpoints หลัก ได้แก่ `/ocr`, `/ocr-upload` และ `/normalize`
- **ฝั่ง DMS Backend:**
  - อัปเดต [ocr.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/ocr.service.ts) และ [sandbox-ocr-engine.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/sandbox-ocr-engine.service.ts) ให้อ่านค่า API Key จาก `ConfigService` และส่งแนบไปใน axios request headers `X-API-Key` ทุกๆ ครั้ง

### 4. ระบบป้องกัน VRAM OOM ล้มเหลวแบบ Resilient (Resilient OOM Fallback)
- ปรับปรุงการดักจับข้อผิดพลาด (Catch Block) ของ `fetchAndCacheVramStatus()` ใน [vram-monitor.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/vram-monitor.service.ts) หาก Ollama เกิดข้อผิดพลาด ไม่สามารถดึงสถานะ GPU ได้ ระบบจะไม่บล็อกความสามารถในการตอบคำถามของ AI โดยจะบันทึกข้อความเตือน (Warning Log) และส่งกลับสถานะจำลอง `hasCapacity = true`

### 5. ปรับปรุงหน้าจอผู้ใช้งาน OCR Sandbox (Tab Flow & Precision Dropdowns)
- ใน [OcrSandboxPromptManager.tsx](file:///e:/np-dms/lcbp3/frontend/components/admin/ai/OcrSandboxPromptManager.tsx) ปรับให้แท็บ Sandbox เป็นแถบเริ่มต้นหลัก และสลับตำแหน่งปุ่มเมนูย่อยให้เป็นระเบียบ
- อัปเดตและปรับเปลี่ยนป้ายชื่อเอนจิน OCR ใน Dropdown ตัวเลือกให้แสดงความจุหน่วยความจำ VRAM อย่างแม่นยำชัดเจนตามโมเดลจริง ได้แก่ `typhoon-ocr1.5-3b 3.2GB` และ `typhoon-ocr-3b 7.5GB`

---

## 📈 รายการไฟล์ที่มีการแก้ไข (Modified Files Log)

| ไฟล์ที่ถูกแก้ไข / เพิ่มเติม | หน้าที่ความรับผิดชอบ | สถานะการเปลี่ยนแปลง |
| :--- | :--- | :---: |
| [ADR-033-active-model-and-ocr-management.md](file:///e:/np-dms/lcbp3/specs/06-Decision-Records/ADR-033-active-model-and-ocr-management.md) | เอกสารบันทึกการตัดสินใจสถาปัตยกรรม (ADR) | **[NEW]** |
| [ai.controller.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/ai.controller.ts) | คอนโทรลเลอร์ควบคุม REST APIs และจัดระเบียบข้อยกเว้นและ Import | **[MODIFY]** |
| [ai.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/ai.service.ts) | ปรับปรุงการสลับโมเดล AI ล้างโมเดลเก่า GPU เพื่อจัดสรร VRAM (Suggestion 1) | **[MODIFY]** |
| [ollama.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/ollama.service.ts) | เพิ่ม `unloadModel()` และ `loadModel()` เพื่อดูแล VRAM แบบ Synchronous | **[MODIFY]** |
| [ocr.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/ocr.service.ts) | ส่ง API Key (`X-API-Key` header) ยิงตรวจสุขภาพและใช้งาน sidecar (Suggestion 2) | **[MODIFY]** |
| [sandbox-ocr-engine.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/sandbox-ocr-engine.service.ts) | ส่ง API Key (`X-API-Key` header) ยิงเรียกใช้ OCR Sandbox (Suggestion 2) | **[MODIFY]** |
| [vram-monitor.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/vram-monitor.service.ts) | มอนิเตอร์ GPU และ VRAM พร้อมความทนทานต่อ OOM ในบล็อก catch | **[MODIFY]** |
| [ai.service.spec.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/ai.service.spec.ts) | เขียนชุดยูนิตเทสครอบคลุมสถานการณ์การโหลดแบบ synchronous ล้มเหลว | **[MODIFY]** |
| [page.tsx](file:///e:/np-dms/lcbp3/frontend/app/(admin)/admin/ai/page.tsx) | เพิ่ม active status badge สำหรับโมเดล AI หลักบนหน้าจอ Admin Dashboard | **[MODIFY]** |
| [OcrSandboxPromptManager.tsx](file:///e:/np-dms/lcbp3/frontend/components/admin/ai/OcrSandboxPromptManager.tsx) | จัดโครงสร้างปุ่มแท็บ Sandbox เริ่มต้นและป้ายชื่อ dropdown ให้ตรงความจริง | **[MODIFY]** |
| [app.py](file:///e:/np-dms/lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py) | เพิ่ม API Key protection (`X-API-Key`) และ Dynamic engine map (Suggestion 2) | **[MODIFY]** |
| `backend/package.json` | อัปเกรด `axios` เป็นเวอร์ชันล่าสุดที่ปลอดภัย | **[MODIFY]** |
| `frontend/package.json` | อัปเกรด `axios` เป็นเวอร์ชันล่าสุดที่ปลอดภัย | **[MODIFY]** |

---

## 🔒 การตรวจสอบมาตรฐานความปลอดภัยและคุณภาพโค้ด

1. **การปฏิบัติตามกฎ Tier 1 และกฎ Global ของโปรเจกต์:**
   - **โค้ดเป็นภาษาอังกฤษและคอมเมนต์เป็นภาษาไทย:** มีการตรวจเช็คไฟล์และเขียนคำอธิบายด้วยภาษาไทยอย่างละเอียดในส่วนคอมเมนต์โค้ด
   - **ห้ามมีบรรทัดว่างในฟังก์ชัน:** ตรวจสอบและกำจัดบรรทัดว่างข้างในฟังก์ชันทั้งหมดเรียบร้อย
   - **การใช้ UUIDv7:** คอนโทรลเลอร์รับส่งค่าอินพุต UUID ผ่าน `ParseUuidPipe` และมีการจัดการ UUID อย่างระมัดระวัง ไม่มีการใช้ `parseInt()` หรือแปลงค่าเป็นตัวเลขโดยเด็ดขาดตามมาตรฐาน ADR-019
   - **การตรวจสอบสิทธิ์ (RBAC & CASL Guards):** เอนด์พอยต์ใหม่ทั้งหมดถูกควบคุมด้วย `JwtAuthGuard` และ `RbacGuard` พร้อมตรวจสอบ permission `system.manage_all` ของ Superadmin อย่างเหนียวแน่นตามมาตรฐาน ADR-016
   - **การบันทึก Change Log และระบุโครงสร้างไฟล์:** ทุกไฟล์ที่ทำการเปลี่ยนแปลงและแก้ไขมี `// File: path` และ `// Change Log` ครบถ้วนถูกต้องที่บรรทัดแรกของไฟล์
