# Feature Specification: Intent Classification System

**Feature Branch**: `224-intent-classification`  
**Created**: 2026-05-19  
**Status**: Draft  
**Input**: ADR-024 Intent Classification Strategy + CONTEXT.md AI Runtime Layer

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Admin จัดการ Intent Definitions และ Patterns (Priority: P1)

ในฐานะ System Administrator ฉันต้องการจัดการ Intent Definitions และ Patterns ผ่าน Admin UI เพื่อให้สามารถปรับปรุงการจำแนก Intent ได้แบบ Runtime โดยไม่ต้อง Deploy Code ใหม่

**Why this priority**: ฟีเจอร์นี้เป็นพื้นฐานของระบบ Intent Classification ทั้งหมด — หากไม่มีการจัดการ Intent จะไม่สามารถ Classify Query ได้

**Independent Test**: สามารถทดสอบได้โดยการสร้าง Intent Definition ใหม่ → เพิ่ม Pattern → ทดสอบ Classification ผ่าน Test Console → ตรวจสอบว่า Pattern Match ทำงานถูกต้อง

**Acceptance Scenarios**:

1. **Given** Admin อยู่ที่หน้า Intent Definitions, **When** Admin สร้าง Intent ใหม่พร้อมรายละเอียดครบถ้วน (intent_code, description_th, description_en, category), **Then** Intent ถูกบันทึกและแสดงในรายการทันที
2. **Given** Intent มีอยู่แล้ว, **When** Admin เพิ่ม Pattern (keyword/regex) พร้อมกำหนด priority และ language, **Then** Pattern ถูกบันทึกและใช้งานได้ภายใน 5 นาที (TTL Cache)
3. **Given** Intent มี Pattern หลายรายการ, **When** Admin แก้ไข priority หรือปิดการใช้งาน Pattern บางรายการ, **Then** การเปลี่ยนแปลงมีผลหลัง TTL Cache หมดอายุ

---

### User Story 2 - User สอบถามข้อมูลผ่าน AI Chat และได้รับการตอบกลับที่ถูกต้อง (Priority: P1)

ในฐานะ User ฉันต้องการถามคำถามธรรมชาติ (ภาษาไทย/อังกฤษปน) เกี่ยวกับเอกสารในระบบ เพื่อให้ได้รับข้อมูลที่ต้องการอย่างรวดเร็วโดยไม่ต้องค้นหาด้วยตนเอง

**Why this priority**: ฟีเจอร์หลักของ Intent Classification — แปลงคำถามธรรมชาติเป็น Server-side Intent ที่ระบบเข้าใจ

**Independent Test**: พิมพ์คำถาม "RFA ล่าสุดของโครงการนี้คืออะไร" → ระบบต้องคืน Intent `GET_RFA` พร้อม params ที่ถูกต้อง

**Acceptance Scenarios**:

1. **Given** User พิมพ์คำถามที่ตรงกับ Pattern ที่มีอยู่ (เช่น "สรุปเอกสารนี้"), **When** ระบบประมวลผล, **Then** คืน Intent `SUMMARIZE_DOCUMENT` พร้อม confidence = 1.0 และ latency < 10ms
2. **Given** User พิมพ์คำถามที่ไม่ตรง Pattern (เช่น "ขอดูแบบที่เกี่ยวข้องกับ RFA-0042"), **When** Pattern Layer ไม่ Match, **Then** ระบบเรียก LLM Fallback และคืน Intent `GET_RFA_DRAWINGS` พร้อม confidence ≥ 0.7
3. **Given** User พิมพ์คำถามที่ไม่เกี่ยวกับระบบ (เช่น "อากาศดีไหมวันนี้"), **When** LLM ไม่มั่นใจ (confidence < 0.4), **Then** ระบบคืน Intent `FALLBACK` พร้อมข้อความแนะนำตัวอย่างคำถาม
4. **Given** User พิมพ์คำถามภาษาไทย/อังกฤษปน (เช่น "ขอดู RFA ล่าสุดของ contract A"), **When** ระบบประมวลผล, **Then** คืน Intent `GET_RFA` พร้อม params ที่ถูกต้อง

---

### User Story 3 - ตรวจสอบและวิเคราะห์ประสิทธิภาพของ Intent Classification (Priority: P2)

ในฐานะ System Administrator ฉันต้องการดูสถิติและวิเคราะห์ประสิทธิภาพของ Intent Classification เพื่อปรับปรุง Pattern และ Threshold

