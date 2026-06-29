# Implementation Plan - Refactor and Fix AI Model & OCR Sandbox Management (ADR-033)

แผนงานนี้จัดทำขึ้นเพื่อแก้ไขปัญหาและปรับปรุงระบบการทำงานของ **AI Admin Console** และ **OCR Sandbox Runner** ตามการแจ้งปัญหาของระบบและข้อเสนอแนะของผู้ใช้งาน โดยยึดหลักการประมวลผลภายในขอบเขตความจุหน่วยความจำ VRAM (ADR-032) และการควบคุมผ่าน DMS API อย่างปลอดภัย

---

## User Review Required

> [!IMPORTANT]
> **การแก้ไขและเพิ่มระบบการยืนยันโมเดล (Ollama Model verification & load check)**
> 
> * **การโหลดโมเดลหลักใน backend (Synchronous Pre-loading):** เพื่อแก้ปัญหา "โหลดสำเร็จเร็วเกินไปแต่จริง ๆ โหลดไม่ผ่าน/ยังโหลดไม่เสร็จ" ระบบใน backend (`AiService.activateAiModel`) จะทำการตรวจสอบผ่าน Ollama `/api/tags` ว่าโมเดลมีอยู่จริงในเครื่อง Desk-5439 และจะสั่งโหลดโมเดลเข้า memory ทันทีผ่าน `/api/generate` ด้วย `keep_alive: -1` (พร้อม timeout 30s) ก่อนที่จะเปลี่ยนการตั้งค่า Active ในฐานข้อมูล หากโหลดไม่สำเร็จจะปฏิเสธการสลับโมเดลพร้อมแจ้งข้อความ Error ที่ชัดเจนให้แอดมินทราบทันที
> * **การปล่อยหน่วยความจำ GPU ของโมเดลเดิมออกทันที (Dynamic GPU Memory Release):** หลังจากโหลดและเปลี่ยน Active Model ตัวใหม่สำเร็จ ระบบจะสั่ง Unload โมเดลตัวเดิมออกจาก GPU ทันทีโดยส่ง `keep_alive: 0` เพื่อป้องกันทรัพยากร VRAM ทับถมค้างอยู่บนเครื่อง Desk-5439 จนเกิดภาวะ VRAM OOM
> * **การเพิ่มเอนจิน Typhoon OCR-3B ตัวใหม่:** ใน OCR Sandbox Runner จะรองรับและแมปตัวเลือกเอนจินทั้ง `typhoon-ocr1.5-3b 3.2GB` (v1.5) และ `typhoon-ocr-3b 7.5GB` (v1.0) ไปยังตัวเรียกโมเดลจริงของ Ollama (`scb10x/typhoon-ocr1.5-3b` และ `scb10x/typhoon-ocr-3b` ตามลำดับ) เพื่อให้ตรงกับขนาดและเวอร์ชันโมเดลจริง ป้องกันความสับสนของแอดมินในการตรวจสอบความจุ VRAM และทดสอบการทำงาน

> [!WARNING]
> **การเปลี่ยนพฤติกรรม Fallback ของ VRAM Monitor (OOM Guard)**
> 
> * เมื่อระบบไม่สามารถเชื่อมต่อกับ Ollama `/api/ps` ได้ (เช่น เกิด Network Timeout หรือ Ollama ยังเป็นเวอร์ชันเก่าที่ไม่รองรับ `/api/ps`) ระบบจะเปลี่ยนจากการสมมติว่า VRAM เต็ม (hasCapacity = false) เป็น **"การคืนค่าพร้อมใช้งานจำลอง (hasCapacity = true พร้อมคืน Free VRAM 6GB)"** เพื่อป้องกันปัญหา OOM Guard บล็อกฟังก์ชัน RAG และ OCR Sandbox ทั้งระบบโดยไม่ได้ตั้งใจ

