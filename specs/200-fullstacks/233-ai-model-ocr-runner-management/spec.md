# Feature Specification: AI Model & OCR Runner Management

**Feature Branch**: `233-ai-model-ocr-runner-management`  
**Created**: 2026-06-02  
**Status**: Draft  
**Input**: Refactor and fix issues in AI Model Management & OCR Sandbox Runner (ADR-033 compliant).

---

## Overview

เอกสารข้อกำหนดคุณสมบัติ (Feature Specification) นี้ครอบคลุมการปรับปรุงระบบความปลอดภัย ประสิทธิภาพ และการทำงานของ **AI Admin Console** และ **OCR Sandbox Runner** ตามสถาปัตยกรรม **ADR-033** เพื่อแก้ไขปัญหา:
1. การตรวจสอบและยืนยันการโหลดโมเดลภาษาขนาดใหญ่ (LLM) ในระบบ Ollama บนเครื่อง Desk-5439 ในลักษณะ Synchronous และป้องกันการตอบกลับผลลัพธ์สำเร็จล่วงหน้า
2. การปรับปรุง VRAM Monitor (OOM Guard Fallback) ให้มีความทนทาน (Resilience) ไม่บล็อกผู้ใช้งานเมื่อระบบเช็คข้อมูลไม่ได้
3. การสลับและปรับลำดับการทำวิจัย OCR Sandbox Runner ในแท็บแผงควบคุมให้ถูกต้องเหมาะสมตามจริง และสลับมาแสดงเป็นหน้าแรก
4. การแมปตัวเลือกโมเดล Typhoon OCR ทั้ง 2 เวอร์ชัน (v1.0 7.5GB และ v1.5 3.2GB) ไปยังโมเดลจริงของ Ollama และการเพิ่ม API endpoints ที่ตกหล่นใน Controller ของฝั่ง Backend

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ollama Real-time Model Loading & Pre-verification (Priority: P1)

ในฐานะ **Superadmin** เมื่อฉันทำการเปลี่ยน "โมเดล AI ที่ใช้งานอยู่ (Global)" ผ่าน AI Model Management Dropdown ฉันต้องการให้ระบบทำการติดต่อ Ollama เพื่อยืนยันว่าโมเดลนั้นได้รับการดาวน์โหลดแล้วจริงในเครื่อง Desk-5439 และจะสั่งประมวลผลโหลดเข้าหน่วยความจำ GPU (`keep_alive: -1`) ทันทีก่อนบันทึกสำเร็จลงฐานข้อมูล หากพบว่าไม่มีโมเดล หรือไม่สามารถโหลดขึ้น GPU ได้สำเร็จ (เช่น VRAM OOM หรือ Timeout 30s) ระบบจะต้องปฏิเสธคำขอและแสดงข้อผิดพลาดที่ชัดเจน ไม่เขียนทับสถานะใน DB

**Why this priority**: เป็นคุณสมบัติสำคัญที่สุดในการรักษาสถานะความสอดคล้องระหว่างแอปพลิเคชันและ Ollama (Data Integrity) ป้องกันข้อผิดพลาดตอนรันจริง

**Independent Test**: สามารถทดสอบโดยการสลับโมเดล AI ในระบบ และตรวจสอบว่า Ollama ps มีโมเดลแสดงอยู่จริงและไม่สามารถเลือกเปลี่ยนเป็นโมเดลที่ยังไม่ได้ดาวน์โหลดได้

**Acceptance Scenarios**:
1. **Given** ระบบทำงานปกติ และมีโมเดล `gemma4:e4b` ติดตั้งอยู่, **When** แอดมินกดเลือกเปลี่ยนโมเดลหลักเป็น `gemma4:e4b`, **Then** ระบบ NestJS backend จะติดต่อ Ollama `/api/generate` เพื่อ pre-load โมเดล เมื่อสำเร็จจะบันทึกสถานะเปลี่ยนโมเดลลง DB และแจ้งเตือนแอดมินว่าสำเร็จ
2. **Given** มีความจุ VRAM ไม่พอ หรือโมเดลที่เลือกไม่มีติดตั้งอยู่ใน Ollama, **When** แอดมินพยายามกดเปลี่ยนโมเดลหลัก, **Then** ระบบจะปฏิเสธคำขอ สปริงข้อผิดพลาด (BadRequestException / BusinessException) และแจ้งแอดมินบนหน้าเว็บโดยไม่มีการเปลี่ยนการตั้งค่าในฐานข้อมูล