**Why this priority**: ช่วยให้ระบบ Intent Classification มีประสิทธิภาพดีขึ้นตามเวลา — สำคัญแต่ไม่จำเป็นต้องมีใน v1

**Independent Test**: ดูหน้า Analytics → ต้องแสดง Hit Rate, Confidence Distribution, Average Latency ได้

**Acceptance Scenarios**:

1. **Given** มีการใช้งาน Intent Classification มากกว่า 100 ครั้ง, **When** Admin ดูหน้า Analytics, **Then** แสดง Hit Rate (Pattern vs LLM), Confidence Distribution, และ Latency Statistics
2. **Given** Admin ต้องการปรับ Threshold, **When** Admin ดูข้อมูล Recalibration Recommendation, **Then** ระบบแสดง Intent ที่ควรเพิ่ม Pattern เพื่อลด LLM Calls

---

### User Story 4 - ทดสอบ Intent Classification ผ่าน Test Console (Priority: P2)

ในฐานะ System Administrator หรือ Developer ฉันต้องการทดสอบคำถามก่อนใช้งานจริง เพื่อตรวจสอบว่า Intent Classification ทำงานถูกต้อง

**Why this priority**: ช่วยในการ Debug และปรับปรุง Pattern — สะดวกแต่ไม่จำเป็นใน v1

**Independent Test**: พิมพ์คำถามใน Test Console → ต้องแสดงผล Pattern Hit หรือ LLM Fallback พร้อม confidence

**Acceptance Scenarios**:

1. **Given** Admin อยู่ที่ Test Console, **When** Admin พิมพ์คำถามและกดทดสอบ, **Then** ระบบแสดงผล Intent, Confidence, Method (pattern/llm_fallback), และ Latency
2. **Given** คำถาม Match Pattern, **When** แสดงผล, **Then** ระบบระบุว่าเป็น Pattern Match พร้อมแสดง Pattern ที่ Match

---

### Edge Cases

1. **Cache Miss ขณะ Query**: หาก Redis Cache หมดอายุระหว่างมีการ Query หลายร้อยรายการพร้อมกัน → ระบบต้อง Query DB แค่ครั้งเดียวแล้ว Update Cache ไม่ให้เกิด Thundering Herd
2. **LLM Unavailable**: หาก Ollama ไม่ตอบสนองหรือ Timeout → ระบบต้อง Return `FALLBACK` Intent พร้อม Log ว่าเป็น LLM Error ไม่ Crash
3. **Pattern Conflict**: หากมี Pattern 2 รายการที่ Match คำถามเดียวกัน → ใช้ Priority ต่ำสุด (เลขน้อยสุด) ชนะ
4. **Regex Invalid**: หาก Admin บันทึก Regex ที่ไม่ Valid → ระบบต้อง Validate ตอนบันทึก และแสดง Error ก่อน Save
5. **Semaphore Overflow**: หากมี Concurrent LLM Calls มากกว่า 3 รายการพร้อมกัน → รายการที่ 4+ ต้องได้รับ `FALLBACK` Intent พร้อม confidence 0 และ Log warning
6. **Bilingual Typo**: หาก User พิมพ์ "สรปุเอกสาร" (typo) → LLM Fallback ต้องเข้าใจและ Classify ถูกต้อง

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ระบบต้องมี Intent Definitions 12 รายการตามที่กำหนดใน ADR-024 (RAG_QUERY, GET_RFA, GET_DRAWING, GET_TRANSMITTAL, GET_CORRESPONDENCE, GET_CIRCULATION, GET_RFA_DRAWINGS, SUMMARIZE_DOCUMENT, LIST_OVERDUE, SUGGEST_METADATA, SUGGEST_ACTION, FALLBACK)
- **FR-002**: ระบบต้องเก็บ Intent Definitions ในตาราง `ai_intent_definitions` พร้อมรองรับ CRUD ผ่าน Admin API
- **FR-003**: ระบบต้องเก็บ Intent Patterns ในตาราง `ai_intent_patterns` โดยแต่ละ Pattern เชื่อมโยงกับ Intent หนึ่งรายการ
- **FR-004**: ระบบต้องรองรับ Pattern Type 2 แบบ: `keyword` (case-insensitive includes) และ `regex` (RegExp.test)
- **FR-005**: ระบบต้องมี Caching Layer ด้วย Redis (Key: `ai:intent:patterns:active`, TTL: 300 วินาที) เพื่อลดการ Query DB
- **FR-006**: ระบบต้องทำ Pattern Matching ตามลำดับ Priority (ASC) — Pattern ที่มี priority ต่ำกว่าจะถูกตรวจสอบก่อน
- **FR-007**: หากไม่มี Pattern Match → ระบบต้องเรียก LLM Fallback (Ollama gemma4:e4b Q8_0) แบบ Synchronous
- **FR-008**: LLM Fallback ต้องใช้ Semaphore จำกัด Concurrent Calls สูงสุด 3 รายการพร้อมกัน
- **FR-009**: ระบบต้อง Validate Confidence Score จาก LLM และ Override เป็น `FALLBACK` หาก confidence < 0.4
- **FR-010**: ระบบต้องบันทึกทุก Classification Request ลง `ai_audit_logs` โดยมีข้อมูล: input, output, method, latency, projectPublicId, userPublicId
- **FR-011**: Admin UI ต้องมีหน้าจัดการ Intent Definitions (CRUD)
- **FR-012**: Admin UI ต้องมีหน้าจัดการ Intent Patterns (CRUD per Intent)
- **FR-013**: Admin UI ต้องมี Test Console สำหรับทดสอบคำถามแบบ Real-time
- **FR-014**: API สำหรับ Classification ต้องรองรับ Bilingual Input (ไทย/อังกฤษปน) และส่งต่อ Context (projectPublicId, userPublicId) ไปยัง Tool Layer

