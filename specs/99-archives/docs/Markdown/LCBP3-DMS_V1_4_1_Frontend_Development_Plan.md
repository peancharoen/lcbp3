# 📋 **แผนการพัฒนา Backend (NestJS) - LCBP3-DMS v1.4.1 (ปรับปรุงโดย Claude -> deepseek)**

## 🎯 ภาพรวมโครงการ

พัฒนา Frontend สำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System) ที่ทันสมัย responsive และใช้งานง่าย รองรับการจัดการเอกสารที่ซับซ้อน มี Dashboard แบบ Real-time และระบบ Workflow Visualization เน้น Security, Performance และ User Experience ตาม Requirements v1.4.1 อย่างครบถ้วน

---

## 📐 สถาปัตยกรรมระบบ

### **Technology Stack**

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
- **Security & File Processing** clamscan + js-file-download + dompurify
- **JSON Schema & Validation** ajv + ajv-formats + jsonpath + json-schema-ref-parser
- **Performance Monitoring** web-vitals + @axe-core/react
- **Advanced UI Components** react-json-view-lite + react-window (สำหรับ Virtual Scrolling)
- **Testing:**
  - **Unit/Integration:** Vitest + React Testing Library
  - **E2E:** Playwright
  - **API Mocking:** Mock Service Worker (MSW)

### **โครงสร้างโปรเจกต์**

```tree
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
│   ├── common/
│   ├── security/           # NEW: Security components
│   │   ├── file-upload-security.tsx
│   │   ├── virus-scan-status.tsx
│   │   └── security-audit-log.tsx
│   ├── json-details/       # NEW: JSON Details management
│   │   ├── json-details-form.tsx
│   │   ├── schema-validator.tsx
│   │   └── dynamic-form-generator.tsx
│   ├── routing/            # NEW: Correspondence routing
│   │   ├── routing-template-manager.tsx
│   │   ├── routing-workflow-visualizer.tsx
│   └── pending-routings-list.tsx
│   └── monitoring/         # NEW: Performance monitoring
│       ├── performance-metrics.tsx
│       ├── real-time-monitor.tsx
│       └── cache-status.tsx
└── layouts/             # Layout components
lib/
├── api/                 # API client & hooks
├── stores/              # Zustand stores
├── utils/               # Utility functions
├── hooks/               # Custom hooks
├── types/               # TypeScript types
├── security/              # NEW: Security utilities
│   ├── file-scanner.ts
│   ├── virus-scan-client.ts
│   └── security-headers.ts
├── json-schemas/          # NEW: JSON schema management
│   ├── schemas/
│   ├── validators/
│   └── transformers/
└── monitoring/            # NEW: Monitoring utilities
│   ├── performance.ts
│   ├── error-tracking.ts
│   └── metrics-collector.ts
public/
├── images/
└── fonts/
```

---

## 🗓️ แผนการพัฒนาแบบ Phase-Based

### **Phase 0: Setup & Infrastructure (สัปดาห์ที่ 1)**

**Milestone:** สร้างโครงสร้างพื้นฐานและ Development Environment

- **T0.1 Initialize Next.js Project**
  - สร้างโปรเจกต์ด้วย create-next-app:

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