---

### User Story 2 - OCR Engine Dynamic Sandbox Run with Precise Visual Labels (Priority: P1)

ในฐานะ **Superadmin** เมื่อฉันเข้าสู่หน้า **OCR Sandbox Runner** ฉันต้องการให้แท็บการทำงานนี้แสดงขึ้นเป็นตัวเลือกแรกสุดตามลำดับการทำงานจริง (แสดงก่อน Prompt Editor) และมี dropdown ตัวเลือก OCR Engine ที่ถูกต้องตามขนาด:
- `Auto (Current Baseline)`
- `Tesseract OCR`
- `typhoon-ocr1.5-3b 3.2GB`
- `typhoon-ocr-3b 7.5GB`
และเมื่อฉันอัปโหลดไฟล์ PDF ระบบจะสามารถส่งคำขอและเรียกโมเดล Ollama ได้ถูกต้องตามชื่อโมเดลจริง (`scb10x/typhoon-ocr1.5-3b` หรือ `scb10x/typhoon-ocr-3b`)

**Why this priority**: มีผลโดยตรงต่อการทดสอบและวิจัย OCR ของแอดมิน เพื่อความสอดคล้องและความถูกต้องของผลลัพธ์

**Independent Test**: Superadmin สามารถอัปโหลด PDF เลือก `typhoon-ocr1.5-3b 3.2GB` หรือ `typhoon-ocr-3b 7.5GB` และดูข้อความที่สกัดออกมาได้ โดยตรวจสอบ log ในฝั่ง sidecar ว่าโหลดโมเดลถูกตัว

**Acceptance Scenarios**:
1. **Given** ผู้ใช้เปิดแท็บ OCR Sandbox, **When** ดูที่เมนู, **Then** แท็บ OCR Sandbox Runner จะต้องแสดงขึ้นมาก่อนและเป็น default แทน Prompt Editor
2. **Given** แอดมินเลือกเอนจิน `typhoon-ocr-3b 7.5GB`, **When** กดรัน Step 1, **Then** ฝั่ง backend จะเรียก sidecar API `/ocr-upload` และระบุ `engine = typhoon-ocr-3b` ซึ่ง sidecar จะเรียก Ollama ด้วยโมเดล `scb10x/typhoon-ocr-3b`

---

### User Story 3 - Resilient VRAM OOM Guard Fallback (Priority: P2)

ในฐานะ **Superadmin** เมื่อฉันตรวจสอบสถานะสุขภาพในหน้า Overview & Health และ Ollama API ทำการแจ้งผลลัพธ์ปกติแต่ไม่สามารถเข้าถึง `/api/ps` ได้ (เช่น รุ่นไม่รองรับ) ฉันต้องการให้ระบบ VRAM GPU Monitor ไม่แครชหรือแจ้งสถานะ OOM Guard ตลอดเวลา และสามารถทำงานสืบค้น RAG Sandbox ต่อได้

**Why this priority**: เพิ่มความทนทานต่อการขัดข้องทางเครือข่ายและการเข้าถึง API ในเวอร์ชันที่แตกต่างกัน

**Independent Test**: จำลองให้ endpoint `/api/ps` คืนค่า 404 และตรวจสอบว่าแผงควบคุม VRAM Monitor ยังคงรายงานสถานะพร้อมโหลดโมเดลได้ (มี Free VRAM สมมติ)

