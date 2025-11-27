// File: app/(dashboard)/dashboard/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header Section */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
      </div>
      
      {/* KPI Cards Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              เอกสารรออนุมัติ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              +2 จากเมื่อวาน
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              RFAs ที่กำลังดำเนินการ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">
              อยู่ในขั้นตอนตรวจสอบ
            </p>
          </CardContent>
        </Card>
        
        {/* Add more KPI cards as needed */}
      </div>

      {/* Main Content Section (My Tasks + Recent Activity) */}
      <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
        
        {/* Content Area หลัก (My Tasks) กินพื้นที่ 2 ส่วน */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>งานของฉัน (My Tasks)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full rounded bg-muted/20 flex items-center justify-center text-muted-foreground">
              Table Placeholder (My Tasks)
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity กินพื้นที่ 1 ส่วนด้านขวา */}
        <RecentActivity />
        
      </div>
    </div>
  );
}