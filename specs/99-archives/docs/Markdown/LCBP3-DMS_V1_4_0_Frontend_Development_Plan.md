# 📋 แผนการพัฒนา Frontend (NestJS) - LCBP3-DMS v1.4.0

# 📋 แผนการพัฒนา Frontend (Next.js) - LCBP3-DMS v1.4.0

## 🎯 ภาพรวมโครงการ

พัฒนา Frontend สำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System) ที่ทันสมัย responsive และใช้งานง่าย รองรับการจัดการเอกสารที่ซับซ้อน มี Dashboard แบบ Real-time และระบบ Workflow Visualization

---

## 📐 สถาปัตยกรรมระบบ

### Technology Stack

- **Framework:** Next.js 14+ (App Router, React 18+, TypeScript, ESM)
- **Styling:** Tailwind CSS + PostCSS
- **Component Library:** shadcn/ui (Radix UI)
- **State Management:**
  - **Server State:** TanStack Query (React Query)
  - **Global Client State:** Zustand
  - **Form State:** React Hook Form + Zod
- **Data Fetching:** Axios + TanStack Query
- **Authentication:** NextAuth.js (JWT Strategy)
- **File Upload:** React Dropzone
- **Tables:** TanStack Table
- **Charts:** Recharts
- **Date Picker:** date-fns + shadcn/ui Calendar
- **Icons:** Lucide React
- **Testing:**
  - **Unit/Integration:** Vitest + React Testing Library
  - **E2E:** Playwright
  - **API Mocking:** Mock Service Worker (MSW)

### โครงสร้างโปรเจกต์

```
app/
├── (public)/              # Public routes (Landing, Login)
│   ├── page.tsx          # Landing Page
│   └── login/            # Login Page
├── (protected)/          # Protected routes
│   ├── layout.tsx        # App Shell (Navbar + Sidebar)
│   ├── dashboard/        # Dashboard
│   ├── correspondences/  # Correspondence Management
│   ├── rfas/            # RFA Management
│   ├── drawings/        # Drawing Management
│   ├── circulations/    # Circulation Management
│   ├── transmittals/    # Transmittal Management
│   ├── search/          # Advanced Search
│   ├── reports/         # Reports
│   ├── admin/           # Admin Panel
│   └── profile/         # User Profile
├── api/                 # API Routes (if needed)
components/
├── ui/                  # shadcn/ui components
├── features/            # Feature-specific components
│   ├── auth/
│   ├── correspondence/
│   ├── rfa/
│   ├── drawing/
│   ├── circulation/
│   └── common/
└── layouts/             # Layout components
lib/
├── api/                 # API client & hooks
├── stores/              # Zustand stores
├── utils/               # Utility functions
├── hooks/               # Custom hooks
└── types/               # TypeScript types
public/
├── images/
└── fonts/
```

---

## 🗓️ แผนการพัฒนาแบบ Phase-Based

## **Phase 0: Setup & Infrastructure (สัปดาห์ที่ 1)**

### Milestone: สร้างโครงสร้างพื้นฐานและ Development Environment

#### Tasks:

**T0.1 Initialize Next.js Project**

- สร้างโปรเจกต์ด้วย `create-next-app`:
  ```bash
  npx create-next-app@latest lcbp3-frontend --typescript --tailwind --app --src-dir=false
  ```
- เลือก Options:
  - ✅ TypeScript
  - ✅ ESLint
  - ✅ Tailwind CSS
  - ✅ App Router
  - ✅ Import alias (@/\*)
- Setup .gitignore, README.md
- Deliverable: ✅ โปรเจกต์เริ่มต้นพร้อม

**T0.2 Install Core Dependencies**

```bash
# State Management & Data Fetching
npm install @tanstack/react-query zustand
npm install axios
npm install react-hook-form @hookform/resolvers zod

# UI Components & Styling
npm install clsx tailwind-merge
npm install lucide-react
npm install date-fns

# File Upload
npm install react-dropzone

# Authentication
npm install next-auth

# Development Tools
npm install -D @types/node
```

- Deliverable: ✅ Dependencies ติดตั้งสมบูรณ์

**T0.3 Setup shadcn/ui**