> [!NOTE]
> **การควบคุมความปลอดภัยของฮาร์ดแวร์ประมวลผล (API Key Guarding)**
> 
> * ระบบประมวลผล OCR ที่อยู่นอกเครือข่ายความปลอดภัย (FastAPI Sidecar บน Desk-5439) ได้ถูกติดตั้งระบบกรองความปลอดภัยผ่าน API Key Header (`X-API-Key`) ป้องกันความพยายามแอบใช้กำลังประมวลผลโดยตรงจากภายนอก ขณะที่ตัวเครื่อง DMS Backend NestJS จะส่ง Header นี้แนบไปกับทุกคำขอโดยอัตโนมัติ

---

## Open Questions

ไม่มีประเด็นที่ค้างคา โดยเราได้จัดตั้งสถาปัตยกรรม **ADR-033** เพื่อจัดเก็บแนวทางการออกแบบและตัดสินใจในการจัดการโมเดลอย่างถาวรเรียบร้อยแล้ว

---

## Proposed Changes

### [Backend Components]

เราจะเริ่มจากการเพิ่มเอนจิน OCR ในชนิดข้อมูลและปรับปรุง logic การตรวจสอบ VRAM, การเรียกใช้งาน Ollama และการเพิ่ม endpoint ที่ยังตกหล่นใน Controller พร้อมทั้งอัปเกรด API Key Header Guard และ VRAM Unloader

#### [MODIFY] [sandbox-ocr-engine.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/sandbox-ocr-engine.service.ts)
* ปรับปรุงชนิดข้อมูล `SandboxOcrEngineType` ให้ตรงตามตัวเลือกใน UI
* ดึงค่า API Key จาก Config และส่ง Axios Request ไปยัง sidecar `/ocr-upload` ด้วย header `X-API-Key`

#### [MODIFY] [ocr.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/ocr.service.ts)
* ดึงค่า API Key จาก Config และแนบ header `X-API-Key` ไปกับทุกคำขอประมวลผล OCR และตรวจเช็คสุขภาพที่ส่งไปยัง sidecar

#### [MODIFY] [vram-monitor.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/vram-monitor.service.ts)
* ปรับปรุงฟังก์ชัน `fetchAndCacheVramStatus` ในส่วน catch block ให้ส่งกลับค่า fallback ที่ยืดหยุ่น (`hasCapacity = true`) เพื่อไม่ให้ OOM Guard ทำงานค้างตลอดเวลาเมื่อ API ขัดข้อง

#### [MODIFY] [ollama.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/services/ollama.service.ts)
* ปรับปรุงฟังก์ชัน `checkHealth()` ให้ดึงข้อมูลโมเดลจาก `/api/ps` เพื่อแสดงรายชื่อโมเดลที่โหลดอยู่บนหน่วยความจำ GPU จริง ๆ
* เพิ่มฟังก์ชัน `loadModel(modelName: string): Promise<boolean>` เพื่อทำการตรวจสอบรายชื่อโมเดลใน Ollama (`/api/tags`) และสั่งโหลดโมเดลหลักขึ้น GPU memory ทันที
* เพิ่มฟังก์ชัน `unloadModel(modelName: string): Promise<boolean>` สั่งบอกให้ Ollama ทำการสลัดล้างโมเดลนั้นออกจากหน่วยความจำ GPU ในทันทีโดยใช้ `keep_alive: 0`

#### [MODIFY] [ai.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/ai.service.ts)
* ปรับปรุงฟังก์ชัน `activateAiModel()` ให้เรียกใช้งาน `ollamaService.loadModel(modelName)` เพื่อยืนยันว่าโหลดโมเดลสำเร็จก่อนเขียนทับสถานะใน DB
* หลังสลับและโหลดโมเดลตัวใหม่สำเร็จ จะสั่งเรียกใช้ `unloadModel(previousModel)` เพื่อสลัดโมเดลตัวเก่าออกและล้าง VRAM ทันที

#### [MODIFY] [ai.controller.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/ai.controller.ts)
* ฉีด `OcrService` เข้ามา in constructor
* ลงทะเบียนและเปิดใช้งาน REST API endpoints:
  - `GET /ai/ocr-engines` (ดึงรายชื่อ OCR engines ทั้งหมดและสถานะ Active)
  - `POST /ai/ocr-engines/:engineId/select` (แอดมินสลับ OCR engine หลักของระบบ)
