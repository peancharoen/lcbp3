<!-- File: specs/06-Decision-Records/ADR-033-active-model-and-ocr-management.md -->
<!-- Change Log
- 2026-06-02: Created initial ADR-033 documenting decisions for Synchronous LLM model pre-loading, active OCR engine REST endpoints, resilient VRAM monitor fallback, and dynamic Typhoon model mapping.
- 2026-06-02: Updated ADR-033 with active model unloading strategy (GPU VRAM releasing) and security validation (X-API-Key) for the OCR sidecar endpoints.
-->

# ADR-033: Active Model and OCR Runner Management Architecture

**Status:** Active  
**Date:** 2026-06-02  
**Decision Makers:** Development Team, AI Architect, Tech Lead  
**Related Documents:**  
- [ADR-023A: Unified AI Architecture — Model Revision](./ADR-023A-unified-ai-architecture.md)  
- [ADR-027: AI Admin Console and Dynamic Control](./ADR-027-ai-admin-console-and-dynamic-control.md)  
- [ADR-032: Typhoon OCR Integration](./ADR-032-typhoon-ocr-integration.md)  
- [Feature Specification (spec.md)](../200-fullstacks/233-ai-model-ocr-runner-management/spec.md)  

---

## 🎯 Context and Problem Statement

ในโครงการ Laem Chabang Port Phase 3 DMS (LCBP3-DMS) มีการใช้งานระบบจัดการปัญญาประดิษฐ์และเอนจินการถอดข้อความแบบเรียลไทม์ (AI Admin Console & OCR Sandbox Runner) ผ่านเครื่องประมวลผลโลคัล Desk-5439 (รัน Ollama API)

อย่างไรก็ดี จากการทดสอบและรันงานจริงพบข้อบกพร่องและจุดขัดข้องสำคัญทางสถาปัตยกรรมดังนี้:
1. **การตอบกลับผลลัพธ์สำเร็จล่วงหน้า (Asynchronous Model Switch Mismatch):** เมื่อแอดมินเปลี่ยนโมเดลหลัก (Global Active Model) ผ่านหน้าควบคุม ระบบบันทึกสถานะใน MariaDB สำเร็จทันที แต่ Ollama อาจจะใช้เวลาโหลดโมเดลเข้า GPU หรือเกิดปัญหาดาวน์โหลดโมเดลล้มเหลว ส่งผลให้เกิดความไม่สอดคล้องระหว่างข้อมูลสถานะและตัวรันจริง (Inconsistency)
2. **REST Endpoints ที่ตกหล่น (Missing OCR Engines APIs):** แผงควบคุม Frontend พยายามติดต่อ API `GET /ai/ocr-engines` และ `POST /ai/ocr-engines/:engineId/select` แต่ได้ผลลัพธ์ 404 เนื่องจากไม่ได้พัฒนา endpoints เหล่านี้ในฝั่ง backend controller
3. **ภาวะ OOM Guard ค้างถาวร (VRAM Monitor Fragility):** เมื่อไม่สามารถเรียกดู API `/api/ps` ของ Ollama ได้ (เช่น ข้อจำกัดของ Ollama เวอร์ชัน หรือเน็ตเวิร์กแลต) ตัวตรวจจับ `VramMonitorService` จะทำการ fallback ไป assume ว่า free VRAM เท่ากับ 0 และปิดกั้น (block) การรันงาน RAG ทั้งระบบ
4. **ความสับสนในโมเดลของ OCR Sandbox (Typhoon Model Mismatch):** ตัวเลือกโมเดล Typhoon OCR ในหน้าเว็บแสดงชื่อไม่ตรงกับโมเดลจริงบน Ollama (`scb10x/typhoon-ocr-3b` ขนาด 7.5GB และ `scb10x/typhoon-ocr1.5-3b` ขนาด 3.2GB) และตัวเว็บส่งคำขอไปแต่ sidecar `app.py` ไม่ได้สลับโมเดลในการส่ง inference จริงจัง
5. **ลำดับการทดสอบ UI (Tab Flow Order):** แท็บ "OCR Sandbox" ควรทำหน้าที่เป็นตัวเริ่มทดสอบแรกสุด (เนื่องจากต้อง OCR ได้เอกสารข้อความดิบก่อนนำไปใส่ Prompt editor ใน Step 2) แต่ลำดับ UI เริ่มต้นกลับวาง Prompt Editor ขึ้นเป็นแผงแรก
6. **ปัญหาการจัดการ VRAM GPU ในการเปลี่ยนโมเดล (GPU Memory Accumulation):** การเปลี่ยนโมเดลบ่อยครั้งทำให้โมเดลเก่าค้างอยู่ใน GPU memory จนอาจเกิด OOM ได้
7. **ช่องโหว่ด้านความปลอดภัยของ ocr-sidecar (API Key Exposure):** Endpoint ใน ocr-sidecar บนเครื่อง Desk-5439 เช่น `/ocr`, `/ocr-upload` และ `/normalize` ขาดระบบตรวจสอบความถูกต้อง ทำให้บุคคลทั่วไปอาจเรียกใช้งานฮาร์ดแวร์ประมวลผลได้โดยตรง