### Key Entities

- **IntentDefinition**: เก็บข้อมูล Intent หลัก — intent_code (PK), description_th, description_en, category (read/suggest/utility), is_active
- **IntentPattern**: เก็บ Pattern สำหรับ Matching — pattern_type (keyword/regex), pattern_value, language (th/en/any), priority, is_active
- **ClassificationResult**: ผลลัพธ์จากการ Classify — intent_code, confidence, method (pattern/llm_fallback/semaphore_overflow), params (optional)
- **ClassificationAuditLog**: บันทึกการใช้งาน — input_text, output_json, latency_ms, user_public_id, project_public_id, created_at

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 70-80% ของคำถามทั่วไปต้องถูก Classify ด้วย Pattern Layer (ไม่ต้องเรียก LLM) และมี Latency น้อยกว่า 10ms
- **SC-002**: คำถามที่ต้องใช้ LLM Fallback ต้องมี Latency น้อยกว่า 2000ms (รวม Pattern Check + LLM Call)
- **SC-003**: ความแม่นยำของ Intent Classification ต้องมีค่าเฉลี่ย Confidence ≥ 0.7 สำหรับ LLM Fallback Cases
- **SC-004**: ระบบต้องรองรับ Concurrent Users ได้อย่างน้อย 50 users พร้อมกันโดยไม่เกิด Semaphore Overflow เกิน 5%
- **SC-005**: Admin สามารถสร้าง Intent และ Pattern ใหม่แล้วใช้งานได้ภายใน 5 นาที (ไม่ต้อง Deploy Code)
- **SC-006**: มี Audit Log ครบทุก Classification Request — สามารถวิเคราะห์ย้อนหลังและ Recalibrate Threshold ได้

---

## Dependencies & Assumptions

### Dependencies

- Ollama Server บน Admin Desktop (Desk-5439) พร้อม Model gemma4:e4b Q8_0
- Redis Cache Server พร้อมใช้งาน
- Database Schema ตาราง `ai_intent_definitions` และ `ai_intent_patterns` (เพิ่มผ่าน SQL Delta)
- AI Gateway Module ที่มีอยู่แล้ว (ADR-023A)

### Assumptions

- Admin มีความรู้เรื่อง Regular Expression เบื้องต้นในการสร้าง Regex Pattern
- User จะพิมพ์คำถามสั้น ๆ (ไม่เกิน 200 ตัวอักษร) — หากเกินจะถูกตัดเอาแค่ 200 ตัวอักษรแรก
- การ Recalibrate Threshold จะทำหลังจากมีข้อมูลอย่างน้อย 100-500 queries ใน ai_audit_logs

---

## Related Documents

- ADR-024: Intent Classification Strategy (specs/06-Decision-Records/ADR-024-intent-classification-strategy.md)
- ADR-023A: Unified AI Architecture — Model Revision
- ADR-019: Hybrid Identifier Strategy
- CONTEXT.md: AI Runtime Layer Section
- ADR-025: AI Tool Layer Architecture (Tool Layer ที่จะรับ Intent ต่อไป)
