# ADR-026: Document Chat UI Pattern

**Status:** Accepted
**Date:** 2026-05-19
**Decision Makers:** Development Team, UX Lead, System Architect
**Related Documents:**
- [ADR-025: AI Tool Layer Architecture](./ADR-025-ai-tool-layer-architecture.md)
- [ADR-024: Intent Classification Strategy](./ADR-024-intent-classification-strategy.md)
- [ADR-023A: Unified AI Architecture — Model Revision](./ADR-023A-unified-ai-architecture.md)
- [CONTEXT.md](../../CONTEXT.md)

> **หมายเหตุ:** ADR นี้กำหนดรูปแบบ UI สำหรับ Document Chat — ช่องสนทนากับ AI ใน context ของเอกสารที่กำลังดูอยู่ เป็นการเชื่อมต่อระหว่างผู้ใช้กับ AI Runtime Layer (ADR-024/025)

---

## Context and Problem Statement

เมื่อ Intent Classifier (ADR-024) และ AI Tool Layer (ADR-025) พร้อมใช้งาน ผู้ใช้ต้องการช่องทางโต้ตอบกับ AI ใน context ของเอกสารที่กำลังดูอยู่

ความท้าทาย:
1. **Context switching** — ถ้าเปิดหน้าใหม่ ผู้ใช้จะเสีย context ของเอกสารที่กำลังดู
2. **Screen real estate** — หน้าจอต้องแสดงทั้งเอกสารและ chat พร้อมกัน
3. **Multi-device** — ต้องรองรับ desktop (จอใหญ่) และ tablet (ไซต์ก่อสร้าง)
4. **Workflow continuity** — ผู้ใช้อาจสลับไปมาระหว่างดูเอกสารและถาม AI หลายครั้ง

---

## Decision Drivers

- **Preserve document context** — ผู้ใช้ต้องเห็นเอกสารและ chat พร้อมกัน
- **Minimize interruption** — ไม่ควร block หน้าจอ หรือพาไปหน้าใหม่
- **Responsive design** — รองรับ 1920×1080 (office) ถึง 768×1024 (tablet ไซต์)
- **Collapsible** — ผู้ใช้ควบคุมได้ว่าจะเปิด/ปิด chat หรือไม่
- **Consistent placement** — อยู่ตำแหน่งเดียวกันทุกหน้า เพื่อ muscle memory

---

## Considered Options

### Option A: Modal (Overlay Dialog)

Chat แสดงเป็น modal กลางจอ พร้อม backdrop มืด

**Pros:**
- Implement ง่าย ใช้ shadcn Dialog ได้เลย
- โฟกัสที่ chat สุดๆ ไม่มีสิ่งรบกวน

**Cons:**
- ❌ บดบังเอกสารทั้งหมด — เสีย context
- ❌ ปิด modal = สนทนาหาย — ไม่เหมาะกับการสลับไปมา
- ❌ ไม่เห็นข้อมูลเอกสารระหว่างพิมพ์คำถาม

### Option B: Separate Page (/documents/[id]/chat)

Chat เป็นหน้าแยกต่างหาก มี URL ของตัวเอง

**Pros:**
- URL shareable — ส่งลิงก์สนทนาให้คนอื่นได้
- หน้าจอเต็มที่สำหรับ chat history ยาวๆ

**Cons:**
- ❌ Context switching รุนแรง — ต้องกด Back เพื่อดูเอกสาร
- ❌ ต้องโหลดเอกสารซ้ำในหน้า chat (หรือเก็บ state ซับซ้อน)
- ❌ ไม่สามารถดูเอกสารและ chat พร้อมกัน

### Option C: Side-panel (Right side, collapsible) ✅ (เลือก)

Chat แสดงเป็น panel ทางขวา กด toggle เปิด/ปิดได้

**Pros:**
- ✅ เอกสารยังเห็นอยู่ — context ไม่หาย
- ✅ สลับไปมาง่าย — toggle เปิด/ปิดไม่กระทบเอกสาร
- ✅ รองรับ responsive — desktop (fixed 400px), tablet (30% width), mobile (bottom sheet)
- ✅ ตำแหน่ง consistent — อยู่ขวาทุกหน้า

**Cons:**
- เอกสารหลักเหลือพื้นที่น้อยลงเมื่อเปิด chat
- Implement resizable ซับซ้อนกว่า modal (แต่ v1 ใช้ fixed width)

---

## Decision

**เลือก Option C: Right-side collapsible side-panel**

---

## Layout Specification

### Desktop (≥ 1024px)

