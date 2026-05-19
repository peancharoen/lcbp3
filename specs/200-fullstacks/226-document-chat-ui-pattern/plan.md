// File: specs/200-fullstacks/226-document-chat-ui-pattern/plan.md
// Change Log:
// - 2026-05-19: Initial implementation plan for Document Chat UI Pattern

# Implementation Plan: Document Chat UI Pattern

**Branch**: `226-document-chat-ui-pattern` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/226-document-chat-ui-pattern/spec.md`

---

## Summary (สรุปแนวทางเชิงเทคนิค)

ฟีเจอร์นี้เป็นการพัฒนาส่วนต่อประสานกับผู้ใช้ (Frontend UI) ร่วมกับ Next.js 16 (App Router), TailwindCSS, Radix UI/shadcn, และ React Hook Form + Zod เพื่อสร้างแผงควบคุมระบบสนทนาของ AI Assistant ในหน้าแสดงผลเอกสารของระบบ LCBP3 DMS โดยจะประมวลผลข้อมูลผ่าน API `/api/ai/chat` โดยอัตโนมัติแนบบริบทของเอกสาร เช่น `documentType` และ UUIDv7 `publicId` (หลีกเลี่ยง Integer PK ตามกฎ Tier 1 ADR-019) และจัดเก็บการสนทนาทั้งหมดไว้ภายใน Session Storage (Client-side) ตามขอบเขตการทำงานของระยะแรก

---

## Technical Context (บริบททางเทคนิค)

- **Language/Version**: TypeScript / Node.js >= 24 / Next.js 16
- **Primary Dependencies**: Radix UI (Sheet / Dialog / ScrollArea / Button / Badge), TanStack React Query v5, TailwindCSS 3.4.3, Lucide React, Axios, Zod, Zustand
- **Storage**: Client-side Session Storage สำหรับจัดเก็บข้อความแชทในปัจจุบันต่อเอกสารย่อย
- **Testing**: Vitest + React Testing Library (สำหรับ Component Unit Tests)
- **Target Platform**: เว็บเบราว์เซอร์ที่รองรับ Responsive ทั้งเครื่องคอมพิวเตอร์สำนักงาน (1920x1080) และแท็บเล็ตหน้างาน (768x1024)
- **Project Type**: Next.js App Router Web Application (`frontend/`)
- **Performance Goals**: การเปิด/ปิด Chat Panel Animation ต้องใช้เวลาเพียง 200ms เท่านั้น (Slide transition), UI ต้องตอบสนองต่อผู้ใช้ทันทีเมื่อมีสัญญาณเตือนหรือเกิดข้อผิดพลาด
- **Constraints**: ต้องไม่มีการหลุดของ Integer Primary Key ไปยัง LLM หรือ API Payload เป็นอันขาด (Tier 1 Blocker), ต้องรองรับการกรองตามบริบทโครงการผ่าน CASL permissions

---

## Constitution Check (การตรวจสอบความถูกต้องร่วมกับรัฐธรรมนูญโครงการ)

_GATE: ผ่านการทดสอบทั้งหมด_

- [x] **UUID Strategy (ADR-019)**: ระบบใช้ UUIDv7 `publicId` เป็นตัวชี้วัดเอกสารในการแนบบริบท (Context Injection) เท่านั้น ไม่มีการใช้ integer id หรือ fallback `id ?? ''`
- [x] **Security (ADR-016)**: API Route `/api/ai/chat` จะถูกคลุมด้วย Authentication Guard และมีการ Enforce CASL สิทธิ์ของผู้ใช้ในการอ่านเอกสารนั้นๆ ผ่าน AI Gateway ก่อนจะเรียกใช้งาน
- [x] **AI Subsystem boundary (ADR-023A)**: AI Subsystem ทำงานแบบ Read-only Insight และ Action suggestion เท่านั้น ห้ามทำการเปลี่ยนสถานะเอกสาร (Transition) โดยตรงผ่านแชทโดยไม่มีการยืนยันจากผู้ใช้ (Human-in-the-loop)
- [x] **Error Handling (ADR-007)**: มีการจัดการเครือข่ายขัดข้องและ AI Timeout อย่างสง่างาม แสดงคำอธิบายที่ใช้งานง่ายโดยไม่เปิดเผยข้อมูลเซิร์ฟเวอร์ภายใน

---

## Project Structure (โครงสร้างไฟล์ที่เกี่ยวข้องในฟีเจอร์นี้)

### Documentation (เอกสารการออกแบบและพัฒนา)
```text
specs/200-fullstacks/226-document-chat-ui-pattern/
├── spec.md              # Feature specification
├── plan.md              # แผนการทางเทคนิคฉบับนี้
├── research.md          # ผลวิจัยการจัดวางและการเก็บสถานะข้อมูล
├── data-model.md        # รายละเอียดชนิดข้อมูลฝั่ง Frontend และ API Payload DTO
├── quickstart.md        # คู่มือการเริ่มต้นพัฒนาและรัน Test
└── contracts/
    └── chat-api.yaml    # OpenAPI Specification ของ Chat Endpoint
```

### Source Code (โครงสร้างไฟล์โค้ดของระบบ)
```text
frontend/
├── app/
│   └── api/
│       └── ai/
│           └── chat/
│               └── route.ts         # Next.js API Route สำหรับ Chat proxy ไปยัง Backend AI Gateway
├── components/
│   └── ai/
│       ├── ai-chat-panel.tsx        # คอมโพเนนต์หลักที่ประกอบด้วย Sheet / Panel สำหรับแต่ละ Breakpoint
│       ├── ai-chat-toggle.tsx       # ปุ่มสำหรับสลับเปิด/ปิด Chat Panel (และปุ่มลอยสำหรับอุปกรณ์พกพา)
│       ├── ai-chat-messages.tsx     # รายการประวัติสนทนาและการเรนเดอร์ Message Bubbles ตาม Role
│       ├── ai-chat-input.tsx        # ช่องพิมพ์คำสั่ง ปุ่มส่งคำถาม และปุ่มลัด
│       └── ai-suggested-actions.tsx # แถบ Badge Chip แนะนำการทำงานต่อเนื่อง
└── hooks/
    └── use-ai-chat.ts               # React hook สำหรับจัดการ API และเก็บสถานะลง Session Storage
```
