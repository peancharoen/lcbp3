'use client';

// File: app/(admin)/admin/ai/intent-classification/test-console/page.tsx
// Change Log
// - 2026-05-19: สร้างหน้า Test Console สำหรับทดสอบ Intent Classification (ADR-024).

import { useRouter } from 'next/navigation';
import { TestConsolePanel } from '@/components/ai/intent-classification/test-console-panel';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TestConsolePage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/ai/intent-classification')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Intent Test Console</h1>
          <p className="text-muted-foreground">
            ทดสอบ Intent Classification แบบ Real-time — พิมพ์คำถามเพื่อดูผล
          </p>
        </div>
      </div>

      {/* Test Console */}
      <TestConsolePanel />
    </div>
  );
}
