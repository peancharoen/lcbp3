// File: components/ai/processing-indicator.tsx
// Loading indicator ระหว่าง AI ประมวลผลเอกสาร (ADR-018, ADR-020)

import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function AiProcessingIndicator() {
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="flex items-center space-x-3 p-4">
        <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
        <div>
          <p className="font-medium text-yellow-800">AI กำลังวิเคราะห์เอกสาร...</p>
          <p className="text-sm text-yellow-600">กรุณารอสักครู่ (ประมาณ 15-30 วินาที)</p>
        </div>
      </CardContent>
    </Card>
  );
}
