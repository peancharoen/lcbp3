# Feature Specification: AI Tool Layer Architecture

**Feature Branch**: `225-ai-tool-layer-architecture`  
**Created**: 2026-05-19  
**Status**: Draft  
**Input**: User description: ADR-025-ai-tool-layer-architecture.md

## User Scenarios & Testing _(mandatory)_

### User Story 1 - AI Gateway Request for RFA (Priority: P1)

AI Gateway ที่ได้รับ Intent `GET_RFA` ต้องสามารถเรียกใช้ `RfaToolService.getRfa` เพื่อดึงข้อมูลมาทำ context ให้ LLM โดยต้องถูกจำกัดสิทธิ์ (CASL) และคืนค่าแค่ publicId + business codes

**Why this priority**: การดึงข้อมูล RFA เป็น use case หลักที่ใช้ทดสอบ AI Tool Layer และตรวจสอบ CASL authorization ได้ครอบคลุม

**Independent Test**: สามารถส่งคำขอ POST ไปยัง Gateway แล้วดูว่า tool คืนค่าข้อมูลที่ไม่มี INT `id` และอนุญาตให้เฉพาะ user ที่มีสิทธิ์ได้หรือไม่

**Acceptance Scenarios**:

1. **Given** User ที่มีสิทธิ์อ่าน RFA ในโครงการ A, **When** AI Gateway ส่ง Intent `GET_RFA` พร้อม `projectPublicId` โครงการ A, **Then** ระบบคืนค่า `{ ok: true, data: [...] }` ที่มี RFA publicId และไม่มี INT `id`
2. **Given** User ที่ไม่มีสิทธิ์อ่าน RFA ในโครงการ B, **When** AI Gateway ส่ง Intent `GET_RFA` สำหรับโครงการ B, **Then** ระบบคืนค่า `{ ok: false, reason: 'FORBIDDEN' }`

---

### User Story 2 - AI Gateway Request for Drawing (Priority: P2)

AI Gateway ที่ได้รับ Intent `GET_DRAWING` ต้องสามารถเรียกใช้ `DrawingToolService.getDrawing` อย่างปลอดภัยเช่นเดียวกับ RFA

**Why this priority**: พิสูจน์ความยืดหยุ่นของ Tool Registry ว่ารองรับ tool ใหม่ได้ง่าย

**Independent Test**: จำลอง Intent `GET_DRAWING` ไปยัง Tool Registry

**Acceptance Scenarios**:

1. **Given** User ปกติที่เข้าถึง Drawing ได้, **When** เรียก Request สำหรับ Drawing, **Then** คืนค่า DrawingToolResult ที่มีเฉพาะ `publicId` และ metadata

---

### User Story 3 - Graceful Degradation on Error (Priority: P2)

เมื่อ Tool ทำงานผิดพลาด (เช่น Database Error, หาข้อมูลไม่พบ) จะต้องคืนค่าอย่างเป็นระบบ เพื่อไม่ให้ Gateway พังและสามารถบอก LLM หรือ User ได้

**Why this priority**: จำเป็นสำหรับ Error Handling (ADR-007)

**Independent Test**: Mock error (เช่น SERVICE_ERROR หรือ NOT_FOUND) จาก tool function

**Acceptance Scenarios**:

1. **Given** Service เกิด exception, **When** เรียก tool function, **Then** ระบบต้องจับ Exception และคืนค่า `{ ok: false, reason: 'SERVICE_ERROR' }` แทนที่จะโยน exception กลับไปที่ HTTP layer โดยตรง

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ระบบ MUST รองรับการลงทะเบียน Tool Functions ใน `AiToolRegistryService` (Static Map) ที่จับคู่ `ServerIntent` กับ Tool Handler
- **FR-002**: ระบบ MUST เรียกใช้งาน Tool Handler พร้อมส่งผ่าน `RequestUser` เพื่อใช้ทำ CASL Enforcement ภายใน Tool
- **FR-003**: Tool ทุกตัว MUST คืนค่าข้อมูลที่ตรงกับ Type `ToolCallResult<T>` ซึ่งประกอบด้วย `ok: true|false`, `data`, `reason`, `message`
- **FR-004**: Data ที่คืนกลับมาจาก Tool (`*ToolResult` DTO) MUST ประกอบด้วย field แบบ `publicId` และรหัส Business Codes (เช่น `rfaNumber`, `statusCode`) และห้ามมี Integer Primary Key (`id`) หรือ Relation Entity ตามกฏ ADR-019
- **FR-005**: ระบบ MUST บันทึกประวัติการเรียก Tool ใน `ai_audit_logs` พร้อมข้อมูล `intent`, `params`, ผลลัพธ์ (`ok`, `reason`), `latencyMs`, `projectPublicId`, และ `userPublicId`

### Key Entities

- **Tool Registry**: ศูนย์รวม Static Map สำหรับเรียก Tool Functions
- **AiAuditLog**: ข้อมูลการทำ Log ทุกๆ Tool Execution เพื่อวัตถุประสงค์ด้าน Audit

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% ของ Tool Response ไม่มี Field ที่เป็น Integer Primary Key (ADR-019 Compliance)
- **SC-002**: Tool Executions ที่เกิดจาก User ไม่มีสิทธิ์ (CASL Fail) 100% ถูก Block และคืนค่า Reason `FORBIDDEN` อย่างถูกต้อง
- **SC-003**: มี Audit Logs ครบ 100% ของทุก Tool Execution (ทั้งสำเร็จและล้มเหลว)
- **SC-004**: AI Tool Layer ครอบคลุมการทำงานอย่างน้อย `GET_RFA`, `GET_DRAWING`, และ `GET_TRANSMITTAL`
