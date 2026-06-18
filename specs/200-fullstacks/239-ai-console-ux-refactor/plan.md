# Implementation Plan: AI Console UX Refactor

**Branch**: `[239-ai-console-ux-refactor]` | **Date**: 2026-06-18 | **Spec**: `/specs/200-fullstacks/239-ai-console-ux-refactor/spec.md`
**Input**: Feature specification from `/specs/200-fullstacks/239-ai-console-ux-refactor/spec.md`

## Summary

ปรับปรุง UX ของ AI Console ให้ถูกต้องและเข้าใจง่ายขึ้นสำหรับ Superadmin โดย:
1. แก้ไขคำอธิบายหน้า AI Console ให้ถูกต้อง (ไม่ใช่ "สำหรับผู้ใช้ทั่วไป")
2. จัดวาง Health Monitoring Cards ให้เห็นได้ทุก tab หรือย้ายไปอยู่ด้านบนของหน้า
3. เปลี่ยนชื่อ tab "OCR Sandbox" เป็น "3-Step Pipeline Sandbox" ให้สอดคล้องกับ spec 238

## Technical Context

**Language/Version**: TypeScript 5.x (Frontend), Next.js 14

**Primary Dependencies**:
- Frontend: Next.js 14, React, shadcn/ui, TanStack Query, Lucide icons

**Target Platform**: On-premises (QNAP NAS + Admin Desktop)

**Project Type**: Web application (frontend only refactor)

**Constraints**:
- ไม่เปลี่ยน backend API
- ไม่เปลี่ยน business logic
- เปลี่ยนเฉพาะ UI/UX และคำอธิบาย

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| 2 projects max | PASS | frontend only |
| Language aligned | PASS | TypeScript |
| Storage aligned | N/A | UI refactor only |
| Test coverage | PASS | E2E test verification |

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/239-ai-console-ux-refactor/
├── plan.md              # This file
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created yet)
```

### Source Code (repository root)

```text
frontend/
├── app/(admin)/admin/ai/
│   └── page.tsx         # AI Console page (main file to modify)
└── components/admin/ai/
    └── SandboxTabs.tsx  # 3-Step Sandbox component (reference only)