```bash
npx shadcn-ui@latest init
```

- เลือก Style: Default
- เลือก Base Color: Slate
- ติดตั้ง Components เบื้องต้น:
  ```bash
  npx shadcn-ui@latest add button input label card table dropdown-menu
  npx shadcn-ui@latest add dialog sheet toast alert
  npx shadcn-ui@latest add form select textarea checkbox
  npx shadcn-ui@latest add calendar popover
  ```
- Deliverable: ✅ shadcn/ui พร้อมใช้งาน

**T0.4 Configure Tailwind CSS**

- แก้ไข `tailwind.config.ts`:
  - เพิ่ม Custom Colors (ตาม Brand)
  - เพิ่ม Custom Fonts (ภาษาไทย: Noto Sans Thai)
  - Configure Container, Spacing
- สร้าง `app/globals.css` พร้อม Custom Styles
- Deliverable: ✅ Tailwind พร้อมใช้

**T0.5 Setup Development Environment**

- สร้าง `.env.local`:
  ```
  NEXT_PUBLIC_API_URL=http://backend.np-dms.work/api
  NEXTAUTH_URL=http://localhost:3000
  NEXTAUTH_SECRET=...
  ```
- Setup ESLint Rules (ไทย Comments OK)
- Setup Prettier
- Setup VS Code Settings
- Deliverable: ✅ Dev Environment พร้อม

**T0.6 Setup Git & Docker**

- Push โปรเจกต์ไปยัง Gitea (git.np-dms.work)
- สร้าง Dockerfile สำหรับ Next.js:
  ```dockerfile
  FROM node:20-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build
  EXPOSE 3000
  CMD ["npm", "start"]
  ```
- สร้าง docker-compose.yml (เชื่อม Network `lcbp3`)
- Deliverable: ✅ Project อยู่ใน Git + Docker พร้อม

---

## **Phase 1: Authentication & App Shell (สัปดาห์ที่ 2-3)**

### Milestone: ระบบ Login และ Layout หลัก

#### Tasks:

**T1.1 Setup API Client**

- สร้าง `lib/api/client.ts`:

  ```typescript
  import axios from 'axios';

  export const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request Interceptor (Add JWT Token)
  apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response Interceptor (Handle Errors)
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Redirect to login
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
  ```

- Deliverable: ✅ API Client พร้อมใช้

**T1.2 Setup TanStack Query**

- สร้าง `app/providers.tsx`:

  ```typescript
  "use client";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { useState } from "react";

  export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
      () =>
        new QueryClient({
          defaultOptions: {
            queries: {
              staleTime: 60 * 1000, // 1 minute
              refetchOnWindowFocus: false,
            },
          },
        })
    );

    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  ```

- Wrap ใน `app/layout.tsx`
- Deliverable: ✅ React Query พร้อม

**T1.3 Create Auth Store (Zustand)**

- สร้าง `lib/stores/auth-store.ts`:

  ```typescript
  import { create } from 'zustand';
  import { persist } from 'zustand/middleware';

  interface User {
    user_id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    primary_organization_id: number;
    permissions: string[];
  }

  interface AuthStore {
    user: User | null;
    token: string | null;
    setAuth: (user: User, token: string) => void;
    clearAuth: () => void;
    hasPermission: (permission: string) => boolean;
  }

  export const useAuthStore = create<AuthStore>()(
    persist(
      (set, get) => ({
        user: null,
        token: null,
        setAuth: (user, token) => {
          set({ user, token });
          localStorage.setItem('access_token', token);
        },
        clearAuth: () => {
          set({ user: null, token: null });
          localStorage.removeItem('access_token');
        },
        hasPermission: (permission) => {
          const user = get().user;
          return user?.permissions.includes(permission) || false;
        },
      }),
      {
        name: 'auth-storage',
      }
    )
  );
  ```

- Deliverable: ✅ Auth Store พร้อม

**T1.4 Create Login Page**

