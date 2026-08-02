// File: frontend/app/(admin)/admin/ai/sandbox/page.tsx
// Change Log:
// - 2026-08-02: แยก Sandbox Testing ออกจาก AI Console page หลัก

'use client';

import SandboxTabs from '@/components/admin/ai/SandboxTabs';

/**
 * หน้า Sandbox Testing — ทดสอบ 3-Step Pipeline (OCR → AI Extract → RAG Prep)
 * และ Full Pipeline (ADR-042) ผ่าน Sandbox Project
 */
export default function SandboxPage() {
  return (
    <div className="space-y-6">
      <SandboxTabs />
    </div>
  );
}