```

**Structure Decision**: Web application (frontend only refactor). This feature modifies only the AI Console page in the frontend admin section. No backend changes, database changes, or new components are required.

## Complexity Tracking

> No complexity violations detected. Feature fits within standard project boundaries.

## Current Issues Analysis

### Issue 1: คำอธิบาย AI Console ไม่ถูกต้อง

**Location**: `frontend/app/(admin)/admin/ai/page.tsx` บรรทัด 255

**Current**:
```tsx
<p className="mt-1 text-sm text-muted-foreground">ควบคุมสถานะ AI features สำหรับผู้ใช้ทั่วไป</p>
```

**Problem**:
- คำว่า "สำหรับผู้ใช้ทั่วไป" ทำให้เข้าใจผิดว่าหน้านี้สำหรับ user ทั่วไป
- แต่จริงๆ แล้ว AI Console คือหน้า Superadmin สำหรับ:
  - ตรวจสอบสุขภาพระบบ AI (Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM)
  - เปิด/ปิด AI features สำหรับผู้ใช้ทั่วไป
  - ทดสอบ RAG Playground และ 3-Step Pipeline Sandbox

**Correct Description**:
```tsx
<p className="mt-1 text-sm text-muted-foreground">ควบคุมและตรวจสอบระบบ AI สำหรับ Superadmin</p>
```

### Issue 2: Health Monitoring Cards อยู่ใน Overview tab เท่านั้น

**Location**: `frontend/app/(admin)/admin/ai/page.tsx` บรรทัด 267-539

**Current Structure**:
```
AI Console
├── Overview & Health Tab
│   ├── Ollama AI Engine Card
│   ├── Qdrant Vector DB Card
│   ├── OCR Sidecar Card
│   ├── BullMQ Queue Health Card
│   ├── VRAM GPU Monitor Card
│   ├── System Toggle Card
│   └── Protection/Polling Cards
├── RAG Playground Tab
└── OCR Sandbox Tab
```

**Problem**:
- Health cards สำคัญสำหรับ Superadmin ในการตรวจสอบสถานะระบบ
- แต่ถ้า admin อยู่ใน tab "RAG Playground" หรือ "OCR Sandbox" จะไม่เห็น health status
- ตาม ADR-027: "Single page layout + 5s job polling + inline error" แต่ไม่ได้ระบุว่า health cards ควรอยู่ที่ไหน

**Design Options**:

**Option A: Health Cards อยู่ด้านบนทุก tab (Recommended)**
- ย้าย health cards ออกจาก `TabsContent` มาอยู่ก่อน `<Tabs>` component
- แสดง health cards ทุก tab เหมือนกัน
- เหมาะสมกับ use case: Superadmin ต้องเห็น health status ตลอดเวลาเมื่อทดสอบ sandbox

**Option B: Health Cards อยู่ใน Overview tab เท่านั้น**
- คงโครงสร้างเดิม
- Admin ต้อง switch กลับมา Overview tab เพื่อดู health status
- ไม่เหมาะสมกับ use case: ทดสอบ sandbox แล้วต้อง check health ทันที

**Option C: Health Cards อยู่ใน Sidebar แยก**
- สร้าง sidebar ด้านซ้ายสำหรับ health monitoring
- Tabs อยู่ด้านขวา
- ซับซ้อนกว่า Option A

**Decision**: **Option A** - Health Cards อยู่ด้านบนทุก tab

### Issue 3: OCR Sandbox ชื่อไม่ถูกต้อง

**Location**: `frontend/app/(admin)/admin/ai/page.tsx` บรรทัด 265

**Current**:
```tsx
<TabsTrigger value="ocr">OCR Sandbox</TabsTrigger>
```

**Problem**:
- ชื่อ "OCR Sandbox" ทำให้เข้าใจว่าเป็นเฉพาะ OCR เท่านั้น
- แต่ตาม spec 238 มันคือ "3-Step Sandbox Testing" ที่ทำ:
  - Step 1: OCR (สกัดข้อความ)
  - Step 2: AI Extract (สกัดข้อมูลเมตาดาต้า)
  - Step 3: RAG Prep (เตรียมฐานข้อมูลค้นหา)
- SandboxTabs component ตอนนี้มีชื่อถูกต้องแล้ว: "รันบอร์ดทดลองการทำงาน (3-Step Sandbox Testing)"

**Correct Name**:
```tsx
<TabsTrigger value="sandbox">3-Step Pipeline Sandbox</TabsTrigger>
```

หรือ
```tsx
<TabsTrigger value="sandbox">AI Pipeline Sandbox</TabsTrigger>
```

**Decision**: **"3-Step Pipeline Sandbox"** - ชัดเจนและสอดคล้องกับ spec 238

## Implementation Plan

### Phase 1: แก้ไขคำอธิบาย AI Console

**File**: `frontend/app/(admin)/admin/ai/page.tsx`

**Change**:
```diff
- <p className="mt-1 text-sm text-muted-foreground">ควบคุมสถานะ AI features สำหรับผู้ใช้ทั่วไป</p>
+ <p className="mt-1 text-sm text-muted-foreground">ควบคุมและตรวจสอบระบบ AI สำหรับ Superadmin</p>
```

**Verification**:
- เปิดหน้า AI Console และตรวจสอบคำอธิบาย

### Phase 2: ย้าย Health Cards ไปด้านบนทุก tab

**File**: `frontend/app/(admin)/admin/ai/page.tsx`

**Change Structure**:
```diff
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Brain className="h-6 w-6" />
            AI Console
          </h1>
-         <p className="mt-1 text-sm text-muted-foreground">ควบคุมสถานะ AI features สำหรับผู้ใช้ทั่วไป</p>
+         <p className="mt-1 text-sm text-muted-foreground">ควบคุมและตรวจสอบระบบ AI สำหรับ Superadmin</p>
        </div>
        <Badge variant={aiEnabled ? 'default' : 'destructive'} className="w-fit">
          {aiEnabled ? 'AI Enabled' : 'AI Disabled'}
        </Badge>
      </div>
+
+     {/* Health Monitoring Cards - แสดงทุก tab */}
+     <div className="grid gap-4 md:grid-cols-3">
+       {/* Ollama AI Engine Card */}
+       {/* Qdrant Vector DB Card */}
+       {/* OCR Sidecar Card */}
+       {/* BullMQ Queue Health Card */}
+       {/* VRAM GPU Monitor Card */}
+     </div>
+
+     {/* System Toggle Card */}
+     <Card>
+       {/* System Toggle content */}
+     </Card>
+
+     {/* Protection/Polling Cards */}
+     <div className="grid gap-4 md:grid-cols-2">
+       {/* Protection Card */}
+       {/* Polling Card */}
+     </div>
+
      <Tabs defaultValue="overview" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-[500px]">
