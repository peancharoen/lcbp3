// File: frontend/app/(admin)/admin/ai/prompts/page.tsx
// Change Log:
// - 2026-08-02: แยก Prompt Editor ออกจาก AI Console page หลัก
// - 2026-09-01: Redirect 308 ไปยังหน้า prompt-management แบบ unified (Feature 251)

import { redirect } from 'next/navigation';

/**
 * หน้า Prompt Editor เก่า — redirect 308 ไป /admin/ai/prompt-management
 */
export default function PromptsPage(): never {
  redirect('/admin/ai/prompt-management');
}
