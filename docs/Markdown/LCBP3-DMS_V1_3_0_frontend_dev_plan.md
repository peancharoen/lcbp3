
# แผนการพัฒนา Frontend Next.js สำหรับ DMS v1.3.0

## การเตรียมความพร้อมและการติดตั้ง (Prerequisites & Setup)

- [ ] สร้าง Next.js Project ใหม่ (App Router)

  ```bash
    npx create-next-app@latest frontend --typescript --tailwind --eslint --app
  ```

- [ ] ติดตั้ง Dependencies หลักๆ ตามเอกสาร FullStackJS
  - [ ] UI Library: `@shadcn/ui` และ dependencies ที่เกี่ยวข้อง
  - [ ] State Management: `zustand`
  - [ ] Server State: `@tanstack/react-query`
  - [ ] Form Handling: `react-hook-form`, `zod`, `@hookform/resolvers`
  - [ ] File Upload: `react-dropzone`
  - [ ] Icons: `lucide-react`
  - [ ] Testing: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@playwright/test`
- [ ] ตั้งค่าโครงสร้างโปรเจกต์

  ```
    src/
    ├── app/                    # App Router
    │   ├── (dashboard)/        # Route Groups
    │   ├── api/                # API Routes (ถ้าจำเป็น)
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/             # Reusable UI Components
    │   ├── ui/                 # shadcn/ui components
    │   ├── forms/              # Form Components
    │   └── features/           # Feature-specific Components
    ├── lib/                    # Utility functions
    │   ├── api.ts              # Axios/Fetch wrapper
    │   ├── auth.ts             # Auth helpers
    │   └── utils.ts
    ├── hooks/                  # Custom React Hooks
    ├── store/                  # Zustand stores
    └── types/                  # TypeScript type definitions
  ```

- [ ] ตั้งค่า Tailwind CSS และ shadcn/ui
- [ ] ตั้งค่า React Query ใน `app/providers.tsx` และครอบใน `layout.tsx`
- [ ] ตั้งค่า Zustand store สำหรับ Global State (เช่น User, Auth)

---

## Phase 1: การสร้างรากฐานและการยืนยันตัวตน (Foundation & Authentication) - สัปดาห์ที่ 1-2

- [ ] พัฒนา Layout หลัก (App Shell - Req 5.1)
  - [ ] สร้าง `Navbar` Component (ชื่อระบบ, เมนูผู้ใช้, ปุ่ม Logout)
  - [ ] สร้าง `Sidebar` Component (เมนูการนำทางหลัก)
  - [ ] สร้าง `MainContent` Component สำหรับแสดงผลหน้าต่างๆ
  - [ ] ประกอบ Component ทั้งหมดใน `layout.tsx`
- [ ] พัฒนาระบบ Authentication
  - [ ] สร้าง `LoginPage` Component (ใช้ `react-hook-form` + `zod`)
  - [ ] สร้าง Auth Store ด้วย Zustand (เก็บ User, Token, สถานะการล็อกอิน)
  - [ ] สร้าง `useAuth` Hook สำหรับเข้าถึง Auth State
  - [ ] สร้าง API functions สำหรับ Login, Logout, Get Profile
  - [ ] สร้าง Middleware สำหรับป้องกัน Route ที่ต้องการ Login
- [ ] สร้าง `ProfilePage` (Req 5.5)
  - [ ] แสดงข้อมูลผู้ใช้
  - [ ] ฟอร์มแก้ไขข้อมูลส่วนตัว
  - [ ] ฟอร์มเปลี่ยนรหัสผ่าน

---

## Phase 2: พัฒนาคอมโพเนนต์หลักและหน้า Dashboard (Core Components & Dashboard) - สัปดาห์ที่ 3-4

- [ ] พัฒนา Reusable Components พื้นฐาน
  - [ ] `DataTable` Component (รองรับ Server-side Pagination, Sorting, Filtering)
  - [ ] `FormSelect`, `FormInput`, `FormTextarea` (ครอบด้วย `react-hook-form`)
  - [ ] `LoadingSpinner`, `ErrorAlert` Components
  - [ ] `ConfirmDialog` Component
- [ ] พัฒนา `FileUpload` Component (Req 5.7)
  - [ ] ใช้ `react-dropzone` สำหรับ Drag-and-Drop
  - [ ] รองรับการอัปโหลดหลายไฟล์
  - [ ] มี Checkbox ให้เลือก "เอกสารหลัก" (Main Document)
  - [ ] แสดงรายการไฟล์ที่เลือกพร้อมตัวเลือกลบ
- [ ] พัฒนา `AttachmentList` Component
  - [ ] แสดงรายการไฟล์แนบที่เชื่อมโยงกับเอกสาร
  - [ ] แสดง Badge "เอกสารหลัก"
  - [ ] ปุ่มดาวน์โหลดแต่ละไฟล์
- [ ] พัฒนา `DashboardPage` (Req 5.3)
  - [ ] สร้าง `KpiCard` Component สำหรับแสดงข้อมูลสรุป
  - [ ] สร้าง `MyTasksTable` Component
    - [ ] ดึงข้อมูลจาก API endpoint ที่เชื่อมต่อกับ View `v_user_tasks`
    - [ ] แสดงคอลัมน์: ชื่อเอกสาร, ประเภท, วันครบกำหนด, สถานะ
    - [ ] ปุ่ม "ดำเนินการ" ที่นำไปยังหน้าที่เกี่ยวข้อง

---

## Phase 3: พัฒนาโมดูลเอกสารโต้ตอบและเวิร์กโฟลว์ (Correspondence & Workflow Modules) - สัปดาห์ที่ 5-7

- [ ] พัฒนา `CorrespondenceModule` (Req 3.2)
  - [ ] หน้ารายการเอกสาร (`/correspondences`)
    - [ ] `DataTable` พร้อม Filter: โครงการ, ประเภทเอกสาร, ช่วงวันที่, ผู้ส่ง/ผู้รับ
    - [ ] ปุ่ม "สร้างใหม่", "ดู", "แก้ไข" (ตามสิทธิ์)
  - [ ] หน้าสร้าง/แก้ไขเอกสาร (`/correspondences/new`, `/correspondences/[id]/edit`)
    - [ ] ฟอร์มสร้างเอกสาร (ใช้ `react-hook-form`)
    - [ ] Dropdowns ที่เชื่อมโยงกัน (Project -> Contract)
    - [ ] การเลือกผู้รับ (To/CC) หลายองค์กร
    - [ ] การใส่ Tag
    - [ ] การเชื่อมโยงเอกสารอ้างอิง
    - [ ] ใช้ `FileUpload` และ `AttachmentList` Components
  - [ ] หน้ารายละเอียดเอกสาร (`/correspondences/[id]`)
    - [ ] แสดงข้อมูลทั้งหมดของเอกสาร
    - [ ] แสดงประวัติการแก้ไข (Revisions)
    - [ ] แสดงสถานะการส่งต่อ (Routings)
- [ ] พัฒนา `RfaModule` (Req 3.5, 5.6)
  - [ ] ฟังก์ชันพื้นฐานคล้ายกับ CorrespondenceModule
  - [ ] พัฒนา `WorkflowVisualization` Component **(สำคัญ)**
    - [ ] ดึงข้อมูลจาก `rfa_workflows` table
    - [ ] แสดงขั้นตอนทั้งหมดเป็นลำดับ (เช่น การ์ดหรือไลน์)
    - [ ] ขั้นตอนปัจจุบัน (Active) สามารถดำเนินการได้
    - [ ] ขั้นตอนอื่นๆ แสดงเป็น Disabled
    - [ ] มีปุ่มสำหรับ Action: "อนุมัติ", "ปฏิเสธ", "ขอแก้ไข"
    - [ ] สำหรับ Admin: ปุ่ม "บังคับไปขั้นตอนถัดไป", "ย้อนกลับ"
    - [ ] แสดงความคิดเห็นในแต่ละขั้นตอน

---

## Phase 4: พัฒนาโมดูลแบบแปลนและคุณสมบัติขั้นสูง (Drawings & Advanced Features) - สัปดาห์ที่ 8-9

- [ ] พัฒนา `DrawingModule` (Req 3.3, 3.4)
  - [ ] แยกระหว่าง `ContractDrawingPage` และ `ShopDrawingPage`
  - [ ] ฟอร์มสร้าง/แก้ไขแบบแปลน
  - [ ] การจัดการ Revision (เช่น การสร้าง Revision ใหม่จาก Revision ปัจจุบัน)
  - [ ] การเชื่อมโยง Shop Drawing Revision กับ Contract Drawing
- [ ] พัฒนา `CirculationModule` (Req 3.7)
  - [ ] หน้ารายการใบเวียนภายใน
  - [ ] ฟอร์มสร้างใบเวียน
  - [ ] การมอบหมายงานให้ผู้รับผิดชอบ (Main, Action, Info)
  - [ ] หน้ารายละเอียดสำหรับผู้รับผิดชอบกระทำ (แสดงความคิดเห็น, ปุ่มปิดงาน)
- [ ] พัฒนา `AdminPanel` (Req 4.5, 4.6)
  - [ ] หน้าจัดการผู้ใช้ (Create/Edit/Delete Users ในองค์กร)
  - [ ] หน้าจัดการ Roles และ Permissions
  - [ ] หน้าจัดการ Master Data (Tags, Document Types, Categories)
  - [ ] หน้าจัดการรูปแบบเลขที่เอกสาร (Document Numbering Formats)
- [ ] พัฒนา `AdvancedSearchPage` (Req 6.2)
  - [ ] ฟอร์มค้นหาขั้นสูงพร้อมฟิลด์ต่างๆ
  - [ ] ส่งคำขอไปยัง Search API (Elasticsearch)
  - [ ] แสดงผลลัพธ์ใน `DataTable`

---

## Phase 5: การทดสอบ ปรับปรุงประสิทธิภาพ และเตรียม Deploy (Testing, Optimization & Deployment) - สัปดาห์ที่ 10

- [ ] ดำเนินการทดสอบ (Testing)
  - [ ] **Unit/Integration Tests:**
    - [ ] เขียนทดสอบสำหรับ `FileUpload` Component (Vitest + RTL)
    - [ ] เขียนทดสอบสำหรับ `DataTable` Component
    - [ ] เขียนทดสอบสำหรับ Custom Hooks (เช่น `useAuth`)
  - [ ] **E2E Tests:**
    - [ ] เขียนทดสอบ User Flow: Login -> สร้าง RFA -> อนุมัติ (Playwright)
    - [ ] เขียนทดสอบ User Flow: สร้างใบเวียน -> มอบหมายงาน -> ตอบกลับ
- [ ] ปรับปรุงประสิทธิภาพ (Performance)
  - [ ] ใช้ `next/dynamic` สำหรับ lazy loading ของ Components ที่ใหญ่
  - [ ] ตรวจสอบการใช้ React Query เพื่อให้แน่ใจว่ามีการ Caching และ Re-fetching ที่เหมาะสม
  - [ ] ใช้ Image Optimization ของ Next.js
- [ ] การเตรียม Deploy
  - [ ] สร้าง `Dockerfile` สำหรับ Frontend (Multi-stage build)
  - [ ] สร้างไฟล์ `docker-compose.yml` สำหรับ `frontend` service
    - [ ] กำหนด `build` จาก `Dockerfile`
    - [ ] กำหนด `environment` สำหรับ `NEXT_PUBLIC_API_URL`
    - [ ] เชื่อมต่อกับ `lcbp3` network
  - [ ] ทดสอบ Build และ Run บน Container Station UI
  - [ ] ตั้งค่า Nginx Proxy Manager ให้ชี้ `lcbp3.np-dms.work` มายัง Frontend Container
