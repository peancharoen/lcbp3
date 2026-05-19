// File: specs/200-fullstacks/226-document-chat-ui-pattern/spec.md
// Change Log:
// - 2026-05-19: Initial specification for Document Chat UI Pattern

# Feature Specification: Document Chat UI Pattern

**Feature Branch**: `226-document-chat-ui-pattern`  
**Created**: 2026-05-19  
**Status**: Draft  
**Category**: 200-fullstacks
**Input**: User description from specs/06-Decision-Records/ADR-026-document-chat-ui-pattern.md and CONTEXT.md

## User Scenarios & Testing _(mandatory)_

### User Story 1 - ดูเอกสารและคุยกับ AI พร้อมกันบน Desktop (Priority: P1)

ผู้ใช้งานเปิดดูเอกสาร (เช่น Drawing, RFA, Transmittal, Correspondence) บนหน้าจอ Desktop และสามารถเปิด Panel AI Chat ทางด้านขวาได้โดยที่เนื้อหาของเอกสารหลักไม่ถูกบดบัง ทำให้สามารถดูข้อมูลในเอกสารไปพร้อมๆ กับการพิมพ์ถามหรืออ่านคำตอบจาก AI ได้

**Why this priority**: เป็น Core value ที่ช่วยรักษา context ของเอกสารไม่ให้สลับหน้าไปมา (No context switching)

**Independent Test**: ทดสอบการกดปุ่ม Toggle chat บนหน้าเอกสารหลัก แล้วเปิด Panel ด้านขวา (กว้าง 400px แบบ slide-in) ตรวจสอบว่าหน้าจอหลักปรับความกว้างเพื่อไม่ให้โดนทับ และสามารถพิมพ์โต้ตอบได้สำเร็จ

**Acceptance Scenarios**:

1. **Given** ผู้ใช้เปิดหน้าดูรายละเอียดของ Drawing, **When** ผู้ใช้กดปุ่ม Toggle AI Chat, **Then** Panel AI Chat กว้าง 400px จะ Slide-in ออกมาจากทางด้านขวา และเนื้อหา Drawing จะย่อขนาดลงให้พอดีกับพื้นที่ที่เหลือ
2. **Given** Panel AI Chat เปิดอยู่, **When** ผู้ใช้กดปุ่ม Toggle หรือกดปุ่มปิด Panel, **Then** Panel จะ Slide-out ปิดตัวลง และหน้าจอหลักของ Drawing จะขยายกลับมาเต็มหน้าจอเหมือนเดิม

---

### User Story 2 - การสนทนากับ AI โดยใช้เอกสารเป็นบริบท (Context Injection) (Priority: P1)

ผู้ใช้สามารถส่งคำถามหา AI ใน Chat Panel โดยระบบจะแนบ `documentPublicId` และ `documentType` ไปใน API request โดยอัตโนมัติ ทำให้ AI เข้าใจบริบทของเอกสารที่เปิดอยู่และสามารถตอบคำถามหรือสรุปเนื้อหาได้อย่างถูกต้อง

**Why this priority**: ช่วยให้ผู้ใช้ไม่ต้องพิมพ์อ้างอิงเอกสารซ้ำซ้อน และได้รับคำตอบที่ตรงประเด็นเกี่ยวกับเอกสารนั้นๆ

**Independent Test**: สามารถส่ง query ไปยัง endpoint `/api/ai/chat` พร้อมกับแนบบริบทของ Drawing/RFA แล้วระบบสามารถส่งต่อไปยัง AI Gateway และประมวลผลคำตอบกลับมาได้ถูกต้องตามเอกสารอ้างอิง

**Acceptance Scenarios**:

1. **Given** ผู้ใช้เปิดหน้า RFA ฉบับหนึ่ง, **When** ผู้ใช้พิมพ์ถามว่า "สรุปเอกสารนี้", **Then** ระบบจะเรียก API `/api/ai/chat` โดยมี payload query "สรุปเอกสารนี้" และ context `{ type: "rfa", publicId: "..." }` และแสดงผลลัพธ์การสรุปของ RFA ฉบับนั้นใน Chat Panel

---

### User Story 3 - ปรับเปลี่ยนการแสดงผลตามขนาดหน้าจอ (Responsive Chat Interface) (Priority: P2)