- สร้าง `app/(public)/login/page.tsx`:

  ```typescript
  "use client";
  import { useForm } from "react-hook-form";
  import { zodResolver } from "@hookform/resolvers/zod";
  import * as z from "zod";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { useRouter } from "next/navigation";
  import { useAuthStore } from "@/lib/stores/auth-store";
  import { apiClient } from "@/lib/api/client";

  const loginSchema = z.object({
    username: z.string().min(1, "กรุณากรอกชื่อผู้ใช้"),
    password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
  });

  export default function LoginPage() {
    const router = useRouter();
    const setAuth = useAuthStore((state) => state.setAuth);
    const form = useForm({
      resolver: zodResolver(loginSchema),
    });

    const handleLogin = async (data: z.infer<typeof loginSchema>) => {
      try {
        const response = await apiClient.post("/auth/login", data);
        const { access_token, user } = response.data;
        setAuth(user, access_token);
        router.push("/dashboard");
      } catch (error) {
        console.error("Login failed:", error);
        // แสดง Toast Error
      }
    };

    return (
      <div className="flex min-h-screen items-center justify-center">
        <form onSubmit={form.handleSubmit(handleLogin)} className="w-96">
          {/* Form Fields */}
        </form>
      </div>
    );
  }
  ```

- Deliverable: ✅ หน้า Login พร้อม

**T1.5 Create Landing Page**

- สร้าง `app/(public)/page.tsx`:
  - Hero Section พร้อมข้อมูลโครงการ
  - Feature Highlights
  - CTA Button → Login
- ใช้ Tailwind + Animations
- Deliverable: ✅ Landing Page สวยงาม

**T1.6 Create Protected Layout (App Shell)**

- สร้าง `app/(protected)/layout.tsx`:

  ```typescript
  "use client";
  import { useEffect } from "react";
  import { useRouter } from "next/navigation";
  import { useAuthStore } from "@/lib/stores/auth-store";
  import Navbar from "@/components/layouts/navbar";
  import Sidebar from "@/components/layouts/sidebar";

  export default function ProtectedLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);

    useEffect(() => {
      if (!user) {
        router.push("/login");
      }
    }, [user, router]);

    if (!user) return null;

    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    );
  }
  ```

- Deliverable: ✅ App Shell พร้อม

**T1.7 Create Navbar Component**

- สร้าง `components/layouts/navbar.tsx`:
  - แสดงชื่อระบบ
  - แสดงชื่อผู้ใช้ + Avatar
  - Dropdown Menu:
    - Profile
    - Settings
    - Logout
- Responsive (Mobile Hamburger Menu)
- Deliverable: ✅ Navbar พร้อม

**T1.8 Create Sidebar Component**

- สร้าง `components/layouts/sidebar.tsx`:
  - เมนูหลัก:
    - Dashboard
    - Correspondences
    - RFAs
    - Drawings (Shop & Contract)
    - Circulations
    - Transmittals
    - Search
    - Reports
  - เมนู Admin (แสดงตามสิทธิ์):
    - Users
    - Roles & Permissions
    - Master Data
    - Document Numbering
- Collapsible Sidebar
- Active State Highlighting
- Deliverable: ✅ Sidebar พร้อม

---

## **Phase 2: Dashboard & Common Components (สัปดาห์ที่ 4)**

### Milestone: Dashboard และ Reusable Components

#### Tasks:

**T2.1 Create Reusable Components**

- `components/features/common/data-table.tsx`:
  - ใช้ TanStack Table
  - รองรับ Pagination, Sorting, Filtering
  - Responsive
- `components/features/common/file-upload.tsx`:
  - ใช้ React Dropzone
  - รองรับ Multi-file Upload
  - Drag & Drop
  - Progress Bar
- `components/features/common/status-badge.tsx`:
  - แสดง Status แบบสีสัน (Draft, Submitted, Approved)
- `components/features/common/permission-guard.tsx`:
  - ซ่อน/แสดง Component ตามสิทธิ์
- Deliverable: ✅ Reusable Components พร้อม

**T2.2 Create Dashboard Page**

