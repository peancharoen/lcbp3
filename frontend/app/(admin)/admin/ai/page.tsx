// File: frontend/app/(admin)/admin/ai/page.tsx
// Change Log:
// - 2026-08-02: เปลี่ยนจากหน้าหลักเป็น redirect ไป /admin/ai/system (refactor sub-menu)
// - 2026-06-19: [240] เพิ่มฟีเจอร์ย่อ/ขยายสำหรับกลุ่มการ์ดตรวจติดตามสุขภาพระบบ AI และการ์ดเดี่ยวพร้อมเก็บสถานะใน localStorage

import { redirect } from 'next/navigation';

/**
 * Redirect ไปหน้า System Toggle (default sub-page ของ AI Console)
 */
export default function AiConsolePage() {
  redirect('/admin/ai/system');
}
