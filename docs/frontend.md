
xxx npx shadcn@latest init

✔ npx shadcn@latest init

✔ Would you like to use TypeScript (recommended)? Yes 
✔ Which style would you like to use? Default 
✔ Which base color would you like to use? Slate 
✔ Where is your global CSS file? src/app/globals.css 
✔ Would you like to use CSS variables...? Yes 
✔ Where is your tailwind.config.ts...? tailwind.config.ts 
✔ Configure the import alias for components: @/components 
✔ Configure the import alias for utils: @/lib/utils 
✔ Are you using React Server Components? Yes

npm install @tanstack/react-query zustand react-hook-form zod axios

npm install msw --save-dev

LCBP3 DMS V1.2.0
Custom Gem
รับทราบครับ เราจะไปขั้นตอนต่อไป คือการสร้าง App Shell Layout (โครงสร้างหน้าเว็บหลัก) ตามข้อกำหนด 5.1

เราจะสร้าง 3 ส่วนหลัก:

Sidebar (เมนูด้านข้าง)

Navbar/Header (แถบด้านบน)

Main Content Area (พื้นที่เนื้อหา)

2.1 ติดตั้ง Icons
npm install lucide-react

3.1 ติดตั้ง Shadcn Components ที่จำเป็น
npx shadcn@latest add card
npx shadcn@latest add table
npx shadcn@latest add button
npx shadcn@latest

4.1 ตั้งค่า React Query (TanStack Query) Provider
npm install @tanstack/react-query-devtools

4.2 ตั้งค่า Mock Service Worker (MSW)
npx msw init public/ --save

4.4 อัปเดต MyTasksTable (ให้เรียก API จริง)
npm install axios

5.1 ติดตั้ง Shadcn Components
npx shadcn@latest add badge


5.4 (ตัวอย่าง) การนำไปใช้ในหน้า RFA
เรายังไม่ได้สร้างหน้า /rfa/[id]/page.tsx แต่เมื่อสร้างเสร็จ เราจะเรียกใช้ Component นี้โดยส่ง props ไป:

// src/app/rfa/[id]/page.tsx (ตัวอย่างในอนาคต)

// import { mockWorkflow } from "@/mocks/data/mock-workflow";
// import { WorkflowVisualizer } from "@/components/workflow/workflow-visualizer";

// export default function RfaDetailPage({ params }: { params: { id: string } }) {
//   // 1. (ในอนาคต) ดึงข้อมูล RFA และ Workflow steps จาก API
//   // const { data: rfaData } = useQuery(...);
//   // const steps = rfaData.workflowSteps;
   
//   // 2. (ในอนาคต) ดึงสิทธิ์ผู้ใช้จาก Zustand (Global State)
//   // const { user } = useAuthStore();
//   // const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

//   // 3. ส่ง Props ไปยัง Component
//   return (
//     <div>
//       {/* (แสดงรายละเอียด RFA ที่นี่) */}
      
//       <WorkflowVisualizer 
//         steps={mockWorkflow} // (ใช้ rfaData.workflowSteps จริง)
//         isAdmin={true}       // (ใช้ isAdmin จริง)
//       />
//     </div>
//   );
// }

6.1 ติดตั้ง Shadcn Components ที่จำเป็น
npx shadcn@latest add avatar
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add dropdown-menu
npx shadcn@latest add checkbox
npx shadcn@latest add pagination

x 6.2 อัปเดต Mock API (MSW) x