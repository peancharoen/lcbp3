"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function TestSidebarPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-muted/10">
          <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Sidebar Menu Test</h1>
            <p className="text-muted-foreground">
              ทดสอบการทำงานของเมนู sidebar ว่าสามารถใช้งานได้จริง
            </p>
            
            <div className="grid gap-4">
              <div className="p-4 border rounded-lg">
                <h2 className="text-xl font-semibold mb-2">รายการเมนูที่ตรวจสอบ:</h2>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Dashboard - ลิงก์ไป /dashboard</li>
                  <li>Correspondences - ลิงก์ไป /correspondences</li>
                  <li>RFAs - ลิงก์ไป /rfas</li>
                  <li>Drawings - ลิงก์ไป /drawings</li>
                  <li>Circulations - ลิงก์ไป /circulation</li>
                  <li>Transmittals - ลิงก์ไป /transmittals</li>
                  <li>Search - ลิงก์ไป /search</li>
                  <li>Admin Panel - ลิงก์ไป /admin (สำหรับ admin/DC เท่านั้น)</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h2 className="text-xl font-semibold mb-2">การทดสอบ:</h2>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>คลิกที่เมนูแต่ละรายการใน sidebar</li>
                  <li>ตรวจสอบว่าลิงก์ทำงานได้ถูกต้อง</li>
                  <li>ตรวจสอบว่าเมนู active state แสดงผลถูกต้อง</li>
                  <li>ทดสอบการสลับ collapse/expand sidebar</li>
                  <li>ทดสอบ responsive menu บนมือถือ</li>
                </ol>
              </div>
              
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ Sidebar component โหลดสำเร็จแล้ว - สามารถทดสอบการทำงานได้
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
