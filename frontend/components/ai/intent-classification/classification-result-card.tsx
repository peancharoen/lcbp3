'use client';

// File: components/ai/intent-classification/classification-result-card.tsx
// Change Log
// - 2026-05-19: สร้าง Classification Result Card component (ADR-024).

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { ClassificationResult } from '@/lib/services/ai-intent.service';

interface ClassificationResultCardProps {
  query: string;
  result: ClassificationResult;
}

/** สีของ method badge */
const METHOD_COLORS: Record<string, string> = {
  pattern: 'bg-success/10 text-success border-success/30',
  llm_fallback: 'bg-info/10 text-info border-info/30',
  semaphore_overflow: 'bg-warning/10 text-warning border-warning/30',
  llm_error: 'bg-destructive/10 text-destructive border-destructive/30',
};

/** สีของ confidence bar */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'bg-success';
  if (confidence >= 0.7) return 'bg-info';
  if (confidence >= 0.5) return 'bg-warning';
  return 'bg-destructive';
}

/**
 * Card แสดงผลลัพธ์การจำแนก Intent
 * แสดง intentCode, confidence, method, latency
 */
export function ClassificationResultCard({ query, result }: ClassificationResultCardProps) {
  const confidencePercent = Math.round(result.confidence * 100);

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardContent className="space-y-2 pb-3 pt-4">
        {/* Query */}
        <p className="text-sm font-medium text-muted-foreground">&quot;{query}&quot;</p>

        {/* Intent Code + Method */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-base font-semibold">{result.intentCode}</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={METHOD_COLORS[result.method] || ''}>
              {result.method}
            </Badge>
            <span className="text-xs text-muted-foreground">{result.latencyMs}ms</span>
          </div>
        </div>

        {/* Confidence Bar */}
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${getConfidenceColor(result.confidence)}`}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
          <span className="w-10 text-right font-mono text-xs text-muted-foreground">{confidencePercent}%</span>
        </div>

        {/* Params (ถ้ามี) */}
        {result.params && Object.keys(result.params).length > 0 && (
          <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(result.params, null, 2)}</pre>
        )}
      </CardContent>
    </Card>
  );
}