```
┌─────────────────────────────────────────────────────────────┐
│  Header                                                     │
├─────────────────────────────────────┬───────────────────────┤
│                                     │                       │
│  Document Content                   │  [Toggle] AI Chat     │
│  (remaining width)                │  ─────────────────    │
│                                     │  User: สรุป RFA นี้   │
│  • Drawing A-101                    │  ─────────────────    │
│  • Revision 3                       │  AI: ตอบ...           │
│  • Status: Approved                 │  ─────────────────    │
│                                     │  [Suggested Actions]  │
│                                     │  • View latest RFA    │
│                                     │  • Create new RFA     │
│                                     │                       │
└─────────────────────────────────────┴───────────────────────┘
```

- **Panel width:** 400px (fixed)
- **Toggle button:** มุมขวาบนของเอกสาร (แยกจาก panel)
- **Animation:** slide in/out 200ms ease-out
- **Z-index:** 40 (สูงกว่าเอกสาร แต่ต่ำกว่า modal/dialog อื่น)

### Tablet (768px – 1023px)

```
┌────────────────────────────────────────┐
│  Header                                │
├────────────────────┬───────────────────┤
│                    │                   │
│  Document          │  AI Chat (30%)    │
│  (70%)             │                   │
│                    │                   │
└────────────────────┴───────────────────┘
```

- **Panel width:** 30% of viewport
- **Min-width:** 320px (ถ้าน้อยกว่า ให้เป็น overlay แทน)

### Mobile (< 768px)

```
┌─────────────────────────────┐
│  Header                     │
├─────────────────────────────┤
│                             │
│  Document Content           │
│  (เต็มจอ)                   │
│                             │
│                             │
├─────────────────────────────┤
│  [💬] Toggle Chat           │  ← floating button
└─────────────────────────────┘

เมื่อกด Toggle:
┌─────────────────────────────┐
│  Header                     │
├─────────────────────────────┤
│  AI Chat (Bottom Sheet)     │
│  ─────────────────────      │
│  สูง 60% ของจอ              │
│                             │
│  [Drag handle]              │
└─────────────────────────────┘
```

- **Pattern:** Bottom sheet (shadcn Sheet with side="bottom")
- **Height:** 60% of viewport (expandable to 90%)
- **Backdrop:** มี overlay มืดบางๆ บนเอกสาร

---

## Component Structure

```
frontend/components/ai/
├── ai-chat-panel.tsx           ← หลัก (รวมทุก breakpoint)
├── ai-chat-toggle.tsx          ← ปุ่มเปิด/ปิด (floating บน mobile)
├── ai-chat-messages.tsx        ← message list + bubble
├── ai-chat-input.tsx           ← input + send button
├── ai-suggested-actions.tsx    ← action chips
└── hooks/
    └── use-ai-chat.ts          ← TanStack Query + state
```

---

## State Management

### Local State (per page)

```typescript
// useAiChat hook
interface AiChatState {
  isOpen: boolean;           // panel เปิดอยู่หรือไม่
  messages: ChatMessage[];   // สนทนาใน session นี้
  isLoading: boolean;      // AI กำลังตอบ
  suggestedActions: SuggestedAction[]; // actions ล่าสุดจาก AI
}
```

### Persistence

- **Session storage:** เก็บ `messages` ต่อ session (refresh = หาย)
- **No server persistence:** v1 ไม่เก็บ chat history บน server (ลด scope)
- **Context preservation:** `documentPublicId` + `documentType` ส่งทุก request เพื่อให้ AI รู้ context

---

## Integration with AI Runtime Layer

### Request Flow

```
User พิมพ์ใน Chat Input
    │
    ▼
AiChatInput → useAiChat.sendMessage()
    │
    ▼
POST /api/ai/chat
{
  "query": "สรุปเอกสารนี้",
  "context": {
    "type": "drawing",
    "publicId": "0195..."
  }
}
    │
    ▼
AI Gateway (ADR-023A)
    │
    ├─→ Intent Classifier (ADR-024)
    │
    ├─→ AI Tool Layer (ADR-025) ถ้าเป็น GET_* intent
    │
    └─→ RAG Pipeline ถ้าเป็น RAG_QUERY
    │
    ▼
Ollama (gemma4:e4b Q8_0)
    │
    ▼
Response → Stream/Chunk → UI
```

### Context Injection

ทุก request อัตโนมัติแนบ `context` จากหน้าปัจจุบัน:

| Page | context.type | context.publicId |
|------|--------------|------------------|
| /drawings/[id] | "drawing" | drawing.publicId |
| /rfas/[id] | "rfa" | rfa.publicId |
| /transmittals/[id] | "transmittal" | transmittal.publicId |
| /correspondences/[id] | "correspondence" | correspondence.publicId |

