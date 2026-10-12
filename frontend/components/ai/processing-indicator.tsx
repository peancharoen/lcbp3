// File: components/ai/processing-indicator.tsx
// Loading indicator ระหว่าง AI ประมวลผลเอกสาร (ADR-018, ADR-020)

import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function AiProcessingIndicator() {
  return (
    <Card className="border-warning/30 bg-warning/10">
      <CardContent className="flex items-center space-x-3 p-4">
        <Loader2 className="h-5 w-5 animate-spin text-warning" />
        <div>
          <p className="font-medium text-warning">AI กำลังวิเคราะห์เอกสาร...</p>
          <p className="text-sm text-warning">กรุณารอสักครู่ (ประมาณ 15-30 วินาที)</p>
        </div>
      </CardContent>
    </Card>
  );
}