-         <TabsTrigger value="overview">Overview & Health</TabsTrigger>
+         <TabsTrigger value="overview">System Toggle</TabsTrigger>
          <TabsTrigger value="playground">RAG Playground</TabsTrigger>
-         <TabsTrigger value="ocr">OCR Sandbox</TabsTrigger>
+         <TabsTrigger value="sandbox">3-Step Pipeline Sandbox</TabsTrigger>
        </TabsList>
-       <TabsContent value="overview" className="space-y-6">
-         {/* Health Cards - ย้ายออกไปด้านบน (T002-T004) */}
-         {/* System Toggle Card - ย้ายออกไปด้านบน (T003) */}
-         {/* Protection/Polling Cards - ย้ายออกไปด้านบน (T004) */}
-         {/* Note: Empty TabsContent removed in T005 */}
-       </TabsContent>
        <TabsContent value="playground" className="space-y-6">
          {/* RAG Playground content */}
        </TabsContent>
-       <TabsContent value="ocr" className="space-y-6">
+       <TabsContent value="sandbox" className="space-y-6">
          {/* 3-Step Pipeline Sandbox content */}
        </TabsContent>
      </Tabs>
    </div>
  );
```

**Verification**:
- เปิด AI Console และตรวจสอบว่า health cards แสดงทุก tab
- ตรวจสอบว่า polling ยังทำงานปกติ

### Phase 3: เปลี่ยนชื่อ tab

**File**: `frontend/app/(admin)/admin/ai/page.tsx`

**Change**:
```diff
- <TabsTrigger value="overview">Overview & Health</TabsTrigger>
+ <TabsTrigger value="overview">System Toggle</TabsTrigger>
  <TabsTrigger value="playground">RAG Playground</TabsTrigger>
- <TabsTrigger value="ocr">OCR Sandbox</TabsTrigger>
+ <TabsTrigger value="sandbox">3-Step Pipeline Sandbox</TabsTrigger>
```

**Verification**:
- เปิด AI Console และตรวจสอบชื่อ tab
- ตรวจสอบว่า tab navigation ยังทำงานปกติ

## Success Criteria

- **SC-001**: Superadmins can identify the AI Console as a Superadmin-only page within 5 seconds of viewing the page description.
- **SC-002**: Superadmins can view health monitoring status on any tab without switching to Overview tab (100% of tabs).
- **SC-003**: Tab names accurately describe their functionality as measured by zero confusion reports from Superadmins within 30 days of deployment.
- **SC-004**: Health status polling continues to function correctly on all tabs with no performance degradation (polling interval remains 30 seconds).
- **SC-005**: Health cards display correctly on all screen sizes (mobile, tablet, desktop) with no layout issues.

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Health cards ทำให้หน้าแสดงผลยาวเกินไป | Low | ใช้ grid layout และ responsive design |
| Polling หลายที่อาจทำให้ performance ตก | Low | ใช้ TanStack Query cache และ refetchInterval เดิม |
| Tab navigation อาจพังหลัง refactor | Medium | Test ทุก tab หลัง refactor |

## Testing Plan

### Manual Testing
1. เปิด AI Console และตรวจสอบคำอธิบาย
2. ตรวจสอบว่า health cards แสดงทุก tab
3. ตรวจสอบว่า tab navigation ยังทำงานปกติ
4. ตรวจสอบว่า polling ยังทำงานปกติ (health status อัปเดตทุก 30 วินาที)
5. ทดสอบ RAG Playground และ 3-Step Pipeline Sandbox

### E2E Testing (ถ้าจำเป็น)
- เขียน E2E test สำหรับตรวจสอบ AI Console UI

## Related Documents

- ADR-027: AI Admin Console and Dynamic Control Architecture
- Spec 238: OCR & AI Extraction Prompt Management
- `frontend/app/(admin)/admin/ai/page.tsx`
- `frontend/components/admin/ai/SandboxTabs.tsx`

## Next Steps

1. รับอนุมัติจาก user สำหรับ design proposal (Option A: Health Cards อยู่ด้านบนทุก tab)
2. Implement Phase 1, 2, 3 ตามลำดับ
3. Manual testing
4. Deploy และ verify