- **T0.2 Install Core Dependencies**

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

  # Security & File Processing
  npm install clamscan js-file-download
  npm install dompurify @types/dompurify

  # JSON Schema & Validation
  npm install ajv ajv-formats
  npm install jsonpath json-schema-ref-parser

  # Performance Monitoring
  npm install web-vitals
  npm install @axe-core/react

  # Advanced UI Components
  npm install react-json-view-lite
  npm install react-window # สำหรับ Virtual Scrolling
  ```

  - Deliverable: ✅ Dependencies ติดตั้งสมบูรณ์

- **T0.3 Setup shadcn/ui**

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

- **T0.4 Configure Tailwind CSS**
  - แก้ไข tailwind.config.ts:
    - เพิ่ม Custom Colors (ตาม Brand)
    - เพิ่ม Custom Fonts (ภาษาไทย: Noto Sans Thai)
    - Configure Container, Spacing
  - สร้าง app/globals.css พร้อม Custom Styles
  - Deliverable: ✅ Tailwind พร้อมใช้

- **T0.5 Setup Development Environment**
  - สร้าง .env.local:

  ```yml
  NEXT_PUBLIC_API_URL=http://backend.np-dms.work/api
  NEXTAUTH_URL=http://localhost:3000
  NEXTAUTH_SECRET=...
  ```

  - Setup ESLint Rules (ไทย Comments OK)
  - Setup Prettier
  - Setup VS Code Settings
  - Deliverable: ✅ Dev Environment พร้อม

- **T0.6 Setup Git & Docker**
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

### **Phase 1: Authentication & App Shell (สัปดาห์ที่ 2-3)**

**Milestone:** ระบบ Login และ Layout หลัก

- **T1.1 Setup API Client**
  - สร้าง lib/api/client.ts:

  ```typescript
  import axios from axios;

  export const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: {
      Content-Type: application/json,
    },
  });

  // Request Interceptor (Add JWT Token)
  apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem(access_token);
    if (token) {
      config.headers.Authorization = Bearer ${token};
    }
    return config;
  });

  // Response Interceptor (Handle Errors)
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Redirect to login
        window.location.href = /login;
      }
      return Promise.reject(error);
    }
  );
  ```

  - Deliverable: ✅ API Client พร้อมใช้

- **T1.2 Setup TanStack Query**

- สร้าง `app/providers.tsx`:

  ```typescript
  'use client';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { useState } from 'react';

  export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1 minute
          refetchOnWindowFocus: false,
        },
      },
    }));

    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }
  ```

- Wrap ใน `app/layout.tsx`
- Deliverable: ✅ React Query พร้อม

- **T1.3 Create Auth Store (Zustand)**

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

- **T1.4 Create Login Page**

- สร้าง `app/(public)/login/page.tsx`:

  ```typescript
  'use client';
  import { useForm } from 'react-hook-form';
  import { zodResolver } from '@hookform/resolvers/zod';
  import * as z from 'zod';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { useRouter } from 'next/navigation';
  import { useAuthStore } from '@/lib/stores/auth-store';
  import { apiClient } from '@/lib/api/client';

  const loginSchema = z.object({
    username: z.string().min(1, 'กรุณากรอกชื่อผู้ใช้'),
    password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
  });

  export default function LoginPage() {
    const router = useRouter();
    const setAuth = useAuthStore((state) => state.setAuth);
    const form = useForm({
      resolver: zodResolver(loginSchema),
    });

    const handleLogin = async (data: z.infer<typeof loginSchema>) => {
      try {
        const response = await apiClient.post('/auth/login', data);
        const { access_token, user } = response.data;
        setAuth(user, access_token);
        router.push('/dashboard');
      } catch (error) {
        console.error('Login failed:', error);
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

- **T1.5 Create Landing Page**

- สร้าง `app/(public)/page.tsx`:
  - Hero Section พร้อมข้อมูลโครงการ
  - Feature Highlights
  - CTA Button → Login
- ใช้ Tailwind + Animations
- Deliverable: ✅ Landing Page สวยงาม

- **T1.6 Create Protected Layout (App Shell)**

- สร้าง `app/(protected)/layout.tsx`:

  ```typescript
  'use client';
  import { useEffect } from 'react';
  import { useRouter } from 'next/navigation';
  import { useAuthStore } from '@/lib/stores/auth-store';
  import Navbar from '@/components/layouts/navbar';
  import Sidebar from '@/components/layouts/sidebar';

  export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);

    useEffect(() => {
      if (!user) {
        router.push('/login');
      }
    }, [user, router]);

    if (!user) return null;

    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    );
  }
  ```

- Deliverable: ✅ App Shell พร้อม

- **T1.7 Create Navbar Component**

- สร้าง `components/layouts/navbar.tsx`:
  - แสดงชื่อระบบ
  - แสดงชื่อผู้ใช้ + Avatar
  - Dropdown Menu:
    - Profile
    - Settings
    - Logout
- Responsive (Mobile Hamburger Menu)
- Deliverable: ✅ Navbar พร้อม

- **T1.8 Create Sidebar Component**

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

- **T1.9 Setup Global Error Handling & Resilience**

  ```typescript

  ```

// สร้าง lib/error-handling/global-error-handler.ts
export class GlobalErrorHandler {
static setup() {
// API Error Interceptors
apiClient.interceptors.response.use(
(response) => response,
(error) => {
this.handleApiError(error);
return Promise.reject(error);
}
);

    // Frontend Error Boundary
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);

}

static handleApiError(error: any) {
// Circuit Breaker Pattern
if (error.response?.status >= 500) {
this.circuitBreaker.recordFailure();
}

    // User-friendly Error Messages
    const userMessage = this.getUserFriendlyMessage(error);
    this.showErrorToast(userMessage);

    // Error Reporting
    this.reportErrorToService(error);

}
}

````

T1.10 Setup Security Foundation

```typescript
// สร้าง lib/security/security-config.ts
export const SecurityConfig = {
fileUpload: {
  allowedTypes: ['pdf', 'dwg', 'docx', 'xlsx', 'zip'],
  maxSize: 50 * 1024 * 1024, // 50MB
  virusScanRequired: true,
  scanTimeout: 30000 // 30 seconds
},
rateLimiting: {
  maxRequests: {
    anonymous: 100,
    viewer: 500,
    editor: 1000,
    documentControl: 2000,
    admin: 5000
  }
}
};
````

---

### **Phase 2: Dashboard & Common Components (สัปดาห์ที่ 4)**

**Milestone:** Dashboard และ Reusable Components

- **T2.1 Create Reusable Components**

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
  -
- Deliverable: ✅ Reusable Components พร้อม

- **T2.2 Create Dashboard Page**

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

- **T2.3 Create API Hooks**

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

### **Phase 3: Correspondence Management (สัปดาห์ที่ 5-6)**

**Milestone:** ระบบจัดการเอกสารโต้ตอบ

- **T3.1 Create Correspondence List Page**

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

- **T3.2 Create Correspondence Detail Page**

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
  - - **Tags**:
    - แสดง Tags แบบ Chips
  - **Activity Log**:
    - แสดง Audit Log ของเอกสารนี้
- Deliverable: ✅ หน้า Detail ครบถ้วน

- **T3.3 Create Correspondence Form (Create/Edit)**

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
  - - **Tags**:
    - Autocomplete Tag Input
  - **Attachments**:
    - File Upload (Multi-file)
    - กำหนด Main Document (Radio)
  - **Deadline**:
    - Due Date (Date Picker)
- Validation ด้วย Zod
- Submit → API → Redirect to Detail
- Deliverable: ✅ ฟอร์มสร้าง/แก้ไข

- **T3.4 Create Status Management**

- ใน Detail Page เพิ่มปุ่ม Status Actions:
  - **Draft → Submit** (Document Control)
  - **Submit → Close** (Admin)
  - **Submit → Cancel** (Admin + Dialog ให้กรอกเหตุผล)
- แสดง Confirmation Dialog ก่อนเปลี่ยนสถานะ
- Deliverable: ✅ เปลี่ยนสถานะได้

---

### **Phase 4: RFA & Workflow Visualization (สัปดาห์ที่ 7-8)**

**Milestone:** ระบบ RFA และ Workflow

- **T4.1 Create RFA List Page**

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

- **T4.2 Create RFA Detail Page**

- สร้าง `app/(protected)/rfas/[id]/page.tsx`:
  - คล้าย Correspondence Detail
  - เพิ่ม Section:
    - **Shop Drawings** (สำหรับ RFA_DWG):
      - แสดงรายการ Shop Drawings ที่เชื่อมโยง
      - แสดง Revision ของแต่ละแบบ
      - Link ไปยัง Shop Drawing Detail
    - **Workflow Visualization** (ดูรายละเอียดใน T4.3)
- Deliverable: ✅ หน้า Detail RFA

- **T4.3 Create Workflow Visualization Component**

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

- **T4.4 Create RFA Form (Create/Edit)**

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

- **T4.5 Implement Workflow Actions API**

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

### **Phase 5: Drawing Management (สัปดาห์ที่ 9)**

**Milestone:** ระบบจัดการแบบ

- **T5.1 Create Shop Drawing List Page**

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

- **T5.2 Create Shop Drawing Detail Page**

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

- **T5.3 Create Shop Drawing Form**

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

- **T5.4 Create Contract Drawing List & Detail**

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

### **Phase 6: Circulation & Transmittal (สัปดาห์ที่ 10)**

**Milestone:** ระบบใบเวียนและเอกสารนำส่ง

- **T6.1 Create Circulation List Page**

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

- **T6.2 Create Circulation Detail & Workflow**

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

- **T6.3 Create Circulation Form**

- สร้าง `app/(protected)/circulations/create/page.tsx`:
- Form Fields:
  - **Linked Correspondence**:
    - Search & Select Correspondence (Required)
  - **Subject**: (Text)
  - **Workflow Template** (Optional):
    - Dropdown เลือก Template ที่มีอยู่
    - หรือสร้างแบบ Custom
  - **Assignees Section**:
    - **Main** (ผู้รับผิดชอบหลัก):
      - Multi-select Users
      - กำหนด Deadline (Date Picker)
    - **Action** (ผู้ร่วมปฏิบัติงาน):
      - Multi-select Users
      - กำหนด Deadline
    - **Information** (ผู้ที่ต้องรับทราบ):
      - Multi-select Users
      - ไม่ต้องกำหนด Deadline
  - **Attachments** (Optional):
    - อัปโหลดไฟล์เพิ่มเติมนอกจากเอกสารต้นทาง
- Submit → สร้าง Circulation + Send Notifications
- Deliverable: ✅ ฟอร์มสร้างใบเวียน

- **T6.4 Create Circulation Template Management**

- สร้าง `app/(protected)/admin/circulation-templates/page.tsx`:
  - List Templates
  - Create/Edit Template
  - Template Form Fields:
    - Template Name
    - Description
    - **Steps**:
      - Step Number (Auto)
      - Organization (Dropdown)
      - Role (Dropdown, Optional)
      - Duration (Days)
      - Is Optional (Checkbox)
- Deliverable: ✅ จัดการ Template ได้

- **T6.5 Create Transmittal Pages**

- สร้าง `app/(protected)/transmittals/page.tsx`:
  - Data Table:
    - Transmittal Number
    - Purpose (Badge)
    - TO Organization
    - Date
    - Item Count
- สร้าง `app/(protected)/transmittals/[id]/page.tsx`:
  - Header: Transmittal Number, Purpose
  - Metadata: Originator, Recipients, Date, Remarks
  - **Items Section**:
    - Data Table:
      - Document Number (Link)
      - Title
      - Type
      - Quantity
      - Remarks
- สร้าง `app/(protected)/transmittals/create/page.tsx`:
  - Form Fields:
    - Purpose (Dropdown: FOR_APPROVAL, FOR_INFORMATION, FOR_REVIEW)
    - TO Organization (Dropdown)
    - CC Organizations (Multi-select)
    - Remarks (Textarea)
    - **Items**:
      - Search & Select Correspondences/RFAs (Multi-select)
      - กำหนด Quantity และ Remarks ต่อแต่ละรายการ
    - Attachments (Cover Letter)
- Deliverable: ✅ ระบบ Transmittal ครบถ้วน

---

### **Phase 7: Search & Reports (สัปดาห์ที่ 11)**

**Milestone:** ระบบค้นหาและรายงาน

- **T7.1 Create Advanced Search Page**

- สร้าง `app/(protected)/search/page.tsx`:
  - **Search Filters Panel** (Sidebar):
    - Document Type (Checkboxes):
      - Correspondence
      - RFA
      - Shop Drawing
      - Contract Drawing
      - Circulation
      - Transmittal
    - Text Search:
      - Keyword (Full-text)
      - Document Number
      - Title
    - Date Range:
      - From Date (Date Picker)
      - To Date (Date Picker)
    - Status (Multi-select)
    - Organization (Multi-select)
    - Tags (Autocomplete Multi-select)
    - Project (Dropdown)
    - Contract (Dropdown)
  - **Search Results Panel** (Main Area):
    - Data Table:
      - Document Type (Icon + Badge)
      - Document Number (Link)
      - Title
      - Status
      - Date
      - Organization
      - Match Score (จาก Elasticsearch)
    - Pagination
    - Sort Options (Relevance, Date, Title)
  - **Export Results**:
    - ปุ่ม "Export to CSV"
    - ปุ่ม "Export to Excel"
- Deliverable: ✅ หน้าค้นหาขั้นสูง

- **T7.2 Create Search API Hooks**

- สร้าง `lib/api/hooks/use-search.ts`:

  ```typescript
  import { useQuery } from '@tanstack/react-query';
  import { apiClient } from '../client';

  interface SearchFilters {
    q?: string;
    types?: string[];
    statuses?: string[];
    organizations?: number[];
    tags?: number[];
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }

  export function useSearch(filters: SearchFilters) {
    return useQuery({
      queryKey: ['search', filters],
      queryFn: async () => {
        const response = await apiClient.get('/search', { params: filters });
        return response.data;
      },
      enabled: !!filters.q || Object.keys(filters).length > 1,
    });
  }
  ```

- Deliverable: ✅ Search Hooks พร้อม

- **T7.3 Create Reports Page**

- สร้าง `app/(protected)/reports/page.tsx`:
  - **Report Types** (Tabs):
    - **Correspondence Summary**:
      - Filter: Project, Date Range, Type
      - Chart: Bar Chart (จำนวนเอกสารแยกตามประเภท)
      - Table: รายการเอกสารพร้อมสถิติ
    - **RFA Summary**:
      - Filter: Project, Date Range, Type
      - Chart: Pie Chart (สัดส่วนสถานะ)
      - Table: รายการ RFA พร้อมสถิติ
    - **Activity Report**:
      - Filter: User, Date Range
      - Timeline: แสดงกิจกรรมตามเวลา
      - Table: รายละเอียดกิจกรรม
    - **Overdue Report**:
      - แสดงเอกสาร/งานที่เกินกำหนด
      - Group by: Type, Organization, User
  - **Export Options**:
    - PDF Report (ใช้ Browser Print)
    - Excel Export
- Deliverable: ✅ หน้ารายงาน

- **T7.4 Integrate Charts (Recharts)**

```bash
npm install recharts
```

- สร้าง Chart Components:
  - `components/features/reports/bar-chart.tsx`
  - `components/features/reports/pie-chart.tsx`
  - `components/features/reports/line-chart.tsx`
- ใช้ใน Reports Page
- Deliverable: ✅ Charts พร้อมใช้

---

### **Phase 8: Admin Panel (สัปดาห์ที่ 12-13)**

**Milestone:** ระบบจัดการสำหรับ Admin

- **T8.1 Create User Management Pages**

- สร้าง `app/(protected)/admin/users/page.tsx`:
  - **Permission Guard**: ตรวจสอบสิทธิ์ `users.view`
  - Data Table:
    - Username
    - Name
    - Email
    - Organization
    - Roles (Badges)
    - Status (Active/Inactive)
    - Actions (Edit, Deactivate, Reset Password)
  - Filters:
    - Organization
    - Role
    - Status
  - Create User Button
- สร้าง `app/(protected)/admin/users/create/page.tsx`:
  - Form Fields:
    - Username (Text, Unique)
    - Email (Email, Unique)
    - Password (Password)
    - First Name, Last Name (Text)
    - Line ID (Text, Optional)
    - Primary Organization (Dropdown)
    - **Global Role** (Dropdown, Optional)
    - **Project Roles** (Multi-select):
      - เลือก Project + Role
    - **Contract Roles** (Multi-select):
      - เลือก Contract + Role
- สร้าง `app/(protected)/admin/users/[id]/edit/page.tsx`:
  - คล้าย Create Form
  - เพิ่ม: Deactivate Button, Reset Password Button
- Deliverable: ✅ จัดการผู้ใช้ได้

- **T8.2 Create Role & Permission Management**

- สร้าง `app/(protected)/admin/roles/page.tsx`:
  - **Permission Guard**: `roles.view`
  - List Roles (Cards):
    - Role Name
    - Scope (Global, Organization, Project, Contract)
    - Permission Count
    - Edit Button
- สร้าง `app/(protected)/admin/roles/[id]/edit/page.tsx`:
  - Form Fields:
    - Role Name (Text)
    - Scope (Radio: Global, Organization, Project, Contract)
    - Description (Textarea)
    - **Permissions** (Grouped Checkboxes):
      - Group by Module:
        - System Management
        - User Management
        - Project Management
        - Document Management
        - Workflow Management
        - Search & Reporting
      - แต่ละ Permission มี Checkbox + Description
- Deliverable: ✅ จัดการ Roles และ Permissions ได้

- **T8.3 Create Master Data Management**

- สร้าง `app/(protected)/admin/master-data/page.tsx`:
  - - **Tabs**:
    - **Correspondence Types**:
      - List + Create/Edit Form
      - Fields: Type Code, Type Name, Sort Order
    - **RFA Types**:
      - List + Create/Edit Form
    - **Status Codes**:
      - List + Create/Edit Form
    - - **Tags**:
      - List + Create/Edit Form
    - **Drawing Categories**:
      - List + Create/Edit Form (Main & Sub Categories)
- Deliverable: ✅ จัดการ Master Data ได้

- **T8.4 Create Document Numbering Management**

- สร้าง `app/(protected)/admin/document-numbering/page.tsx`:
  - **Document Number Formats Section**:
    - Data Table:
      - Project
      - Document Type
      - Format Template
      - Example
      - Actions (Edit, Delete)
    - Create Format Button
  - **Create/Edit Format Form**:
    - Project (Dropdown)
    - Document Type (Dropdown)
    - Format Template (Text):
      - แสดง Available Placeholders:
        - `{ORG_CODE}` - รหัสองค์กร
        - `{TYPE_CODE}` - รหัสประเภทเอกสาร
        - `{YEAR}` - ปี พ.ศ. 4 หลัก
        - `{YEAR_SHORT}` - ปี พ.ศ. 2 หลัก
        - `{SEQ:n}` - เลขลำดับ (n = จำนวนหลัก)
      - Live Preview: แสดงตัวอย่างเลขที่จากรูปแบบที่กรอก
    - Description (Textarea)
  - **Current Counters Section** (Read-only):
    - Data Table:
      - Project
      - Organization
      - Document Type
      - Year
      - Last Number
- Deliverable: ✅ จัดการ Document Numbering ได้

- **T8.5 Create Organization Onboarding Workflow**

- สร้าง `app/(protected)/admin/organizations/page.tsx`:
  - **Permission Guard**: `organizations.manage` (Superadmin only)
  - List Organizations:
    - Organization Code
    - Organization Name
    - Status
    - Org Admin (ชื่อ)
    - Actions
  - Create Organization Button
- สร้าง `app/(protected)/admin/organizations/create/page.tsx`:
  - **Step 1: Organization Info**:
    - Organization Code (Text, Unique)
    - Organization Name (Text)
    - Description (Textarea)
  - **Step 2: Appoint Org Admin**:
    - Search & Select User
    - หรือ Create New User
    - Assign Role: "Org Admin"
  - **Step 3: Confirmation**:
    - แสดงสรุปข้อมูล
    - Submit → สร้างองค์กรและ Assign Admin
- Deliverable: ✅ Superadmin สามารถ Onboard องค์กรใหม่ได้

- **T8.6 Create Project & Contract Management**

- สร้าง `app/(protected)/admin/projects/page.tsx`:
  - **Permission Guard**: `projects.view`
  - List Projects
  - Create/Edit Project
  - **Project Detail Page**:
    - Metadata
    - **Participating Organizations** (Multi-select)
    - **Contracts Section**:
      - List Contracts ในโครงการนี้
      - Create Contract Button
    - **Members Section**:
      - List Users ในโครงการ
      - Assign User to Project Button
      - กำหนด Project Role
- สร้าง `app/(protected)/admin/contracts/[id]/page.tsx`:
  - Contract Info
  - **Contract Organizations**:
    - Organization + Role in Contract (Owner, Designer, Contractor)
  - **Members Section**:
    - Assign User to Contract
    - กำหนด Contract Role
- Deliverable: ✅ จัดการ Projects และ Contracts ได้

---

### **Phase 9: User Profile & Settings (สัปดาห์ที่ 14)**

**Milestone:** หน้าโปรไฟล์และการตั้งค่า

- **T9.1 Create Profile Page**

- สร้าง `app/(protected)/profile/page.tsx`:
  - **User Info Section**:
    - Avatar (Upload รูปภาพ)
    - Username (Read-only)
    - Email (Editable)
    - First Name, Last Name (Editable)
    - Line ID (Editable)
    - Primary Organization (Read-only)
  - **My Roles Section**:
    - แสดง Roles ทั้งหมดที่ได้รับ:
      - Global Role
      - Organization Roles
      - Project Roles
      - Contract Roles
    - แสดงเป็น Cards พร้อม Scope และ Permissions
  - **Change Password Section**:
    - Current Password (Password)
    - New Password (Password)
    - Confirm Password (Password)
    - Submit Button
  - **Notification Settings**:
    - Email Notifications (Toggle)
    - Line Notifications (Toggle)
    - ประเภทการแจ้งเตือน (Checkboxes):
      - New Document Received
      - Task Assigned
      - Document Approved/Rejected
      - Approaching Deadline
- Deliverable: ✅ หน้า Profile พร้อม

- **T9.2 Create Settings Page** (Optional)

- สร้าง `app/(protected)/settings/page.tsx`:
  - **Display Preferences**:
    - Language (ไทย/English) - Future
    - Date Format (DD/MM/YYYY, MM/DD/YYYY)
    - Time Zone (Auto-detect)
  - - **Table Preferences**:
    - Default Page Size (10, 20, 50)
    - Default Sort Order
  - **Export Preferences**:
    - Default Export Format (CSV, Excel)
- Deliverable: ✅ หน้า Settings พร้อม

---

### **Phase 10: Testing & Optimization (สัปดาห์ที่ 15-16)**

**Milestone:** ทดสอบและปรับปรุงประสิทธิภาพ

- **T10.1 Setup Testing Environment**

- ติดตั้ง Testing Libraries:

  ```bash
  npm install -D vitest @testing-library/react @testing-library/jest-dom
  npm install -D @testing-library/user-event
  npm install -D msw
  npm install -D @playwright/test
  ```

- สร้าง `vitest.config.ts`
- สร้าง `playwright.config.ts`
- Setup MSW Handlers: `lib/mocks/handlers.ts`
- Deliverable: ✅ Testing Setup พร้อม

- **T10.2 Unit Testing**

- เขียน Unit Tests สำหรับ:
  - **Utilities**: `lib/utils/*.ts`
  - **Hooks**: `lib/api/hooks/*.ts`
  - **Components**:
    - `components/features/common/data-table.test.tsx`
    - `components/features/common/file-upload.test.tsx`
    - `components/features/common/status-badge.test.tsx`
- Target: 70% Code Coverage
- Deliverable: ✅ Unit Tests ผ่านทั้งหมด

- **T10.3 Integration Testing**

- เขียน Integration Tests สำหรับ:
  - **Authentication Flow**:
    - Login → Dashboard → Logout
  - **Correspondence Flow**:
    - List → Create → Detail → Edit
  - **RFA Workflow**:
    - Create RFA → Start Workflow → Complete Step
  - **Circulation Flow**:
    - Create → Assign → Complete → Close
- ใช้ MSW เพื่อ Mock API Responses
- Deliverable: ✅ Integration Tests ผ่าน

- **T10.4 E2E Testing (Playwright)**

- เขียน E2E Tests สำหรับ Critical User Flows:
  - **User Registration & Login**
  - **Create Correspondence (Full Flow)**:
    - Fill Form → Upload Files → Submit → Verify in List
  - **Create RFA with Shop Drawings**:
    - Select Drawings → Fill Form → Start Workflow → Verify Status
  - **Complete RFA Workflow**:
    - Login as Reviewer → Go to RFA → Complete Step → Verify Next Step
  - **Search Documents**:
    - Enter Query → Verify Results → Click Result → Verify Detail
- Deliverable: ✅ E2E Tests ผ่าน

- **T10.5 Performance Optimization**

- **Code Splitting**:
  - ใช้ Dynamic Imports สำหรับ Heavy Components
  - Example:

    ```typescript
    const RfaWorkflowVisualizer = dynamic(
      () => import('@/components/features/rfa/workflow-visualizer'),
      { loading: () => <Skeleton /> }
    );
    ```

- **Image Optimization**:
  - ใช้ Next.js `<Image>` Component
  - Setup Image CDN (ถ้ามี)
- **Data Fetching Optimization**:
  - ใช้ `prefetchQuery` สำหรับ Critical Data
  - Implement Infinite Scroll สำหรับ Long Lists
- **Bundle Size Analysis**:

  ```bash
  npm run build
  npx @next/bundle-analyzer
  ```

  - ลบ Dependencies ที่ไม่ใช้
  - Tree Shaking

- Deliverable: ✅ Performance Metrics ดีขึ้น

- **T10.6 Accessibility (a11y) Testing**

- ติดตั้ง `@axe-core/react`
- รัน axe DevTools ในหน้าสำคัญ
- แก้ไข Issues:
  - Missing alt text
  - Low contrast ratios
  - Missing ARIA labels
  - Keyboard navigation
- Target: Zero Critical/Serious Issues
- Deliverable: ✅ Accessibility Checklist ผ่าน

- **T10.7 Responsive Design Testing**

- ทดสอบบนอุปกรณ์ต่างๆ:
  - Desktop (1920x1080, 1366x768)
  - Tablet (768x1024)
  - Mobile (375x667, 414x896)
- แก้ไข Layout Issues:
  - Sidebar Collapse บน Mobile
  - Table Horizontal Scroll
  - Form Layout
- Deliverable: ✅ Responsive บนทุกอุปกรณ์

- **T10.8 Security Hardening**

- **Input Sanitization**:
  - ตรวจสอบ XSS ใน User Inputs
  - ใช้ DOMPurify สำหรับ Rich Text (ถ้ามี)
- **CSRF Protection**:
  - Verify NextAuth CSRF Tokens
- **Content Security Policy**:
  - Setup CSP Headers ใน `next.config.js`
- **API Security**:
  - ตรวจสอบว่า Token ถูกส่งใน Headers ถูกต้อง
  - Handle 401/403 Errors properly
- Deliverable: ✅ Security Checklist ผ่าน

---

### **Phase 11: Documentation & Deployment (สัปดาห์ที่ 17)**

**Milestone:** เอกสารและ Deploy สู่ Production

- **T11.1 Component Documentation (Storybook)** (Optional)

- ติดตั้ง Storybook:

  ```bash
  npx storybook@latest init
  ```

- เขียน Stories สำหรับ Reusable Components:
  - Button, Input, Card, Table
  - FileUpload, StatusBadge, PermissionGuard
  - WorkflowVisualizer
- Deliverable: ✅ Storybook พร้อม

- **T11.2 User Documentation**

- เขียนคู่มือผู้ใช้งาน (ภาษาไทย):
  - **Getting Started**:
    - วิธีล็อกอิน
    - ภาพรวม Dashboard
  - **Correspondence Management**:
    - วิธีสร้างเอกสาร
    - วิธีแก้ไขและเปลี่ยนสถานะ
    - วิธีค้นหาเอกสาร
  - **RFA Workflow**:
    - วิธีสร้าง RFA
    - วิธีตรวจสอบและอนุมัติ
    - วิธีติดตาม Workflow
  - **Circulation**:
    - วิธีสร้างใบเวียน
    - วิธีดำเนินการตามใบเวียน
  - **Drawing Management**:
    - วิธีอัปโหลดแบบ
    - วิธีเชื่อมโยงแบบ
  - **Admin Functions**:
    - วิธีจัดการผู้ใช้
    - วิธีกำหนดสิทธิ์
    - วิธีจัดการ Master Data
- Format: PDF + Online (ใน `/docs` Route)
- Deliverable: ✅ User Guide พร้อม

- **T11.3 Developer Documentation**

- เขียนเอกสารทางเทคนิค:
  - **Architecture Overview**:
    - Tech Stack
    - Folder Structure
    - State Management Strategy
  - **Component Guidelines**:
    - Naming Conventions
    - Props Interface Design
    - Styling Best Practices
  - **API Integration**:
    - API Client Setup
    - React Query Usage
    - Error Handling
  - - **Testing Guidelines**:
    - Unit Test Examples
    - Integration Test Examples
    - E2E Test Examples
  - **Deployment Guide**:
    - Build Process
    - Environment Variables
    - Docker Configuration
- Format: Markdown (ใน `/docs` Folder)
- Deliverable: ✅ Dev Docs พร้อม

- **T11.4 Deployment Preparation**

- **Production Build**:

  ```bash
  npm run build
  ```

  - ตรวจสอบ Build Output
  - แก้ไข Build Errors/Warnings

- **Environment Variables**:
  - สร้างไฟล์ `.env.production`
  - กำหนดค่าใน docker-compose.yml:

    ```yaml
    environment:
      - NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api
      - NEXTAUTH_URL=https://lcbp3.np-dms.work
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    ```

- **Docker Image**:
  - Build Image:

    ```bash
    docker build -t lcbp3-frontend:v1.0.0 .
    ```

  - Test Image Locally

- Deliverable: ✅ Production Build พร้อม

- **T11.5 Deploy to QNAP**

- **Upload Image to QNAP**:
  - Export Image:

    ```bash
    docker save lcbp3-frontend:v1.0.0 > frontend.tar
    ```

  - Upload ผ่าน QNAP File Station
  - Import ใน Container Station

- **Update docker-compose.yml** บน QNAP:

  ```yaml
  services:
    frontend:
      image: lcbp3-frontend:v1.0.0
      container_name: frontend
      networks:
        - lcbp3
      environment:
        - NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api
        - NEXTAUTH_URL=https://lcbp3.np-dms.work
        - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      restart: unless-stopped
  ```

- **Start Container**:
  - รันผ่าน Container Station UI
  - ตรวจสอบ Logs
- Deliverable: ✅ Frontend รันบน Production

- **T11.6 Configure Nginx Proxy Manager**

- เพิ่ม Proxy Host ใหม่:
  - Domain: `lcbp3.np-dms.work`
  - Forward to: `frontend:3000`
  - Enable Websocket Support
  - Enable SSL (Let's Encrypt)
  - Force HTTPS
- ทดสอบเข้าถึงผ่าน HTTPS
- Deliverable: ✅ HTTPS พร้อมใช้

- **T11.7 Monitoring & Health Check**

- สร้าง Health Check Endpoint (ถ้า Backend ยังไม่มี):

  ```typescript
  // app/api/health/route.ts
  export async function GET() {
    return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
  }
  ```

- Setup Monitoring:
  - QNAP Container Resource Monitor
  - Log Aggregation (ถ้ามี)
- Deliverable: ✅ Monitoring Setup

- **T11.8 User Acceptance Testing (UAT)**

- เตรียม UAT Checklist:
  - ✅ ล็อกอินได้ทุก Role
  - ✅ สร้าง Correspondence ได้
  - ✅ สร้าง RFA และ Start Workflow ได้
  - ✅ Workflow อนุมัติได้ถูกต้อง
  - ✅ สร้าง Circulation และมอบหมายงานได้
  - ✅ อัปโหลดไฟล์ได้
  - ✅ ค้นหาเอกสารได้
  - ✅ สร้างรายงานได้
  - ✅ Admin จัดการผู้ใช้และสิทธิ์ได้
- เชิญ Stakeholders ทดสอบ
- เก็บ Feedback
- แก้ไข Bugs/Issues
- Deliverable: ✅ UAT ผ่าน

- **T11.9 Training & Handover**

- จัด Workshop สำหรับผู้ใช้งาน:
  - **Session 1: Basic Users** (2 ชม.):
    - วิธีใช้ Dashboard
    - วิธีสร้างและจัดการเอกสาร
    - วิธีตอบกลับ Circulation
  - **Session 2: Document Control** (2 ชม.):
    - วิธีจัดการเอกสารขั้นสูง
    - วิธีควบคุม Workflow
    - วิธีดู Reports
  - **Session 3: Admin** (2 ชม.):
    - วิธีจัดการผู้ใช้และสิทธิ์
    - วิธีจัดการ Master Data
    - วิธีตั้งค่า Document Numbering
- บันทึก Video Training (Optional)
- Deliverable: ✅ Users ใช้งานเป็น

---

## 📊 สรุป Timeline

| Phase    | ระยะเวลา       | จำนวนงาน     | Output หลัก                   |
| -------- | -------------- | ------------ | ----------------------------- |
| Phase 0  | 1 สัปดาห์      | 6            | Infrastructure Ready          |
| Phase 1  | 2 สัปดาห์      | 8            | Auth & App Shell              |
| Phase 2  | 1 สัปดาห์      | 3            | Dashboard & Components        |
| Phase 3  | 2 สัปดาห์      | 4            | Correspondence Management     |
| Phase 4  | 2 สัปดาห์      | 5            | RFA & Workflow                |
| Phase 5  | 1 สัปดาห์      | 4            | Drawing Management            |
| Phase 6  | 1 สัปดาห์      | 5            | Circulation & Transmittal     |
| Phase 7  | 1 สัปดาห์      | 4            | Search & Reports              |
| Phase 8  | 2 สัปดาห์      | 6            | Admin Panel                   |
| Phase 9  | 1 สัปดาห์      | 2            | Profile & Settings            |
| Phase 10 | 2 สัปดาห์      | 8            | Testing & Optimization        |
| Phase 11 | 1 สัปดาห์      | 9            | Documentation & Deploy        |
| **รวม**  | **17 สัปดาห์** | **64 Tasks** | **Production-Ready Frontend** |

---

## 🎯 Critical Success Factors

1. **API Contract**: รอ Backend Swagger Documentation ก่อนเริ่ม Phase 3
2. **Design System**: สร้าง Design System ใน Figma ก่อนเริ่ม Phase 1
3. **Component Library**: สร้าง Reusable Components ให้ครบใน Phase 2 ก่อนไปต่

## 🎯 Critical Success Factors (ต่อ)

4. **Mobile-First Approach**: ออกแบบ Mobile ก่อน แล้วค่อย Scale up เป็น Desktop
5. **Accessibility**: ทดสอบ Keyboard Navigation และ Screen Reader ทุก Phase
6. **Performance Budget**:
   - Initial Load < 3s
   - Time to Interactive < 5s
   - Bundle Size < 500KB (gzipped)
7. **User Feedback Loop**: ทำ Usability Testing ทุก 2 สัปดาห์
8. **Code Quality**: Code Review ทุก PR, ห้าม Merge โดยไม่มี Tests

---

## 🔄 Dependencies & Integration Points

### Backend Dependencies (Critical Path)

| Frontend Feature    | Required Backend API              | Blocker Phase |
| ------------------- | --------------------------------- | ------------- |
| Login               | `POST /auth/login`                | Phase 1       |
| Dashboard           | `GET /api/circulations/my-tasks`  | Phase 2       |
| Correspondence CRUD | `/api/correspondences/*`          | Phase 3       |
| RFA Workflow        | `/api/rfas/*/workflow/*`          | Phase 4       |
| Drawing Management  | `/api/drawings/*`                 | Phase 5       |
| Circulation         | `/api/circulations/*`             | Phase 6       |
| Search              | `GET /api/search` (Elasticsearch) | Phase 7       |
| Reports             | `/api/reports/*`                  | Phase 7       |
| User Management     | `/api/users/*`, `/api/roles/*`    | Phase 8       |

**รอเอกสาร Swagger ให้ครบก่อน Phase 3** เพื่อหลีกเลี่ยงการแก้ไขซ้ำ

---

## 🛠️ Development Workflow

### Daily Routine

```
09:00-09:15  Daily Standup (อะไรทำเสร็จ, จะทำอะไร, มีอุปสรรคอะไร)
09:15-12:00  Development (Focus Time)
12:00-13:00  Lunch
13:00-16:00  Development + Code Review
16:00-16:30  Testing (Manual + Automated)
16:30-17:00  Documentation + Git Commit
```

### Git Workflow

```bash
# Feature Branch Strategy
git checkout -g develop
git pull origin develop
git checkout -b feature/T3.1-correspondence-list

# Work on Feature...
git add .
git commit -m "feat(correspondence): implement list page with filters

- Add DataTable component
- Implement server-side pagination
- Add filters for type, status, date range
- Add search functionality

Closes #T3.1"

# Push และสร้าง Pull Request
git push origin feature/T3.1-correspondence-list
```

### Commit Message Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **Types:**

- `feat`: ฟีเจอร์ใหม่
- `fix`: แก้ bug
- `docs`: เอกสาร
- `style`: Formatting (ไม่เปลี่ยน logic)
- `refactor`: Refactor code
- `test`: เพิ่ม tests
- `chore`: งานอื่นๆ (build, dependencies)

**Example:**

```
feat(rfa): implement workflow visualization component

- Add timeline-style workflow display
- Implement step completion actions
- Add admin override functionality
- Integrate with RFA workflow API

Closes #T4.3
```

---

## 🧪 Testing Strategy

### Testing Pyramid

```
        E2E (10%)           <- Playwright
       /         \
      /           \
     /             \
  Integration (30%) <- RTL + MSW
  /                 \
 /                   \
Unit Tests (60%)     <- Vitest
```

### Test Coverage Goals

| Area       | Target Coverage | Priority |
| ---------- | --------------- | -------- |
| Utilities  | 90%             | High     |
| Hooks      | 80%             | High     |
| Components | 70%             | Medium   |
| Pages      | 50%             | Low      |

### Testing Checklist (ต่อ Phase)

**Phase 1-2: Foundation**

- ✅ Auth Store Tests
- ✅ API Client Interceptors Tests
- ✅ DataTable Component Tests

**Phase 3-6: Features**

- ✅ Correspondence Form Validation Tests
- ✅ RFA Workflow State Machine Tests
- ✅ File Upload Component Tests
- ✅ Integration Test: Create Correspondence Flow

**Phase 7-9: Advanced**

- ✅ Search Filters Tests
- ✅ Report Generation Tests
- ✅ RBAC Permission Guard Tests

**Phase 10: E2E**

- ✅ E2E: Login → Dashboard → Create RFA → Complete Workflow
- ✅ E2E: Search → View Result → Edit → Verify Changes

---

## 📱 Responsive Design Guidelines

### Breakpoints (Tailwind Default)

```typescript
const breakpoints = {
  sm: '640px', // Mobile Landscape
  md: '768px', // Tablet Portrait
  lg: '1024px', // Tablet Landscape / Desktop
  xl: '1280px', // Desktop
  '2xl': '1536px', // Large Desktop
};
```

### Component Responsive Patterns

**Sidebar:**

```tsx
// Desktop: Fixed Sidebar
// Mobile: Collapsible (Hamburger Menu)

<aside className="hidden lg:block w-64 bg-gray-50">{/* Sidebar Content */}</aside>;

{
  /* Mobile Sidebar (Sheet) */
}
<Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
  <SheetContent side="left">{/* Sidebar Content */}</SheetContent>
</Sheet>;
```

**DataTable:**

```tsx
// Desktop: Full Table
// Mobile: Card List

<div className="hidden md:block">
  <Table>...</Table>
</div>

<div className="md:hidden space-y-4">
  {data.map(item => (
    <Card key={item.id}>
      {/* Card View */}
    </Card>
  ))}
</div>
```

**Form Layout:**

```tsx
// Desktop: 2-Column Grid
// Mobile: 1-Column Stack

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Input label="First Name" />
  <Input label="Last Name" />
</div>
```

---

## 🎨 Design System

### Color Palette (ตาม Brand)

```typescript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          // ... (Blue Scale)
          900: '#1e3a8a',
        },
        success: {
          // Green Scale
        },
        warning: {
          // Yellow Scale
        },
        danger: {
          // Red Scale
        },
        neutral: {
          // Gray Scale
        },
      },
    },
  },
};
```

### Typography Scale

```typescript
const typography = {
  h1: 'text-4xl font-bold', // Headings
  h2: 'text-3xl font-bold',
  h3: 'text-2xl font-semibold',
  h4: 'text-xl font-semibold',
  body: 'text-base', // Body Text
  small: 'text-sm', // Helper Text
  xs: 'text-xs', // Captions
};
```

### Spacing Scale (Tailwind Default)

```
4px   = space-1
8px   = space-2
12px  = space-3
16px  = space-4  <- Base Unit
24px  = space-6
32px  = space-8
48px  = space-12
64px  = space-16
```

### Component Variants

**Button:**

```tsx
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>

