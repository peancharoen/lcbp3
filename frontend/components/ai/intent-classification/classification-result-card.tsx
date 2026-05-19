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
  pattern: 'bg-green-100 text-green-800 border-green-200',
  llm_fallback: 'bg-blue-100 text-blue-800 border-blue-200',
  semaphore_overflow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  llm_error: 'bg-red-100 text-red-800 border-red-200',
};

/** สีของ confidence bar */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'bg-green-500';
  if (confidence >= 0.7) return 'bg-blue-500';
  if (confidence >= 0.5) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * Card แสดงผลลัพธ์การจำแนก Intent
 * แสดง intentCode, confidence, method, latency
 */
export function ClassificationResultCard({
  query,
  result,
}: ClassificationResultCardProps) {
  const confidencePercent = Math.round(result.confidence * 100);

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardContent className="pt-4 pb-3 space-y-2">
        {/* Query */}
        <p className="text-sm font-medium text-muted-foreground">
          &quot;{query}&quot;
        </p>

        {/* Intent Code + Method */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-base font-semibold">
            {result.intentCode}
          </span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={METHOD_COLORS[result.method] || ''}
            >
              {result.method}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {result.latencyMs}ms
            </span>
          </div>
        </div>

        {/* Confidence Bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getConfidenceColor(result.confidence)}`}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground w-10 text-right">
            {confidencePercent}%
          </span>
        </div>

        {/* Params (ถ้ามี) */}
        {result.params && Object.keys(result.params).length > 0 && (
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(result.params, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