หน้าจอระบบรองรับการเปิดใช้งาน AI Chat บนอุปกรณ์ที่หลากหลาย เช่น Tablet (ขนาด 768px - 1023px) จะแสดง panel ด้านขวาเป็น 30% ของ viewport และบน Mobile (< 768px) จะแสดงผลเป็น Bottom Sheet สูง 60% ที่มี overlay บางๆ บนเอกสารหลัก

**Why this priority**: รองรับพฤติกรรมผู้ใช้ที่เปิดหน้างานก่อสร้างผ่าน Tablet/Mobile นอกสถานที่

**Independent Test**: ปรับขนาดหน้าจอผ่าน Responsive design mode ของ Browser และเปิดใช้งาน Chat Panel เพื่อยืนยันพฤติกรรม UI

**Acceptance Scenarios**:

1. **Given** ผู้ใช้ใช้งานผ่านหน้าจอขนาด 800px (Tablet), **When** กดเปิด AI Chat, **Then** Chat panel จะแสดงผลทางขวากว้าง 30% ของ viewport
2. **Given** ผู้ใช้ใช้งานผ่านหน้าจอขนาด 375px (Mobile), **When** กดเปิด AI Chat, **Then** AI Chat จะแสดงผลในรูปแบบ Bottom Sheet เลื่อนขึ้นมาจากด้านล่างสูง 60% ของจอ โดยมี overlay บดบังส่วนอื่นของจอ

---

### User Story 4 - การนำเสนอ Suggested Actions และการแสดงผลหลายประเภท (Suggested Actions & Response UI) (Priority: P2)

ระบบสามารถแสดงคำแนะนำการกระทำต่อเนื่อง (Suggested Actions) ที่ได้จาก AI ในรูปแบบปุ่ม Chip (เช่น "ดู RFA ฉบับเต็ม", "สร้าง RFA ตัวถัดไป") และผู้ใช้สามารถคลิกปุ่มเพื่อส่ง query ใหม่ได้ทันทีโดยไม่ต้องพิมพ์

**Why this priority**: ช่วยอำนวยความสะดวกในการใช้งานแบบ Workflow Continuity

**Independent Test**: ตรวจสอบการเรนเดอร์ Suggested Actions ใน chat history และการทำงานเมื่อกดปุ่ม Chip

**Acceptance Scenarios**:

1. **Given** AI ส่งข้อความคำตอบพร้อมรายการ Suggested Actions, **When** ข้อความแสดงขึ้นบนจอ, **Then** จะมีปุ่ม Chip แสดงผลใต้กล่องข้อความของ AI
2. **Given** ปุ่ม Suggested Action แสดงอยู่บนจอ, **When** ผู้ใช้คลิกเลือกปุ่มนั้น, **Then** ระบบจะทำการพิมพ์และส่ง query ตามข้อความของปุ่มนั้นไปยัง AI โดยอัตโนมัติ

---

### Edge Cases

