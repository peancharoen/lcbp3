// File: frontend/app/(admin)/admin/ai/prompts/page.tsx
// Change Log:
// - 2026-08-02: แยก Prompt Editor ออกจาก AI Console page หลัก

'use client';

import { PromptManagementTabs } from '@/components/admin/ai/PromptManagementTabs';

/**
 * หน้า Prompt Editor — จัดการ OCR System Prompt และ AI Extraction Prompt
 */
export default function PromptsPage() {
  return (
    <div className="space-y-6">
      <PromptManagementTabs />
    </div>
  );
}