---

## UX Patterns

### Initial State

- **Default:** Panel ปิด (ผู้ใช้ต้องกดเปิดเอง)
- **First visit:** แสดง subtle hint (pulse animation ที่ toggle button) ครั้งเดียว
- **Returning user:** จำ state จาก session storage (ถ้าเคยเปิดไว้ → เปิดต่อ)

### Message Types

| Type | ลักษณะ | ตัวอย่าง |
|------|--------|----------|
| **User** | ขวา, primary color | "สรุป RFA นี้ให้หน่อย" |
| **AI Text** | ซ้าย, สีธรรมดา | ข้อความตอบ |
| **AI Tool Result** | ซ้าย, card style | รายการ RFA 3 รายการ |
| **AI Suggestion** | ซ้ายล่าง, chip buttons | "ควรสร้าง RFA ใหม่?" |
| **System** | กลาง, จางๆ | "กำลังเชื่อมต่อ AI..." |

### Suggested Actions

AI ตอบพร้อม suggested actions (ถ้ามี):

```
┌─────────────────────────────────┐
│ AI: สรุป RFA-0042                 │
│ • ส่ง 2024-05-10                  │
│ • สถานะ: รอตอบกลับ                │
│ • มี 3 drawings                   │
├─────────────────────────────────┤
│ [ดู RFA ฉบับเต็ม] [สร้าง RFA ตัวถัดไป] │
└─────────────────────────────────┘
```

- Action กดได้ทันที ไม่ต้องพิมพ์ใหม่
- ถ้ากด → ส่ง query ใหม่อัตโนมัติ (เช่น "ดู RFA ฉบับเต็ม")

---

## Error Handling

### Network Error

- แสดง "ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่" + ปุ่ม Retry
- ไม่ clear messages ที่มีอยู่

### AI Timeout (> 10s)

- แสดง "AI ตอบช้าเกินไป กรุณาลองอีกครั้ง"
- Log ใน ai_audit_logs สำหรับ debug

### Permission Error (จาก Tool Layer)

- แสดง "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" (จาก message ที่ Tool Layer คืน)
- ไม่ expose technical details

---

## Accessibility

- **Keyboard:** Toggle ด้วย `Ctrl/Cmd + .` (custom shortcut)
- **Focus trap:** เมื่อ panel เปิด focus อยู่ใน panel จนกว่าจะปิด
- **Screen reader:** อ่าน "AI Chat panel opened" / "AI message received"
- **Reduced motion:** ปิด animation เมื่อ user ตั้งค่า reduced motion

---

## Audit & Observability

ทุก interaction บันทึกใน `ai_audit_logs`:

```json
{
  "action": "chat_message",
  "contextType": "drawing",
  "contextPublicId": "0195...",
  "query": "สรุปเอกสารนี้",
  "responseType": "text",
  "hasSuggestedActions": true,
  "latencyMs": 2500,
  "projectPublicId": "...",
  "userPublicId": "..."
}
```

---

## Consequences

### Positive
- Context ของเอกสารไม่หายระหว่างถาม AI
- สลับไปมาระหว่างเอกสารและ chat ได้ราบรื่น
- Responsive รองรับทั้ง office และไซต์ก่อสร้าง
- ตำแหน่ง consistent — ผู้ใช้รู้ว่าหา chat ที่ไหน

### Negative
- เอกสารหลักเหลือพื้นที่น้อยลงบนจอเล็ก (แต่ collapsible ช่วยได้)
- Mobile bottom sheet อาจบดบังเนื้อหาส่วนล่างของเอกสาร
- Chat history ไม่ persist (refresh หาย) — v2 อาจเพิ่ม server persistence

### Risks
- User เปิด chat ทิ้งไว้แล้วลืม → สิ้นเปลืองพื้นที่จอ → mitigate ด้วย auto-collapse เมื่อ navigate ไปหน้าอื่น
- Mobile bottom sheet gesture ชนกับ scrolling → mitigate ด้วย drag handle ชัดเจน

---

## Out of Scope (Phase 4)

- **Multi-document chat** — chat ที่ context หลายเอกสารพร้อมกัน
- **Persistent chat history** — เก็บสนทนาย้อนหลังบน server
- **Real-time collaboration** — หลายคน chat ในห้องเดียวกัน
- **Voice input** — พิมพ์อย่างเดียว (v1)

---

## Migration Notes (ADR-009)

- ไม่มี schema change — ADR-026 เป็น frontend-only decision
- ใช้ตาราง `ai_audit_logs` ที่มีอยู่แล้วสำหรับ logging
- เพิ่ม component ใน `frontend/components/ai/`