---

## ⚙️ Decision Drivers

* **Data Integrity & Consistency:** การตั้งค่าโมเดลบนฐานข้อมูลต้องสอดคล้องกับโมเดลที่รันและใช้งานอยู่บน Ollama GPU จริง
* **Fault Tolerance & Resilience:** ระบบ VRAM Guard ต้องไม่บล็อกการทำงานหลักเมื่อเกิดข้อผิดพลาดในการตรวจสอบสถานะ
* **Precise Interface & Mapping:** ตัวเลือกและพารามิเตอร์ต้องแสดงขนาดและเรียกโมเดลจริงถูกต้อง 100%
* **Security & Auth Compliance (ADR-016):** Endpoints ใหม่ทั้งหมดต้องผ่านสิทธิ์ CASL Guard และ JwtAuthGuard ของ Superadmin และ sidecar endpoints ต้องมี API Key validation ป้องกันการโจมตี
* **Dynamic VRAM Allocations:** โมเดลเก่าที่ใช้งานเสร็จต้องได้รับการ Unload คืนหน่วยความจำ GPU ทันทีเพื่อเปิดโอกาสให้โมเดลใหม่โหลดได้อย่างสมบูรณ์

---

## 🏛️ Proposed Decisions & Architecture

### 1. Synchronous Model Pre-loading & Verification
ระบบจะปรับปรุงการทำงานของการเปลี่ยนโมเดลใน `AiService.activateAiModel()` ให้เป็นการทำงานแบบ **Synchronous** โดยบังคับขั้นตอนการโหลดและยืนยันก่อนบันทึกลง MariaDB:
* backend จะดึงรายชื่อโมเดลติดตั้งผ่าน `/api/tags` เพื่อป้องกันโมเดลที่ไม่ได้ดาวน์โหลด
* backend จะยิงคำขอไปยัง `/api/generate` ด้วย `prompt: ""` และ `"keep_alive": -1` พร้อมกำหนด **Timeout 30 วินาที** เพื่อโหลดโมเดลขึ้นหน่วยความจำ GPU ทันที
* หากสำเร็จ จะทำการสลับ active model ใน DB; หากล้มเหลว (เช่น Timeout, VRAM ล้น, ไม่มีโมเดล) ระบบจะสปริงข้อผิดพลาด `BusinessException` (BadRequest / system error) และแจ้งแอดมินโดยไม่มีการแก้ไขข้อมูลใน DB

### 2. Resilient VRAM Monitor Fallback
แก้ไข `VramMonitorService` จากเดิมที่คืนค่า free VRAM = 0 และ `hasCapacity = false` เมื่อเกิด exception ให้กลายเป็นการทำงานแบบ **Resilient Fallback** โดย:
* เมื่อไม่สามารถติดต่อ `/api/ps` ได้ ระบบจะ log warning ใน backend
* คืนค่า free VRAM จำลองเท่ากับความจุสูงสุด `GPU_TOTAL_VRAM_MB` และตั้งค่า `hasCapacity = true` เพื่อรักษาความต่อเนื่องไม่ให้หน้า RAG Sandbox ค้างถาวร

### 3. Exposing Missing OCR REST APIs
พัฒนา endpoints สองส่วนใน `AiController` (`ai.controller.ts`) เพื่อเชื่อมต่อกับ `OcrService`:
* `GET /ai/ocr-engines` ดึงเอนจิน OCR ที่มีอยู่พร้อมสถานะ active
* `POST /ai/ocr-engines/:engineId/select` บันทึกการเลือกเอนจินหลัก ตรวจสอบ `engineId` ด้วย `ParseUuidPipe` (ADR-019) และจำกัดสิทธิ์เฉพาะ Superadmin ด้วย CASL `@RequirePermission('system.manage_all')`

### 4. Tab Flow & Precise Dropdown Selection in Sandbox UI
* ปรับปรุงหน้าจอแผงควบคุมหลัก สลับลำดับ sub-tabs ปุ่ม "OCR Sandbox" ขึ้นมาแสดงก่อนและมีค่าเริ่มต้นเป็น `activeTab = 'sandbox'` แทน Prompt Editor
* เปลี่ยน dropdown ใน Sandbox UI ให้แสดงเอนจินและขนาดโมเดลอย่างตรงไปตรงมา:
  * `Auto (Current Baseline)`
  * `Tesseract OCR`
  * `typhoon-ocr1.5-3b 3.2GB`
  * `typhoon-ocr-3b 7.5GB`

### 5. Dynamic Engine Routing in Python Sidecar
ปรับปรุง Python Sidecar API (`app.py`) ของเครื่อง Desk-5439 ในการประมวลผล multipart upload `/ocr-upload` และ endpoint `/ocr` ให้ทำการดึงค่า `engine` parameter จาก payload แล้วแปลงค่าเป็นโมเดลจริงส่งไปยัง Ollama:
* `typhoon-ocr-3b` -> `scb10x/typhoon-ocr-3b` (โมเดล v1.0 ขนาด 7.5GB VRAM)
* `typhoon-ocr1.5-3b` -> `scb10x/typhoon-ocr1.5-3b` (โมเดล v1.5 ขนาด 3.2GB VRAM)
* ค่าอื่นๆ -> `TYPHOON_OCR_MODEL` (default)

