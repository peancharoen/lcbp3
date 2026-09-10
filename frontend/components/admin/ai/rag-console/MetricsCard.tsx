// File: frontend/components/admin/ai/rag-console/MetricsCard.tsx
// Change Log:
// - 2026-09-10: T048 — สร้าง MetricsCard component สำหรับ Feature 255

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Props สำหรับ MetricsCard */
export interface MetricsCardProps {
  /** ชื่อ metric (i18n key ภายใต้ rag.admin.metrics.cards.*) */
  titleKey: string;
  /** ค่าหลักที่จะแสดง */
  value: string | number;
  /** รายละเอียดเพิ่มเติม (optional) */
  details?: Array<{ label: string; value: string | number }>;
}

/** Reusable metric card component สำหรับ Metrics tab */
export function MetricsCard({ titleKey, value, details }: MetricsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{titleKey}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {details && details.length > 0 && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {details.map((d, i) => (
              <div key={i} className="flex justify-between">
                <span>{d.label}:</span>
                <span>{d.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