- สร้าง `app/(protected)/dashboard/page.tsx`:
  - **KPI Cards Section**:
    - จำนวนเอกสารทั้งหมด
    - งานที่รอดำเนินการ
    - เอกสารที่เกินกำหนด
    - RFA ที่รออนุมัติ
  - **My Tasks Table**:
    - ดึงข้อมูลจาก `/api/circulations/my-tasks` (ใช้ `v_user_tasks`)
    - แสดงรายการงานที่ต้องทำ (Pending, In Progress)
    - Columns: Document Number, Title, Type, Status, Deadline, Actions
    - คลิกแถวแล้วไปยังหน้า Detail
  - **Recent Activity Feed**:
    - ดึงข้อมูลจาก `/api/audit-logs/user/:userId`
    - แสดง 10 รายการล่าสุด
- Deliverable: ✅ Dashboard ครบถ้วน

**T2.3 Create API Hooks**

- สร้าง `lib/api/hooks/use-my-tasks.ts`:

  ```typescript
  import { useQuery } from '@tanstack/react-query';
  import { apiClient } from '../client';

  export function useMyTasks() {
    return useQuery({
      queryKey: ['my-tasks'],
      queryFn: async () => {
        const response = await apiClient.get('/circulations/my-tasks');
        return response.data;
      },
    });
  }
  ```

- สร้าง Hooks เพิ่มเติม:
  - `use-dashboard-stats.ts`
  - `use-recent-activity.ts`
- Deliverable: ✅ API Hooks พร้อม

---

## **Phase 3: Correspondence Management (สัปดาห์ที่ 5-6)**

### Milestone: ระบบจัดการเอกสารโต้ตอบ

#### Tasks:

**T3.1 Create Correspondence List Page**

- สร้าง `app/(protected)/correspondences/page.tsx`:
  - Data Table แสดงรายการเอกสาร
  - Columns:
    - Document Number (คลิกไปยัง Detail)
    - Title
    - Type
    - Status (Badge)
    - Originator
    - Date
    - Actions (View, Edit, Delete)
  - Filters:
    - ประเภทเอกสาร (Dropdown)
    - สถานะ (Dropdown)
    - วันที่ (Date Range Picker)
    - องค์กร (Dropdown)
  - Pagination (Server-side)
  - Search Box
  - Create Button (ตรวจสิทธิ์)
- Deliverable: ✅ หน้ารายการเอกสาร

**T3.2 Create Correspondence Detail Page**

- สร้าง `app/(protected)/correspondences/[id]/page.tsx`:
  - **Header Section**:
    - Document Number (ใหญ่)
    - Status Badge
    - Action Buttons: Edit, Delete, Export PDF
  - **Metadata Section**:
    - Title, Description
    - Document Date, Issued Date, Received Date
    - Originator, Recipients (TO/CC)
    - Due Date (ถ้ามี)
  - **Revision History**:
    - แสดง Revisions ทั้งหมดเป็น Timeline
    - แต่ละ Revision แสดง: Revision Number, Date, Changes, User
  - **Attachments**:
    - แสดงไฟล์แนบทั้งหมด
    - กำหนดไฟล์หลัก (Main Document) ด้วยไอคอน
    - ปุ่ม Download
  - **References**:
    - แสดงเอกสารที่อ้างถึง (Links)
  - **Tags**:
    - แสดง Tags แบบ Chips
  - **Activity Log**:
    - แสดง Audit Log ของเอกสารนี้
- Deliverable: ✅ หน้า Detail ครบถ้วน

**T3.3 Create Correspondence Form (Create/Edit)**

- สร้าง `app/(protected)/correspondences/create/page.tsx`:
- สร้าง `app/(protected)/correspondences/[id]/edit/page.tsx`:
- Form Fields:
  - **Basic Info**:
    - Correspondence Type (Dropdown)
    - Title (Text)
    - Description (Textarea)
    - Document Date (Date Picker)
  - **Recipients**:
    - TO: Multi-select Organizations
    - CC: Multi-select Organizations
  - **References**:
    - Search & Select เอกสารอื่นๆ
  - **Tags**:
    - Autocomplete Tag Input
  - **Attachments**:
    - File Upload (Multi-file)
    - กำหนด Main Document (Radio)
  - **Deadline**:
    - Due Date (Date Picker)
- Validation ด้วย Zod
- Submit → API → Redirect to Detail
- Deliverable: ✅ ฟอร์มสร้าง/แก้ไข