* ตรวจสอบและ normalize `engineType` ใน `submitSandboxOcr` ให้ครอบคลุมทุกโมเดล

#### [MODIFY] [app.py](file:///e:/np-dms/lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py)
* ปรับปรุง `_process_pdf_doc` และ `process_with_typhoon_ocr` ให้แยกความแตกต่างของ `typhoon-ocr-3b` (v1.0) และ `typhoon-ocr1.5-3b` (v1.5) เพื่อส่ง model name ไปเรียกใน Ollama ได้ตรงตัวจริง
* ติดตั้ง APIKeyHeader validation เพื่อปกป้อง endpoint `/ocr`, `/ocr-upload` และ `/normalize`

---

### [Frontend Components]

การปรับปรุง UI ของ AI Admin Console ให้ยืดหยุ่น เรียงลำดับเมนูและแสดงสถานะได้ตอบโจทย์การทำงานจริงของแอดมิน

#### [MODIFY] [page.tsx](file:///e:/np-dms/lcbp3/frontend/app/(admin)/admin/ai/page.tsx)
* เพิ่มแถบแสดงชื่อโมเดลที่ Active และสถานะการโหลดขึ้นหน่วยความจำ GPU ปัจจุบัน (ดึงข้อมูลจาก `health?.ollama?.models`) วางคู่กับสวิตช์ System Toggle (AI feature enabled)
* ปรับปรุงให้ dropdown โมเดลแสดงโมเดลตัวเลือก Typhoon อื่น ๆ ที่แอดมินเพิ่มเข้ามาได้สมบูรณ์

#### [MODIFY] [OcrSandboxPromptManager.tsx](file:///e:/np-dms/lcbp3/frontend/components/admin/ai/OcrSandboxPromptManager.tsx)
* สลับลำดับ sub-tabs ในหน้า OCR Sandbox ให้ตัวทดสอบสกัดข้อความ (OCR Sandbox Runner) แสดงเป็นตัวแรก และอยู่ก่อน Prompt Template Editor เพื่อเรียงลำดับตามขั้นตอนประมวลผลจริง
* เปลี่ยนค่า activeTab เริ่มต้นเป็น `'sandbox'`
* ปรับปรุงข้อความและตัวเลือกเอนจินประมวลผลใน Dropdown:
  - `Auto (Current Baseline)`
  - `Tesseract OCR`
  - `typhoon-ocr1.5-3b 3.2GB`
  - `typhoon-ocr-3b 7.5GB`

---

### [Documentation]

#### [NEW] [ADR-033-active-model-and-ocr-management.md](file:///e:/np-dms/lcbp3/specs/06-Decision-Records/ADR-033-active-model-and-ocr-management.md)
* บันทึกสถาปัตยกรรมและกฎการตรวจสอบโมเดลล่วงหน้า (Pre-loading validation) และโครงสร้างการสลับ OCR Sandbox Runner ที่ได้รับการตัดสินใจในครั้งนี้

---

## Verification Plan

### Automated Tests
* รันการตรวจสอบ Typescript ของทั้ง frontend และ backend เพื่อยืนยันว่าคอมไพล์ผ่าน 100%:
  ```powershell
  pnpm --filter backend build
  ```
* รัน Unit Tests เพื่อทดสอบความถูกต้องของ Logic ทั้งหมดใน module ai:
  ```powershell
  pnpm --filter backend test
  ```

### Manual Verification
* แอดมินตรวจสอบหน้า Overview & Health ในเบราว์เซอร์ ยืนยันว่าส่วน "ระบบจัดการ OCR Engine" โหลดข้อมูลได้สมบูรณ์ ไม่แครช
* ตรวจสอบส่วน VRAM GPU Monitor ว่า OOM Guard มีสถานะความจุพร้อมโหลดโมเดลหลักได้ตามปกติ
* ทดสอบเลือกเปลี่ยนโมเดลหลักใน dropdown และตรวจสอบว่า backend ตรวจความพร้อมกับ Ollama จริง
* ตรวจสอบว่าหน้า OCR Sandbox Runner มีปุ่มแท็บ "OCR Sandbox" ปรากฏก่อน "Prompt Editor" และทำงานได้ถูกต้อง