### 6. Dynamic GPU Memory Unloading & Releases
* เพิ่มเมธอด `unloadModel(modelName)` ใน `OllamaService` เพื่อส่งคำขอสลัดโมเดลออกจาก GPU ทันทีโดยใช้ `"keep_alive": 0` ผ่าน `/api/generate`
* ใน `AiService.activateAiModel()` เมื่อยืนยันและสลับโมเดลสำเร็จ ระบบจะทำการ Unload โมเดลหลักตัวเก่าออกจาก GPU Memory ทันที เพื่อป้องกันทรัพยากรทับถม

### 7. X-API-Key Security Headers Check
* ฝั่ง ocr-sidecar ใน FastAPI จะติดตั้ง `APIKeyHeader(name="X-API-Key")` เพื่อเป็น Security guard ของ endpoints `/ocr`, `/ocr-upload` และ `/normalize`
* ฝั่ง DMS Backend (NestJS) ใน `OcrService` และ `SandboxOcrEngineService` จะอ่านค่า API Key จาก Config และส่งผ่าน Axios Header `X-API-Key` ทุกครั้งในการสื่อสารกับ sidecar

---

## 📋 Implementation Tasks Alignment

| Task ID | Component | Summary | Status |
| :--- | :--- | :--- | :--- |
| `T003` | Backend | GET `/ai/ocr-engines` in `ai.controller.ts` | ✅ Completed |
| `T004` | Backend | POST `/ai/ocr-engines/:engineId/select` in `ai.controller.ts` | ✅ Completed |
| `T005` | Backend | Resilient VRAM monitor in `vram-monitor.service.ts` | ✅ Completed |
| `T006` | Backend | Accept precise types in `sandbox-ocr-engine.service.ts` | ✅ Completed |
| `T007` | Backend | `loadModel` method in `ollama.service.ts` | ✅ Completed |
| `T008` | Backend | Refactor `activateAiModel` in `ai.service.ts` | ✅ Completed |
| `T009` | Backend | Fetch dynamically from `/api/ps` in `ollama.service.ts` | ✅ Completed |
| `T010` | Frontend | Badges and active status toggles in `page.tsx` | ✅ Completed |
| `T011` | Backend | Test coverage in `ai.service.spec.ts` | ✅ Completed |
| `T012` | Frontend | Swap tabs and activeTab state in `OcrSandboxPromptManager.tsx` | ✅ Completed |
| `T013` | Frontend | Change dropdown options labels | ✅ Completed |
| `T014` | Backend | Update controller sandbox query parsing | ✅ Completed |
| `T015` | Sidecar | Remap engine choices to real models in python `app.py` | ✅ Completed |
| `T016` | Backend | Dynamic GPU Unload model method `unloadModel` in `ollama.service.ts` | ✅ Completed |
| `T017` | Backend | Integrate Unload old model in `AiService` upon new switch success | ✅ Completed |
| `T018` | Sidecar | Secure FastAPI endpoints with `X-API-Key` header validation | ✅ Completed |
| `T019` | Backend | Send `X-API-Key` headers in `OcrService` and sandbox engine calls | ✅ Completed |
| `T020` | Fullstack | Verify end-to-end type safety, builds and unit test coverage | ✅ Completed |

---

## 📋 Consequences

### Positive
* **ความถูกต้องสูงมาก (Real-time Reliability):** แอดมินจะไม่เจอปัญหาสถานะฐานข้อมูลบันทึกสำเร็จ แต่ตัวโมเดลของ Ollama ใช้จริงไม่ได้หรือโหลดไม่สำเร็จ
* **ไม่เกิด deadlock บน UI (High Resilience):** ความทนทานของ VRAM Monitor ช่วยให้ผู้ใช้ดำเนินงานส่วนที่ไม่เกี่ยวข้องต่อไปได้ แม้เกิดความผิดพลาดกับ Ollama metrics
* **ความปลอดภัยระดับสูง:** endpoints มี CASL control ป้องกันสิทธิ์และการเรียกใช้งานแบบไม่ได้รับสิทธิ์ และตัว sidecar ได้รับการป้องกันด้วย header `X-API-Key` ป้องกันการเข้าถึงฮาร์ดแวร์โดยตรง
* **ประสิทธิภาพ GPU และ VRAM สูงขึ้น:** การ Unload โมเดลตัวเดิมเมื่อไม่ใช้แล้วช่วยป้องกันปัญหา GPU VRAM ทับถมจนเต็มความจุและลดอัตราความเสี่ยง OOM

### Negative
* **เวลาตอบสนองช้าลงขณะสลับโมเดล:** เมื่อกดเปลี่ยนโมเดลหลัก superadmin จะต้องรอ ~10-30 วินาทีเพื่อให้ Ollama โหลดโมเดลขนาดยักษ์เข้า GPU จนเสร็จก่อน API ส่ง response แต่ผลลัพธ์นี้ยอมรับได้เพื่อรักษาเสถียรภาพและป้องกัน Race conditions
