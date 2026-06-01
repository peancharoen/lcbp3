<!-- File: specs/06-Decision-Records/ADR-032-typhoon-ocr-integration.md -->
<!-- Change Log
- 2026-05-30: Created initial ADR-032 documenting the integration of Typhoon OCR-3B and typhoon2.1-gemma3-4b with sequential loading (keep_alive = 0) and Tesseract fallback.
- 2026-05-30: Status changed to Active — VramMonitorService, OcrCacheService, TyphoonOcrProcessor, TyphoonLlmProcessor implemented (T004-T009d, T021).
- 2026-06-01: แก้ไขสถาปัตยกรรม OCR Sidecar — เปลี่ยนจาก shared volume mount เป็น multipart file upload (/ocr-upload)
              เพราะ Docker Desktop WSL2 ไม่สามารถ bind mount network drive (Z:) หรือ CIFS volume ได้
-->

# ADR-032: Typhoon OCR & LLM Integration Architecture

**Status:** Active
**Date:** 2026-05-30
**Decision Makers:** Development Team, System Architect, AI Integration Lead
**Related Documents:**
- [ADR-023: Unified AI Architecture (Base)](./ADR-023-unified-ai-architecture.md)
- [ADR-023A: Unified AI Architecture — Model Revision (gemma4:e2b, 2-Model Stack)](./ADR-023A-unified-ai-architecture.md)
- [ADR-016: Security & Authentication](./ADR-016-security-authentication.md)
- [Feature Specification (spec.md)](../200-fullstacks/232-typhoon-ocr-integration/spec.md)

---

## 🎯 Context and Problem Statement

โครงการ LCBP3-DMS มีความต้องการยกระดับความแม่นยำในการทำ OCR เอกสารภาษาไทยในระบบ **OCR Sandbox Runner** ให้สูงขึ้น (เป้าหมาย 95%+) โดยใช้โมเดลภาษาไทยเฉพาะทาง และเพิ่มโมเดลภาษาไทยระดับผู้เชี่ยวชาญใน **AI Model Management**

อย่างไรก็ดี การเพิ่มโมเดลสกัดข้อความที่เป็นวิสัยทัศน์คอมพิวเตอร์ (Vision-Language Model) และโมเดลภาษาขนาดใหญ่ (Large Language Model) เช่น `scb10x/typhoon-ocr-3b` (~3.5GB VRAM) และ `typhoon2.1-gemma3-4b` (~4.5GB VRAM) อาจส่งผลให้เกิดปัญหา **GPU VRAM Overflow** (เกินขีดจำกัด 8GB ของ RTX 2060 Super บน Admin Desktop Desk-5439) หากมีการโหลดเข้าสู่หน่วยความจำพร้อมกับโมเดลพื้นฐานอย่าง `gemma4` และ `nomic-embed-text`.

---

## ⚙️ Decision Drivers

- **Accuracy Focus:** ยกระดับความถูกต้องในการแปลผลภาษาไทยผ่าน `Typhoon OCR-3B` เป็นเอนจินทางเลือกใน OCR Sandbox.
- **GPU VRAM Budget ≤ 8GB:** ต้องควบคุมไม่ให้การโหลดโมเดลรันพร้อมกันจน VRAM ล้นและระบบแครช (Out-of-Memory).
- **Graceful Degradation:** หากบริการ AI ติดขัดหรือประมวลผลล้มเหลว ระบบ DMS หลักและฟังก์ชัน OCR สำรองต้องยังคงทำงานได้ปกติ.
- **Physical Isolation (Zero Trust):** รันโมเดลทั้งหมดภายในเครือข่าย On-premises บน Admin Desktop เท่านั้น ห้ามผ่าน Cloud.

---

## 🏛️ Proposed Decisions & Architecture

### 1. การเลือกเอนจินและรุ่นโมเดล (Engine & Model Selection)
* **AI Model Option:** เพิ่ม `typhoon2.1-gemma3-4b` เข้าไปในระบบ **AI Model Management** สำหรับงานวิเคราะห์ความหมายขั้นสูงในบริบทไทย.
* **OCR Sandbox Option:** วางแผนเพิ่ม `Typhoon OCR-3B` (รันบน Ollama ที่เครื่อง Admin Desktop) เป็นตัวเลือกคู่ขนานกับ Tesseract OCR.

### 2. การส่งไฟล์ระหว่าง Backend และ OCR Sidecar (File Transfer Architecture)

**การตัดสินใจ (2026-06-01):** เปลี่ยนจาก **shared volume mount** เป็น **multipart HTTP upload** ผ่าน endpoint `/ocr-upload` ใหม่

