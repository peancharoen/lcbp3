// File: frontend/app/(admin)/admin/ai/layout.tsx
// Change Log:
// - 2026-08-02: สร้าง layout สำหรับ AI Console sub-pages พร้อม shared header + monitoring

import { AiConsoleHeader } from '@/components/admin/ai/AiConsoleHeader';
import { AiInfrastructureMonitoring } from '@/components/admin/ai/AiInfrastructureMonitoring';

/**
 * Layout สำหรับ AI Console — แสดง header และ Infrastructure Monitoring
 * คงอยู่ในทุก sub-page (system, rag-playground, prompts, sandbox)
 */
export default function AiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <AiConsoleHeader />
      <AiInfrastructureMonitoring />
      {children}
    </div>
  );
}