<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
```

**Badge (Status):**

```tsx
<Badge variant="draft">Draft</Badge>        // Gray
<Badge variant="submitted">Submitted</Badge> // Blue
<Badge variant="approved">Approved</Badge>   // Green
<Badge variant="rejected">Rejected</Badge>   // Red
<Badge variant="pending">Pending</Badge>     // Yellow
```

---

## 🔐 Security Best Practices

### 1. XSS Prevention

```tsx
// ❌ Dangerous
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ Safe (Auto-escaping)
<div>{userInput}</div>

// ✅ Safe (DOMPurify for Rich Text)
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(richText) }} />
```

### 2. Authentication Token Storage

```typescript
// ❌ ห้ามเก็บใน localStorage (ถ้ามี XSS จะโดนขโมย)
localStorage.setItem('token', token);

// ✅ ใช้ HttpOnly Cookie (ผ่าน NextAuth)
// หรือใช้ Memory (Zustand persist แต่ไม่เก็บ Token)
const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      // ไม่เก็บ token ใน state
    }),
    { name: 'auth-storage' }
  )
);
```

### 3. API Request Security

```typescript
// ✅ ใส่ Token ใน Header (ไม่ใช่ URL)
apiClient.interceptors.request.use((config) => {
  const token = getToken(); // จาก Cookie หรือ Auth Provider
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 4. CSRF Protection

```tsx
// NextAuth จัดการให้อัตโนมัติ
// ตรวจสอบว่า csrfToken ถูกส่งไปกับทุก Request
```

### 5. Input Validation

```typescript
// ✅ Validate ทั้ง Frontend และ Backend
const formSchema = z.object({
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง'),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'),
  title: z.string().max(255, 'ชื่อเรื่องยาวเกินไป'),
});
```

---

## ⚡ Performance Optimization Techniques

### 1. Code Splitting

```tsx
// ✅ Dynamic Import สำหรับ Heavy Components
import dynamic from 'next/dynamic';

const WorkflowVisualizer = dynamic(() => import('@/components/features/rfa/workflow-visualizer'), {
  loading: () => <Skeleton className="h-96" />,
  ssr: false, // ถ้าไม่ต้องการ SSR
});
```

### 2. Image Optimization

```tsx
// ✅ ใช้ Next.js Image Component
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="LCBP3 Logo"
  width={200}
  height={50}
  priority // สำหรับรูปสำคัญ (Above the fold)
/>;
```

### 3. Data Fetching Optimization

```typescript
// ✅ Prefetch ข้อมูลที่คาดว่าจะใช้
const queryClient = useQueryClient();

const handleMouseEnter = () => {
  queryClient.prefetchQuery({
    queryKey: ['correspondence', id],
    queryFn: () => fetchCorrespondence(id),
  });
};

<Link href={`/correspondences/${id}`} onMouseEnter={handleMouseEnter}>
  View Details
</Link>
```

### 4. Debounce Search Input

```typescript
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';

const [searchQuery, setSearchQuery] = useState('');
const debouncedQuery = useDebouncedValue(searchQuery, 500);

// Query จะรันเมื่อผู้ใช้หยุดพิมพ์ 500ms
const { data } = useSearch({ q: debouncedQuery });
```

### 5. Virtual Scrolling (สำหรับรายการยาวมาก)

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
});