**T3.4 Create Status Management**

- ใน Detail Page เพิ่มปุ่ม Status Actions:
  - **Draft → Submit** (Document Control)
  - **Submit → Close** (Admin)
  - **Submit → Cancel** (Admin + Dialog ให้กรอกเหตุผล)
- แสดง Confirmation Dialog ก่อนเปลี่ยนสถานะ
- Deliverable: ✅ เปลี่ยนสถานะได้

---

## **Phase 4: RFA & Workflow Visualization (สัปดาห์ที่ 7-8)**

### Milestone: ระบบ RFA และ Workflow

#### Tasks:

**T4.1 Create RFA List Page**

- สร้าง `app/(protected)/rfas/page.tsx`:
  - คล้าย Correspondence List
  - Columns เพิ่มเติม:
    - RFA Type (DWG, DOC, MAT)
    - Approval Status (Badge)
    - Approval Code (1A, 3R, etc.)
  - Filters:
    - RFA Type
    - Status
    - Approval Code
- Deliverable: ✅ หน้ารายการ RFA

**T4.2 Create RFA Detail Page**

- สร้าง `app/(protected)/rfas/[id]/page.tsx`:
  - คล้าย Correspondence Detail
  - เพิ่ม Section:
    - **Shop Drawings** (สำหรับ RFA_DWG):
      - แสดงรายการ Shop Drawings ที่เชื่อมโยง
      - แสดง Revision ของแต่ละแบบ
      - Link ไปยัง Shop Drawing Detail
    - **Workflow Visualization** (ดูรายละเอียดใน T4.3)
- Deliverable: ✅ หน้า Detail RFA

**T4.3 Create Workflow Visualization Component**

- สร้าง `components/features/rfa/workflow-visualizer.tsx`:
  - **Layout**: Steps แนวนอน (Timeline)
  - **Step States**:
    - ✅ **Completed**: สีเขียว, ไอคอน Check
    - ⏳ **Active**: สีฟ้า, ปุ่ม Action เปิดใช้งาน
    - ⏸️ **Pending**: สีเทา, ปุ่ม disabled
    - ❌ **Rejected**: สีแดง
  - **Step Info Card** (เมื่อคลิก):
    - Organization
    - Assigned User
    - Action Type (Review, Approve)
    - Status
    - Comments
    - Completed Date
  - **Actions** (สำหรับ Active Step):
    - ปุ่ม "อนุมัติ" (Approve)
    - ปุ่ม "ปฏิเสธ" (Reject)
    - Dialog ให้กรอก Comments
  - **Admin Override**:
    - ปุ่ม "ไปยังขั้นตอนต่อไป" (Skip Step)
    - ปุ่ม "ย้อนกลับ" (Previous Step)
- Deliverable: ✅ Workflow Component พร้อม

**T4.4 Create RFA Form (Create/Edit)**

- สร้าง `app/(protected)/rfas/create/page.tsx`:
- Form Fields:
  - RFA Type (Dropdown)
  - Title, Description
  - Document Date
  - **Shop Drawings Section** (สำหรับ RFA_DWG):
    - Search & Select Shop Drawings
    - แสดง Revisions ที่มี (Dropdown)
    - เพิ่มได้หลายแบบ
  - Attachments
  - Workflow Template (Dropdown)
- Submit → สร้าง RFA + Start Workflow
- Deliverable: ✅ ฟอร์ม RFA พร้อม

**T4.5 Implement Workflow Actions API**

- สร้าง `lib/api/hooks/use-rfa-workflow.ts`:

  ```typescript
  import { useMutation, useQueryClient } from '@tanstack/react-query';
  import { apiClient } from '../client';

  export function useCompleteWorkflowStep() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ rfaId, stepNumber, action, comments }) => {
        const response = await apiClient.post(`/rfas/${rfaId}/workflow/steps/${stepNumber}/complete`, {
          action,
          comments,
        });
        return response.data;
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries(['rfa', variables.rfaId]);
        queryClient.invalidateQueries(['my-tasks']);
      },
    });
  }
  ```

