// File: app/(admin)/admin/ai/intent-classification/analytics/page.tsx
// Change Log
// - 2026-05-19: สร้างหน้า Analytics Dashboard สำหรับ Intent Classification (T037, US3).

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useIntentAnalytics } from '@/hooks/ai/use-intent-classification';
import { AnalyticsSummaryCards } from '@/components/ai/intent-classification/analytics/analytics-summary-cards';
import { MethodBreakdownTable } from '@/components/ai/intent-classification/analytics/method-breakdown-table';
import { IntentBreakdownTable } from '@/components/ai/intent-classification/analytics/intent-breakdown-table';
import { RecalibrationPanel } from '@/components/ai/intent-classification/analytics/recalibration-panel';

/**
 * หน้า Analytics Dashboard สำหรับ Intent Classification
 * แสดง Summary Cards, Method Breakdown, Intent Breakdown, Recalibration
 */
export default function IntentAnalyticsPage() {
  const { data, isLoading, isError, error } = useIntentAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Intent Classification Analytics</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Intent Classification Analytics</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">
              เกิดข้อผิดพลาด: {error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลได้'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Intent Classification Analytics</h1>
        <p className="text-sm text-muted-foreground">ข้อมูลย้อนหลัง 30 วัน</p>
      </div>

      {/* Summary Cards */}
      <AnalyticsSummaryCards data={data} />

      {/* Method Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Classification Method Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <MethodBreakdownTable data={data.byMethod} />
        </CardContent>
      </Card>

      {/* Intent Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Intent Code Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <IntentBreakdownTable data={data.byIntent} />
        </CardContent>
      </Card>

      {/* Recalibration */}
      <Card>
        <CardHeader>
          <CardTitle>Recalibration Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <RecalibrationPanel data={data.recalibration} />
        </CardContent>
      </Card>
    </div>
  );
}