<div ref={parentRef} className="h-96 overflow-auto">
  <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
    {virtualizer.getVirtualItems().map((virtualItem) => (
      <div key={virtualItem.key} style={{ height: `${virtualItem.size}px` }}>
        {items[virtualItem.index].name}
      </div>
    ))}
  </div>
</div>;
```

---

## 🌐 Internationalization (i18n) - Future Enhancement

```typescript
// lib/i18n/config.ts
export const locales = ['th', 'en'] as const;
export const defaultLocale = 'th';

// messages/th.json
{
  "common": {
    "save": "บันทึก",
    "cancel": "ยกเลิก",
    "delete": "ลบ"
  },
  "correspondence": {
    "create": "สร้างเอกสาร",
    "title": "ชื่อเรื่อง"
  }
}

// Usage
import { useTranslation } from 'next-intl';

const { t } = useTranslation();
<Button>{t('common.save')}</Button>
```

---

## 📦 Build & Deployment Optimization

### Dockerfile (Production-Optimized)

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

### next.config.js (Production)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // สำหรับ Docker
  reactStrictMode: true,
  swcMinify: true, // ใช้ SWC แทน Terser (เร็วกว่า)

  // Image Optimization
  images: {
    domains: ['backend.np-dms.work'], // ถ้ามี Image จาก Backend
    formats: ['image/webp'],
  },

  // Compression
  compress: true,

  // Security Headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### Environment Variables Management

```yaml
# docker-compose.yml
services:
  frontend:
    image: lcbp3-frontend:v1.0.0
    container_name: frontend
    networks:
      - lcbp3
    environment:
      # Public (ถูก Replace ตอน Build)
      - NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api

      # Server-side Only
      - NEXTAUTH_URL=https://lcbp3.np-dms.work
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - DATABASE_URL=mysql://user:pass@mariadb:3306/dms_db
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 📊 Monitoring & Analytics (Future Enhancement)

