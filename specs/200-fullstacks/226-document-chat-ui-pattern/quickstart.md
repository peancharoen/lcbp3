// File: specs/200-fullstacks/226-document-chat-ui-pattern/quickstart.md
// Change Log:
// - 2026-05-19: Initial developer quickstart guide for Document Chat UI Pattern

# Developer Quickstart Guide: Document Chat UI Pattern

คู่มือแนะนำขั้นตอนการทำความเข้าใจ การทดสอบ และการตรวจสอบการทำงานของฟีเจอร์ AI Document Chat ในฝั่ง Frontend และการเชื่อมต่อกับ Backend AI Gateway (226)

---

## 1. การติดตั้งโค้ดและส่วนประกอบหลัก (Component Architecture)

โครงสร้างโฟลเดอร์ฝั่งไคลเอนต์จะอยู่ที่:
```text
frontend/components/ai/
├── ai-chat-panel.tsx           # คอมโพเนนต์หลักที่ประกอบด้วย Sheet / Panel สำหรับแต่ละ Breakpoint
├── ai-chat-toggle.tsx          # ปุ่มสำหรับสลับเปิด/ปิด Chat Panel (และปุ่มลอยสำหรับอุปกรณ์พกพา)
├── ai-chat-messages.tsx        # รายการประวัติสนทนาและการเรนเดอร์ Message Bubbles ตาม Role
├── ai-chat-input.tsx           # กล่องพิมพ์คำสั่ง ปุ่มส่งคำถาม และปุ่มลัด
├── ai-suggested-actions.tsx    # แถบ Badge Chip แนะนำการทำงานต่อเนื่อง
└── hooks/
    └── use-ai-chat.ts          # คอนเท็กซ์และฮุกของ React / TanStack Query ในการจัดการ API และ State
```

---

## 2. การเปิดใช้งานและตั้งค่าพัฒนา (Development Setup)

### 2.1 รันระบบ Frontend ในโหมดพัฒนา
เปิด PowerShell (เนื่องจากทำงานบน Windows OS ตามกฎ) และรันคำสั่ง:
```powershell
cd frontend
pnpm dev
```
ระบบจะเริ่มต้นที่พอร์ต `http://localhost:3000`

### 2.2 โครงสร้าง API Mockup สำหรับการพัฒนาช่วงแรก
ในระหว่างการพัฒนาฝั่ง Frontend สามารถเปิดการใช้งาน Mock Data ใน `use-ai-chat.ts` หรือจำลองการทำงานโดยการทดสอบผ่าน `/api/ai/chat` Mock Route ได้

---

## 3. ขั้นตอนการทดสอบการใช้งานด้วยตนเอง (Manual Testing Steps)

### 3.1 การตรวจสอบบน Desktop (ขนาดหน้าจอ ≥ 1024px)
1. เข้าสู่หน้าเอกสาร เช่น `/rfas/019505a1-7c3e-7000-8000-abc123def456`
2. มองหาปุ่ม **AI Chat** ทางขวาบนของเอกสาร
3. คลิกปุ่มเพื่อเปิดใช้งาน Chat Panel (จะเห็นการ Slide-in เข้ามาจากทางขวาอย่างราบรื่นใช้เวลา 200ms)
4. พิมพ์ทดสอบสนทนาในช่องพิมพ์ หรือกดคีย์ลัด `Ctrl + .` เพื่อเปิด/ปิด Panel

### 3.2 การตรวจสอบความเข้ากันได้ของการแสดงผล (Responsive Test)
1. เปิด Developer Tools ในเว็บเบราว์เซอร์ แล้วเลือกขนาดหน้าจอเป็น Tablet (768px - 1023px)
2. ตรวจสอบว่าขนาดของ Panel กว้างขึ้นเป็นประมาณ 30% ของ viewport หรือไม่
3. เปลี่ยนขนาดหน้าจอเป็น Mobile (< 768px)
4. ยืนยันว่าปุ่มสลับกลายเป็นปุ่มลอย และเมื่อกดแล้วแชทเลื่อนขึ้นมาจากด้านล่าง (Bottom Sheet สูง 60% ของจอ)

---

## 4. การรันชุดทดสอบอัตโนมัติ (Automated Testing)

ฟีเจอร์นี้ครอบคลุมการตรวจสอบความถูกต้องด้วยชุดทดสอบผ่าน **Vitest** ในฝั่ง Frontend:

```powershell
# รันการทดสอบทั้งหมดของ AI module
cd frontend
pnpm test components/ai
```

### สิ่งที่ชุดทดสอบจะยืนยัน:
- `ai-chat-panel.tsx` สามารถปิดและเปิดได้จริงเมื่อรับคำสั่ง Action
- `use-ai-chat.ts` สามารถแปลงและแนบพารามิเตอร์ `contextType` และ `contextPublicId` ได้อย่างสมบูรณ์โดยไม่มีการใช้ Integer ID หลุดออกไป (Tier 1 UUID Compliance)
