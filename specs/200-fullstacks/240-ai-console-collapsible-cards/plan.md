# Implementation Plan: AI Console Collapsible Cards

**Branch**: `[240-ai-console-collapsible-cards]` | **Date**: 2026-06-19 | **Spec**: [spec.md](file:///e:/np-dms/lcbp3/specs/200-fullstacks/240-ai-console-collapsible-cards/spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/240-ai-console-collapsible-cards/spec.md`

## Summary

ปรับปรุงหน้า AI Console (/admin/ai) ให้รองรับการย่อ/ขยาย (Collapsible) สำหรับการ์ดการตรวจติดตามสุขภาพระบบ AI (Monitoring Cards) เพื่อให้ Superadmin สามารถบริหารจัดการพื้นที่หน้าจอได้ดีขึ้นระหว่างการทดสอบระบบ Sandbox:
1. เพิ่มส่วนหัวของกลุ่มการ์ดพร้อมปุ่มย่อ/ขยายระบบตรวจติดตามทั้งหมด (Master Collapse)
2. เพิ่มปุ่มย่อ/ขยายการ์ดแต่ละใบแบบอิสระ (Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM)
3. เก็บสถานะการย่อ/ขยายไว้ใน `localStorage` เพื่อให้คงสถานะไว้เมื่อรีเฟรชหน้าเว็บหรือเปลี่ยนแท็บ

## Technical Context

**Language/Version**: TypeScript 5.x, React, Next.js 16 (Client Components)
**Primary Dependencies**:
- Frontend: `lucide-react` (สำหรับไอคอน `ChevronUp` หรือ `ChevronDown`)
- Tailwind CSS (สำหรับทำ transition: `transition-all duration-300 ease-in-out`, `max-h-0`, `max-h-[500px]`, `rotate-180`)
- `localStorage` (สำหรับ persistence)

**Storage**: `localStorage` ในเบราว์เซอร์
**Testing**: การตรวจสอบสไตล์ UI/UX และการทำงานแบบ Manual เท่านั้น

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| 2 projects max | PASS | เปลี่ยนแปลงเฉพาะหน้า UI บน Frontend |
| Language aligned | PASS | โค้ดภาษาอังกฤษ เอกสารภาษาไทย |
| Storage aligned | PASS | ใช้ localStorage บนฝั่งไคลเอนต์เท่านั้น |
| Test coverage | PASS | UI/UX refactor เน้นการทำ manual validation |

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/240-ai-console-collapsible-cards/
├── plan.md              # This file
├── spec.md              # Feature specification
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code

```text
frontend/
└── app/(admin)/admin/ai/
    └── page.tsx         # AI Console page (modify)
```

**Structure Decision**: Web application (frontend only refactor). แก้ไขไฟล์ `frontend/app/(admin)/admin/ai/page.tsx` เพียงไฟล์เดียวเพื่อควบคุมสถานะและการเคลื่อนไหวแบบ Collapsible

## Proposed Changes

### [Component Name] Next.js Frontend Page

#### [MODIFY] [page.tsx](file:///e:/np-dms/lcbp3/frontend/app/(admin)/admin/ai/page.tsx)

1. **Imports**:
   - เพิ่มการนำเข้าไอคอน `ChevronUp` (หรือ `ChevronDown`) จาก `lucide-react`

2. **React States & Effects**:
   - เพิ่ม `isSectionCollapsed` (boolean) เริ่มต้นเป็น `false`
   - เพิ่ม `collapsedCards` (object) สำหรับเก็บสถานะการย่อของการ์ดแต่ละใบ:
     ```typescript
     const [isSectionCollapsed, setIsSectionCollapsed] = useState<boolean>(false);
     const [collapsedCards, setCollapsedCards] = useState<{
       ollama: boolean;
       qdrant: boolean;
       ocr: boolean;
       bullmq: boolean;
       vram: boolean;
     }>({
       ollama: false,
       qdrant: false,
       ocr: false,
       bullmq: false,
       vram: false,
     });
     ```
   - เพิ่ม `useEffect` สำหรับโหลดค่าสถานะเหล่านี้จาก `localStorage` ตอนเริ่มต้นโหลดหน้าเว็บ:
     ```typescript
     useEffect(() => {
       const savedSection = localStorage.getItem('ai_console_section_collapsed');
       if (savedSection !== null) {
         setIsSectionCollapsed(savedSection === 'true');
       }
       const savedCards = localStorage.getItem('ai_console_cards_collapsed');
       if (savedCards) {
         try {
           setCollapsedCards(JSON.parse(savedCards));
         } catch (e) {
           // เงียบข้อผิดพลาด
         }
       }
     }, []);
     ```
   - เพิ่มฟังก์ชันเพื่อบันทึกสถานะลง `localStorage` ทุกครั้งที่มีการเปลี่ยนค่า:
     ```typescript
     const toggleSection = () => {
       const nextVal = !isSectionCollapsed;
       setIsSectionCollapsed(nextVal);
       localStorage.setItem('ai_console_section_collapsed', String(nextVal));
     };

     const toggleCard = (cardKey: keyof typeof collapsedCards) => {
       const nextCards = { ...collapsedCards, [cardKey]: !collapsedCards[cardKey] };
       setCollapsedCards(nextCards);
       localStorage.setItem('ai_console_cards_collapsed', JSON.stringify(nextCards));
     };
     ```

3. **Master Section Toggle Header**:
   - ด้านบนของกลุ่มการ์ด เพิ่มส่วนหัวของระบบตรวจติดตาม (Monitoring Header):
     ```tsx
     <div className="flex items-center justify-between border-b pb-2 mb-4">
       <h2 className="text-lg font-semibold flex items-center gap-2">
         <Activity className="h-5 w-5 text-primary" />
         AI Engine Infrastructure Monitoring
       </h2>
       <Button
         variant="ghost"
         size="icon"
         className="h-8 w-8 text-muted-foreground hover:text-foreground"
         onClick={toggleSection}
       >
         <ChevronUp className={`h-5 w-5 transition-transform duration-300 ${isSectionCollapsed ? 'rotate-180' : ''}`} />
       </Button>
     </div>
     ```

4. **Grid Animation Wrapper**:
   - ครอบกลุ่มการ์ดด้วยดิฟที่มีคลาสทำ transition:
     ```tsx
     <div className={`grid gap-4 md:grid-cols-3 transition-all duration-300 ease-in-out ${
       isSectionCollapsed ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none' : 'max-h-[2000px] opacity-100'
     }`}>
     ```

5. **Individual Card Adjustments**:
   - เพิ่มปุ่มย่อ/ขยายถัดจากสถานะในแต่ละการ์ด (Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM)
   - ครอบเนื้อหา `<CardContent>` (รวมถึงส่วนข้อมูลเพิ่มเติม) เพื่อย่อ/ขยายด้วย transition:
     ```tsx
     <div className={`transition-all duration-300 ease-in-out ${
       collapsedCards.ollama ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[500px] opacity-100'
     }`}>
       <CardContent className="space-y-2">
         ...
       </CardContent>
     </div>
     ```
   - สลับไอคอน chevron ตามสถานะการย่อ/ขยาย

## Verification Plan

### Automated Tests
- ตรวจสอบชนิดข้อมูล (Type Checking):
  `pnpm --filter lcbp3-frontend exec tsc --noEmit`
- ตรวจสอบรูปแบบโค้ด (Linting):
  `pnpm --filter lcbp3-frontend exec eslint .`

### Manual Verification
1. เปิดหน้า AI Console ในแอปพลิเคชัน
2. คลิกปุ่มย่อ/ขยายระบบติดตามตรวจสอบทั้งหมด (Master Collapse) และดูการตอบสนอง
3. คลิกปุ่มย่อ/ขยายในการ์ดแต่ละใบและดูการย่อ/ขยายเฉพาะเนื้อหา
4. โหลดหน้าเว็บซ้ำ (F5) และยืนยันว่าสถานะการย่อ/ขยายในแต่ละปุ่มถูกรักษาไว้ด้วย `localStorage`
5. สลับแท็บไปที่ RAG Playground หรือ 3-Step Pipeline Sandbox และสลับกลับมายืนยันว่าสถานะคงเดิม