### 1. Performance Monitoring

```typescript
// lib/monitoring/web-vitals.ts
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';

export function reportWebVitals() {
  onCLS((metric) => sendToAnalytics(metric));
  onFID((metric) => sendToAnalytics(metric));
  onFCP((metric) => sendToAnalytics(metric));
  onLCP((metric) => sendToAnalytics(metric));
  onTTFB((metric) => sendToAnalytics(metric));
}

function sendToAnalytics(metric: any) {
  // ส่งไปยัง Analytics Service (เช่น Google Analytics, Plausible)
  console.log(metric);
}
```

### 2. Error Tracking

```typescript
// lib/monitoring/error-tracking.ts
export function setupErrorTracking() {
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      // ส่ง Error ไปยัง Logging Service
      logError({
        message: event.message,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
      });
    });
  }
}
```

---

## 🚀 Go-Live Checklist

### Pre-Launch (1 สัปดาห์ก่อน)

- [ ] UAT ผ่านทั้งหมด
- [ ] Performance Audit (Lighthouse Score > 90)
- [ ] Security Audit (OWASP Top 10)
- [ ] Accessibility Audit (WCAG 2.1 AA)
- [ ] Browser Testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile Testing (iOS, Android)
- [ ] Load Testing (จำลอง 100+ Users พร้อมกัน)
- [ ] Backup & Rollback Plan พร้อม
- [ ] Monitoring & Alerting Setup
- [ ] Documentation ครบถ้วน