- Hooks เพิ่มเติม:
  - `use-reject-workflow-step.ts`
  - `use-start-workflow.ts`
- Deliverable: ✅ Workflow Actions ทำงานได้

---

## **Phase 5: Drawing Management (สัปดาห์ที่ 9)**

### Milestone: ระบบจัดการแบบ

#### Tasks:

**T5.1 Create Shop Drawing List Page**

- สร้าง `app/(protected)/drawings/shop/page.tsx`:
  - Data Table:
    - Drawing Number
    - Title
    - Main Category
    - Sub Category
    - Current Revision
    - Actions
  - Filters:
    - Category (Dropdown)
    - Sub Category (Dropdown)
  - Create Button
- Deliverable: ✅ หน้ารายการ Shop Drawings

**T5.2 Create Shop Drawing Detail Page**

- สร้าง `app/(protected)/drawings/shop/[id]/page.tsx`:
  - **Header**: Drawing Number, Title
  - **Current Revision Info**:
    - Revision Number, Date
    - Description
    - Attachments (PDF, DWG)
  - **Contract Drawing References**:
    - แสดง Contract Drawings ที่อ้างถึง
    - Links ไปยัง Contract Drawing Detail
  - **Revision History**:
    - แสดง Revisions ทั้งหมดเป็น Timeline
  - **Related RFAs**:
    - แสดง RFAs ที่เชื่อมโยงกับแบบนี้
- Deliverable: ✅ หน้า Detail Shop Drawing

**T5.3 Create Shop Drawing Form**

- สร้าง `app/(protected)/drawings/shop/create/page.tsx`:
- Form Fields:
  - Drawing Number (Auto-generate หรือ Manual)
  - Title
  - Main Category (Dropdown)
  - Sub Category (Dropdown, dependent on Main)
  - **Contract Drawing References**:
    - Search & Select Contract Drawings (Multi-select)
  - **Revision Info**:
    - Revision Number (Auto)
    - Revision Label (A, B, C)
    - Description
  - **Attachments**:
    - Upload PDF (Main)
    - Upload DWG (Optional)
    - Upload Other Files
- Deliverable: ✅ ฟอร์ม Shop Drawing

**T5.4 Create Contract Drawing List & Detail**

- สร้าง `app/(protected)/drawings/contract/page.tsx`:
  - Data Table:
    - Drawing Number
    - Title
    - Volume
    - Category
    - Sub Category
  - Filters:
    - Volume (Dropdown)
    - Category (Dropdown)
- สร้าง `app/(protected)/drawings/contract/[id]/page.tsx`:
  - แสดง Metadata
  - Attachments
  - **Referenced By**:
    - แสดง Shop Drawings ที่อ้างถึงแบบนี้
- Deliverable: ✅ Contract Drawing Pages

---

## **Phase 6: Circulation & Transmittal (สัปดาห์ที่ 10)**

### Milestone: ระบบใบเวียนและเอกสารนำส่ง

#### Tasks:

**T6.1 Create Circulation List Page**

- สร้าง `app/(protected)/circulations/page.tsx`:
  - Data Table:
    - Circulation Number
    - Subject
    - Status (Badge)
    - Created By
    - Created Date
  - Filters:
    - Status
    - Date Range
- Deliverable: ✅ หน้ารายการใบเวียน

**T6.2 Create Circulation Detail & Workflow**

- สร้าง `app/(protected)/circulations/[id]/page.tsx`:
  - **Header**: Circulation Number, Subject, Status
  - **Linked Correspondence**:
    - Link ไปยังเอกสารต้นทาง
  - **Workflow Visualization**:
    - คล้าย RFA Workflow
    - แสดง Steps:
      - Organization
      - Assigned Users (Main, Action, Information)
      - Status
      - Comments
      - Deadline
  - **Actions** (สำหรับ Assigned User):
    - ปุ่ม "ดำเนินการเสร็จสิ้น" (Complete)
    - Dialog ให้กรอก Comments
  - **Close Circulation** (Document Control):
    - ปุ่ม "ปิดใบเวียน" (เมื่อตอบกลับองค์กรผู้ส่งแล้ว)
- Deliverable: ✅ หน้า Detail ใบเวียน