- **Network Error / Service Unavailable**: เมื่อเกิดปัญหาเครือข่าย หรือ AI Gateway ล่ม Chat Panel จะต้องแสดงสถานะข้อผิดพลาดสีส้ม/แดงเตือนว่า "ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่" พร้อมปุ่ม Retry โดยจะต้องรักษาข้อความสนทนาก่อนหน้าไว้ ไม่ถูกล้างไป
- **AI Timeout**: หาก AI ใช้เวลาประมวลผลนานเกิน 10 วินาที ระบบจะยกเลิกการรอและแสดงข้อความ "AI ตอบช้าเกินไป กรุณาลองอีกครั้ง" และบันทึกเหตุการณ์ลงใน `ai_audit_logs`
- **ไม่มีสิทธิ์เข้าถึงเอกสาร (Permission/CASL Error)**: หากสิทธิ์ของผู้ใช้ถูกเปลี่ยนระหว่างเปิดหน้านั้นๆ หรือไม่มีสิทธิ์เข้าถึงข้อมูลย่อยใน Tool Layer ระบบต้องแจ้งเตือนว่า "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" โดยไม่แสดงรายละเอียดด้านเทคนิคภายใน
- **การเปลี่ยนหน้าเอกสาร (Document Switching/Navigation)**: เมื่อผู้ใช้เปิดหน้าเอกสารอื่น ระบบจะทำการ reset หรือ auto-collapse chat panel เพื่อป้องกันความสับสนของบริบท (Context Preservation)
- **การเก็บสถานะสนทนา (Session Persistence)**: ข้อความการสนทนาใน session นี้จะเก็บอยู่ใน Session Storage เพื่อไม่ให้หายเมื่อมีการเปลี่ยนหน้า แต่หากกดรีเฟรชหน้าจอ (Hard Reload) สนทนาจะถูกเคลียร์เพื่อลดความซับซ้อนตามขอบเขตระยะแรก (v1)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ระบบต้องมี `AiChatPanel` component ที่สามารถเปิด/ปิดได้ทางด้านขวาบนหน้าจอ Desktop และมีปุ่ม `AiChatToggle` สำหรับควบคุม
- **FR-002**: ระบบต้องตรวจจับขนาดหน้าจอของอุปกรณ์และแสดงผลลัพธ์เป็น Collapsible panel (ขวากว้าง 400px สำหรับ Desktop, ขวากว้าง 30% สำหรับ Tablet) หรือ Bottom Sheet (สูง 60% สำหรับ Mobile)
- **FR-003**: ระบบต้องทำการแนบ `context` ซึ่งประกอบด้วย `type` และ `publicId` ของหน้าเอกสารปัจจุบันทุกครั้งที่ส่งคำถามไปยัง `/api/ai/chat`
- **FR-004**: ระบบต้องรองรับการส่งและรับคำตอบแบบ Stream/Chunk จาก AI Gateway เพื่อการแสดงผลแบบค่อยๆ ปรากฏ (หาก API รองรับ) หรือแบบปกติ (v1 fallback)
- **FR-005**: ระบบต้องจัดเตรียมคีย์บอร์ดชอร์ตคัต `Ctrl/Cmd + .` ในการเปิด/ปิด Chat Panel เพื่อการเข้าถึงที่รวดเร็ว (Accessibility)
- **FR-006**: ระบบต้องแสดง Suggested Actions ในรูปของปุ่ม Chip ใต้ข้อความของ AI และเมื่อคลิกจะส่งข้อความนั้นเข้าสู่สนทนาโดยอัตโนมัติ
- **FR-007**: ระบบต้องบันทึกเหตุการณ์การถามตอบทั้งหมดลงใน `ai_audit_logs` ผ่าน API หลังการสนทนาแต่ละครั้ง รวมถึง Latency, ContextType, Query, ResponseType
- **FR-008**: ระบบต้องรักษาประวัติสนทนาใน Session Storage ตราบใดที่ยังอยู่ใน Session ปัจจุบัน และเคลียร์ประวัติเมื่อจบ session หรือปิดหน้าจอหลัก

### Key Entities

- **ChatMessage**: ตัวแทนของแต่ละข้อความในประวัติสนทนา ประกอบด้วย `id` (UUIDv7 string), `role` ('user' | 'assistant' | 'system'), `content` (string), `timestamp` (Date), `suggestedActions` (array of actions)
- **SuggestedAction**: ปุ่มนำเสนอเพื่อให้ผู้ใช้กดทำงานต่อ ประกอบด้วย `label` (ข้อความปุ่ม), `query` (คำสั่งที่จะส่งหา AI เมื่อกด)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: ผู้ใช้งานสามารถเปิด/ปิด AI Chat panel ได้ภายใน 200ms ด้วยความลื่นไหลของการแสดงผล Animation (Slide in/out)
- **SC-002**: ระบบสามารถแนบ context ของเอกสารที่เปิดอยู่ได้อย่างสมบูรณ์ 100% โดยไม่มีข้อผิดพลาดด้านความเข้ากันได้ของข้อมูล
- **SC-003**: ผู้ใช้พึงพอใจและสามารถเข้าถึงข้อมูลของหน้าจอหลักขณะเปิด Panel สนทนาได้โดยไม่มีส่วนสำคัญของเอกสารถูกบดบังบน Desktop
- **SC-004**: เมื่อเกิดปัญหา Network error ระบบต้องใช้เวลาน้อยกว่า 500ms ในการตรวจจับและแสดง UI แจ้งเตือนข้อผิดพลาดพร้อมปุ่มให้ Retry
