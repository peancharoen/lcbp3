// File: components/ai/intent-classification/analytics/analytics-summary-cards.tsx
// Change Log
// - 2026-05-19: สร้าง Summary Cards สำหรับ Analytics Dashboard (T036, US3).

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClassificationAnalytics } from '@/lib/services/ai-intent.service';

interface AnalyticsSummaryCardsProps {
  data: ClassificationAnalytics;
}

/**
 * แสดงสรุปสถิติหลักในรูปแบบ Cards
 * Total Requests, Pattern Hit Rate, Avg Confidence, Avg Latency
 */
export function AnalyticsSummaryCards({ data }: AnalyticsSummaryCardsProps) {
  const cards = [
    {
      title: 'Total Requests',
      value: data.totalRequests.toLocaleString(),
      subtitle: `${data.successCount} สำเร็จ / ${data.failedCount} ล้มเหลว`,
      color: 'text-blue-600',
    },
    {
      title: 'Pattern Hit Rate',
      value: `${data.patternHitRate}%`,
      subtitle: 'เป้าหมาย: 70-80%',
      color: data.patternHitRate >= 70 ? 'text-green-600' : 'text-amber-600',
    },
    {
      title: 'Avg Confidence',
      value: data.avgConfidence.toFixed(2),
      subtitle: 'เป้าหมาย: ≥ 0.70',
      color: data.avgConfidence >= 0.7 ? 'text-green-600' : 'text-amber-600',
    },
    {
      title: 'Avg Latency',
      value: `${data.avgLatencyMs.toFixed(1)}ms`,
      subtitle: 'Pattern < 10ms, LLM < 2000ms',
      color: data.avgLatencyMs < 100 ? 'text-green-600' : 'text-amber-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.subtitle}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