**Acceptance Scenarios**:
1. **Given** ระบบไม่สามารถดึง `/api/ps` ได้, **When** ระบบคำนวณสถานะสุขภาพ AI, **Then** ระบบจะคืนค่า free VRAM สมมติและตั้ง `hasCapacity = true` พร้อมทั้งมี log warning เพื่อเตือนแต่ไม่ล็อกระบบ

---

## Edge Cases

- **Ollama Timeout:** เกิดขึ้นเมื่อ Ollama โหลดโมเดลช้าเกิน 30 วินาที -> ระบบจะทำการโยน GatewayTimeout หรือ SystemException และให้ผู้ใช้สลับเอนจินหรือโหลดใหม่อีกครั้ง
- **Model Name Mismatch:** หากโมเดลใน DB กับโมเดลที่เรียกใช้ใน Ollama พิมพ์แตกต่างกันเล็กน้อย (เช่น ตัวพิมพ์เล็ก/ใหญ่ หรือเวอร์ชันย่อย) -> ระบบจะใช้วิธีเช็ค prefix ใน `/api/tags` ในการแก้ปัญหา

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ระบบ MUST ให้ผู้ใช้เลือกและจัดการ OCR Engine หลักผ่าน API `GET /ai/ocr-engines` และ `POST /ai/ocr-engines/:engineId/select` โดยแผงควบคุมจะดึงข้อมูลได้สมบูรณ์และแสดงผลในเมนู
- **FR-002**: ระบบ MUST ทำการตรวจสอบความพร้อมของโมเดลก่อนเปลี่ยนโมเดลหลัก (Global Active Model) โดยทำการ Synchronous Pre-loading ใน Ollama และคืนสถานะข้อผิดพลาดหากไม่พบโมเดล
- **FR-003**: ระบบ MUST ปรับปรุง `/api/ps` fallback ใน `VramMonitorService` ให้กู้คืนสถานะเป็น `hasCapacity = true` เสมอเมื่อเรียก API ตรวจสอบไม่ได้ เพื่อไม่ให้เกิดภาวะ OOM Guard ค้างถาวร
- **FR-004**: ระบบ MUST ดึงข้อมูลโมเดลที่โหลดอยู่บนหน่วยความจำ GPU จริง ๆ ผ่าน `/api/ps` ไปแสดงผลบนแผงควบคุม Ollama AI Engine "โมเดลที่โหลดอยู่"
- **FR-005**: ระบบ MUST ปรับเมนู OCR Sandbox ให้แท็บ "OCR Sandbox" แสดงและเริ่มทำงานเป็นแท็บแรกแทน "Prompt Editor"
- **FR-006**: ระบบ MUST ให้ตัวเลือกเอนจิน OCR Sandbox มีชื่อตัวเลือกดังนี้:
  - `Auto (Current Baseline)`
  - `Tesseract OCR`
  - `typhoon-ocr1.5-3b 3.2GB`
  - `typhoon-ocr-3b 7.5GB`
- **FR-007**: ระบบ MUST แมปเอนจิน `typhoon-ocr1.5-3b` ไปยังโมเดลจริง `scb10x/typhoon-ocr1.5-3b` และ `typhoon-ocr-3b` ไปยัง `scb10x/typhoon-ocr-3b` ใน sidecar app.py

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: แอดมินสามารถสลับ OCR Engine และดึงข้อมูลสถานะได้สำเร็จโดยไม่เกิดข้อผิดพลาด 404
- **SC-002**: การตรวจสอบโมเดลที่โหลดอยู่จริงของ Ollama ทำงานได้ถูกต้องตามผลลัพธ์ของ `ollama ps` ในแบบเรียลไทม์
- **SC-003**: ระบบ VRAM Monitor มี Uptime 100% โดยไม่มีข้อผิดพลาด OOM Guard ค้างเมื่อ Ollama ทำงานปกติ
- **SC-004**: การเรียงลำดับ sub-tabs และการแสดงผล OCR Sandbox และ Dropdown ทำงานได้ตามลำดับจริงที่ถูกต้อง
