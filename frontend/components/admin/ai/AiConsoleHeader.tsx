// File: frontend/components/admin/ai/AiConsoleHeader.tsx
// Change Log:
// - 2026-08-02: แยก header ออกจาก AI Console page เพื่อใช้ใน layout ร่วมกับ sub-pages

'use client';

import { Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAiStatus } from '@/hooks/use-ai-status';

/**
 * Header ของ AI Console แสดงชื่อหน้าและสถานะเปิด/ปิด AI
 */
export function AiConsoleHeader() {
  const { data, isLoading } = useAiStatus();
  const aiEnabled = data?.aiFeaturesEnabled ?? false;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Brain className="h-6 w-6" />
          AI Console
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">ควบคุมและตรวจสอบระบบ AI สำหรับ Superadmin</p>
      </div>
      <Badge variant={aiEnabled ? 'default' : 'destructive'} className="w-fit">
        {isLoading ? 'Loading...' : aiEnabled ? 'AI Enabled' : 'AI Disabled'}
      </Badge>
    </div>
  );
}
