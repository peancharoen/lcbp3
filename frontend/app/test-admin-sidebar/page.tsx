"use client";

import { AdminSidebar } from "@/components/admin/sidebar";

export default function TestAdminSidebarPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 p-6">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">Admin Sidebar Test</h1>
          <p className="text-muted-foreground">
            ทดสอบการทำงานของเมนู admin sidebar
          </p>
          
          <div className="grid gap-4">
            <div className="p-4 border rounded-lg">
              <h2 className="text-xl font-semibold mb-2">รายการเมนู Admin:</h2>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Access Control - Users, Roles, Organizations</li>
                <li>Document Control - Projects, Contracts, Numbering, Reference Data, Workflows</li>
                <li>Drawing Master - Contract/Shop Categories</li>
                <li>Monitoring - Audit Logs, System Logs, Sessions</li>
                <li>Migration - Review Queue, Error Logs</li>
                <li>Settings</li>
              </ul>
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                ℹ️ Admin sidebar มีเมนูแบบ collapsible สำหรับแต่ละหมวดหมู่
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