### Launch Day

- [ ] Deploy ตอน Off-Peak Hours (เช่น 02:00 AM)
- [ ] Health Check ทุก Service
- [ ] Smoke Test: Critical User Flows
- [ ] Monitor Logs & Metrics (Real-time)
- [ ] Standby Team (Backend + Frontend) พร้อมแก้ไข Hot-fix
- [ ] แจ้ง Users ผ่าน Email/Line

### Post-Launch (1 สัปดาห์หลัง)

- [ ] Monitor Error Rates
- [ ] Monitor Performance Metrics
- [ ] Collect User Feedback
- [ ] Fix Critical Bugs (Priority 1)
- [ ] Plan Next Iteration

---

## 🔄 Maintenance & Support Plan

### Daily

- ✅ ตรวจสอบ Error Logs
- ✅ ตรวจสอบ Performance Metrics
- ✅ รับ User Feedback/Bug Reports

### Weekly

- ✅ Review Open Issues
- ✅ Plan Bug Fixes & Minor Features
- ✅ Update Dependencies (Security Patches)

### Monthly

- ✅ Review Analytics (Usage Patterns)
- ✅ Plan Major Features
- ✅ Refactor Code (Technical Debt)
- ✅ Update Documentation

### Quarterly

- ✅ Major Version Update (Next.js, React)
- ✅ Performance Audit
- ✅ Security Audit
- ✅ User Training Refresh