**สาเหตุ:** Docker Desktop บน Windows 11 ใช้ WSL2 เป็น backend — Linux VM ภายใน WSL2 ไม่สามารถ bind mount จาก Windows mapped drive letter (Z:) หรือ CIFS named volume ที่ mount ผ่าน Docker Desktop ได้ ทำให้ `/mnt/uploads` ใน sidecar container ว่างเปล่าเสมอ และเกิด 404 เมื่อ sidecar พยายามเปิดไฟล์

**Architecture ใหม่:**
```
Backend (QNAP)
  └── fs.readFileSync(pdfPath)           ← อ่านจาก /app/uploads/
        └── POST /ocr-upload (multipart)  ← ส่ง file bytes ผ่าน LAN 2.5 Gbps
              └── Sidecar (Desk-5439)
                    └── fitz.open(stream=pdf_bytes)  ← ประมวลผลใน memory
```

**ข้อดีเพิ่มเติม:**
- ไม่มี path coupling — sidecar ไม่รู้จัก path ของ backend
- Sidecar ย้าย host ได้โดยไม่ต้องแก้ config mount
- Overhead จาก file transfer < 200ms บน LAN 2.5 Gbps (น้อยกว่า OCR processing time มาก)
- endpoint `/ocr` (path-based, legacy) ยังคงอยู่เพื่อ backward compatibility

---

### 3. นโยบายการจัดการ VRAM ด้วย Ollama Model Swapping (VRAM Swapping Policy)
เพื่อหลีกเลี่ยงข้อจำกัด 8GB VRAM ของ GPU โดยยังคงใช้โมเดลขนาดใหญ่ได้ ระบบจะเปลี่ยนจากการโหลดโมเดลค้างไว้พร้อมกัน (Simultaneous) เป็น **"การทำงานแบบสลับลำดับและจำกัดการจองหน่วยความจำ (Sequential with Ollama keep_alive)"**:
* **`keep_alive = 0`:** ในคำสั่งเรียกประมวลผล (Inference) ทุกชนิดไปยังโมเดล Typhoon จะต้องบังคับพารามิเตอร์ `"keep_alive": 0` เพื่อให้ Ollama ทำการคลายโมเดลออกจากหน่วยความจำ GPU ทันทีหลังตอบกลับสำเร็จ คืนพื้นที่ VRAM ให้โมเดลถัดไปทำงานได้ทันที.
* **Stateless Sidecar:** ตัว Python OCR Sidecar Container จะรับตัวแปรสภาพแวดล้อม `OLLAMA_API_URL` ใน `docker-compose.yml` (ชี้ไปที่ `http://192.168.10.100:11434`) เพื่อประมวลผล PDF-to-Image และส่งภาพสกัดต่อไปยัง Ollama.

### 4. Hyperparameters และ System Prompt สำหรับ Typhoon OCR
เพื่อให้ได้ผลลัพธ์การสกัดอักษรภาษาไทยที่ถูกต้องและลดสัญญาณรบกวน (Noise):
* **System Prompt:**
  ```text
  "สกัดข้อความภาษาไทยและอังกฤษทั้งหมดจากภาพนี้อย่างถูกต้อง รักษาโครงสร้างบรรทัดและการเว้นวรรคให้ใกล้เคียงต้นฉบับมากที่สุด ห้ามเพิ่มคำอธิบายใดๆ"
  ```
* **LLM Hyperparameters:**
  - `temperature = 0.0` (เพิ่มความเป็นระเบียบและให้ผลลัพธ์คงเดิม)
  - `top_p = 0.9`
  - `repeat_penalty = 1.0` (หรือ `repetition_penalty`)
  - `keep_alive = 0`

### 5. ระบบการเก็บแคชชิ่ง (24-Hour Redis Caching)
ระบบจะทำการแคชผลลัพธ์ของการทำ OCR ด้วยโมเดลและไฟล์เดิมไว้เป็นเวลา **24 ชั่วโมง** ผ่าน Redis เพื่อลดต้นทุนเวลาประมวลผล (SLA < 60 วินาที/หน้า)
* **Cache Key:** `ocr:cache:{documentPublicId}:{engine}:{hash}`
* **TTL:** 86,400 วินาที (24 ชั่วโมง)
* **การเคลียร์แคช:** ทำโดยอัตโนมัติเมื่อเอกสารอัปเดต หรือแอดมินสั่งล้างผ่านระบบหลังบ้าน.