---

## 📈 Success Metrics (KPIs)

### Technical Metrics

| Metric              | Target    | Measurement           |
| ------------------- | --------- | --------------------- |
| Page Load Time      | < 3s      | Lighthouse            |
| Time to Interactive | < 5s      | Lighthouse            |
| Core Web Vitals     | All Green | Google Search Console |
| Uptime              | 99.9%     | QNAP Monitor          |
| Error Rate          | < 0.1%    | Logs                  |
| Test Coverage       | > 70%     | Vitest                |

### User Metrics

| Metric               | Target              | Measurement  |
| -------------------- | ------------------- | ------------ |
| User Adoption        | 90% (ภายใน 3 เดือน) | Analytics    |
| Daily Active Users   | 50+                 | Analytics    |
| Task Completion Rate | > 85%               | User Testing |
| User Satisfaction    | > 4.0/5.0           | Survey       |
| Support Tickets      | < 10/week           | Helpdesk     |

---

## 🎓 Learning Resources for Team

### Next.js & React

- [Next.js Official Docs](https://nextjs.org/docs)
- [React Official Docs](https://react.dev)
- [Next.js App Router Course](https://nextjs.org/learn)

### TanStack Query

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [TanStack Query Video Course](https://ui.dev/c/react-query)

### shadcn/ui

- [shadcn/ui Docs](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com)

### Tailwind CSS

- [Tailwind Docs](https://tailwindcss.com/docs)
- [Tailwind UI Components](https://tailwindui.com)

### Testing

- [Vitest Docs](https://vitest.dev)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Docs](https://playwright.dev)

---

## 📞 Support & Communication Channels

### Development Team

- **Daily Standup**: ทุกวัน 09:00 AM (15 นาที)
- **Weekly Sprint Review**: ทุกศุกร์ 16:00 PM (1 ชม.)
- **Slack Channel**: `#lcbp3-frontend`
- **Code Review**: ใน Gitea Pull Requests

### Stakeholders

- **Bi-weekly Demo**: ทุกสองสัปดาห์ (ศุกร์ 14:00)
- **Monthly Report**: ส่งทุกต้นเดือน
- **Email**: <project-lcbp3@example.com>

---

## ✅ Next Steps

1. **Week 1**: Setup Phase 0 (Infrastructure)
2. **Week 2-3**: Phase 1 (Auth & App Shell)
3. **Week 4**: Phase 2 (Dashboard)
4. **Week 5-17**: Continue ตาม Timeline
5. **Daily**: Update Progress ใน Project Management Tool

---

**สิ้นสุดแผนการพัฒนา Frontend** 🎉