### 6. ระบบสลับเอนจินสำรองอัตโนมัติ (Graceful Fallback)
* หาก Ollama หรือโมเดล Typhoon ไม่สามารถเข้าถึงได้ หรือใช้เวลาทำ OCR **นานเกิน 60 วินาที** ระบบ NestJS backend (`OcrService`) จะทำการสลับเอนจินสำรองไปยัง **Tesseract OCR (tha+eng)** อัตโนมัติในเวลาไม่เกิน 5 วินาที พร้อมแจ้งเตือนผู้ใช้บนหน้าเว็บอินเตอร์เฟส.

---

## 📋 Implementation Status

| Component | Status | File |
|---|---|---|
| SQL delta: ai_audit_logs fields | ✅ Complete | `specs/03-Data-and-Storage/deltas/2026-05-30-extend-ai-audit-logs.sql` |
| SQL delta: typhoon_ocr_system prompt | ✅ Complete | `specs/03-Data-and-Storage/deltas/2026-05-30-add-typhoon-ocr-prompt.sql` |
| VRAMMonitorService | ✅ Complete | `backend/src/modules/ai/services/vram-monitor.service.ts` |
| OcrCacheService (24h Redis) | ✅ Complete | `backend/src/modules/ai/services/ocr-cache.service.ts` |
| AiAuditLog entity extension | ✅ Complete | `backend/src/modules/ai/entities/ai-audit-log.entity.ts` |
| OCR Sidecar: Typhoon OCR function | ✅ Complete | `specs/04-Infrastructure-OPS/.../ocr-sidecar/app.py` |
| OCR Sidecar: `/ocr-upload` multipart endpoint | ✅ Complete | `specs/04-Infrastructure-OPS/.../ocr-sidecar/app.py` |
| OCR Sidecar: Dockerfile update | ✅ Complete | `specs/04-Infrastructure-OPS/.../ocr-sidecar/Dockerfile` |
| OCR Sidecar: docker-compose.yml (volumes ลบออก) | ✅ Complete | `specs/04-Infrastructure-OPS/.../ocr-sidecar/docker-compose.yml` |
| OcrService: multipart upload แทน remapPath | ✅ Complete | `backend/src/modules/ai/services/ocr.service.ts` |
| SandboxOcrEngineService: multipart upload แทน remapPath | ✅ Complete | `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts` |
| TyphoonOcrProcessor (BullMQ) | ✅ Complete | `backend/src/modules/ai/processors/typhoon-ocr.processor.ts` |
| TyphoonLlmProcessor (BullMQ) | ✅ Complete | `backend/src/modules/ai/processors/typhoon-llm.processor.ts` |
| ai.module.ts registration | ✅ Complete | `backend/src/modules/ai/ai.module.ts` |
| i18n keys (Thai) | ✅ Complete | `frontend/public/locales/th/ai.json` |
| OCR Engine Selector (Frontend) | 🔄 Pending | `frontend/src/features/ocr-sandbox/` |
| Fallback + Audit integration | 🔄 Pending | `backend/src/modules/ai/services/ocr.service.ts` |
| Model seeding (Admin Desktop) | 🔄 Manual | Ollama pull on Admin Desktop |
| Unit tests | 🔄 Pending | — |

## 📋 Consequences

### Positive
- ✅ **ความแม่นยำภาษาไทยสูง:** ได้ความถูกต้อง 95%+ บนข้อความภาษาไทย in Sandbox Runner.
- ✅ **แก้ปัญหา VRAM 8GB อย่างยั่งยืน:** การใช้ `keep_alive = 0` และ sequential queue ช่วยให้โมเดลรันแบบหมุนเวียนได้โดยไม่เกิด OOM บน RTX 2060 Super.
- ✅ **การเชื่อมต่ออิสระ (Stateless Sidecar):** ออกแบบสถาปัตยกรรม Sidecar ให้ Stateless และตั้งค่าผ่านตัวแปรสภาพแวดล้อมได้ยืดหยุ่น.
- ✅ **มีระบบสำรอง (High Uptime):** ผู้ใช้งานสามารถประมวลผลต่อได้ผ่าน Tesseract เสมอแม้โมเดล AI ขัดข้อง.

### Negative
- ❌ **Overhead ในการโหลดโมเดล (Latency):** การตั้งค่า `keep_alive = 0` ทำให้การรันงานข้ามคิวอาจเกิดดีเลย์เล็กน้อย (3-5 วินาที) ในการดึงโมเดลเข้า VRAM ใหม่ แต่นับเป็น Trade-off ที่ยอมรับได้เมื่อเทียบกับระบบแครช.

---

## 🔄 Review & Maintenance

* **Review Cycle:** ทุก 6 เดือน หรือเมื่อมีการอัปเกรดเครื่องประมวลผล (Admin Desktop GPU)
* **ผู้รับผิดชอบ:** AI Integration Lead ร่วมกับ System Architect Team
