// File: frontend/app/(dashboard)/migration/review/_components/batch-run-summary.tsx
// Change Log:
// - 2026-08-06: Initial creation — batch run summary component (Feature 242, FR-026b, T056)

'use client';

import React from 'react';
import { CheckCircle2, XCircle, SkipForward, AlertCircle, FileText, Tags } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** ผลลัพธ์ batch run (FR-026b, FR-020) */
export interface BatchRunSummaryData {
  batchId: string | null;
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
  tagsCreated?: number;
  tagsLinked?: number;
  startedAt?: string;
  completedAt?: string;
  failures?: Array<{
    correspondencePublicId: string;
    field: string;
    unresolvedValue: string;
    reason: string;
  }>;
  skipBreakdown?: {
    noTextLayer: number;
    emptyOcrText: number;
    alreadyEmbedded: number;
  };
  warning?: string;
}

interface BatchRunSummaryProps {
  result: BatchRunSummaryData;
  variant?: 'resolve' | 'rag';
  className?: string;
}

/**
 * แสดงสรุปผลลัพธ์ batch run — success/skip/fail counts (FR-026b, FR-020)
 * รองรับทั้ง resolve-batch และ trigger-rag-batch
 */
export function BatchRunSummary({ result, variant = 'resolve', className }: BatchRunSummaryProps) {
  const isRag = variant === 'rag';
  const hasFailures = result.failures && result.failures.length > 0;
  const durationMs =
    result.startedAt && result.completedAt
      ? new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()
      : undefined;

  return (
    <Card className={cn('border-muted shadow-sm', className)}>
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            {isRag ? <FileText className="h-5 w-5 text-info" /> : <Tags className="h-5 w-5 text-ai" />}
            {isRag ? 'สรุปการ RAG Batch' : 'สรุปการ Resolve Batch'}
          </CardTitle>
          {result.batchId && (
            <Badge variant="outline" className="font-mono text-xs">
              {result.batchId}
            </Badge>
          )}
        </div>
        {result.warning && (
          <div className="mt-2 flex items-center gap-2 rounded bg-caution/5 p-2 text-xs text-caution">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              {result.warning === 'IMPORT_IN_PROGRESS'
                ? 'มีการ import ที่กำลังดำเนินการ — แนะนำให้รอ import เสร็จก่อน'
                : result.warning}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryStat
            label="ทั้งหมด"
            value={result.total}
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            color="text-foreground"
          />
          <SummaryStat
            label="สำเร็จ"
            value={result.succeeded}
            icon={<CheckCircle2 className="h-4 w-4 text-success" />}
            color="text-success"
          />
          <SummaryStat
            label="ข้าม"
            value={result.skipped}
            icon={<SkipForward className="h-4 w-4 text-warning" />}
            color="text-warning"
          />
          <SummaryStat
            label="ล้มเหลว"
            value={result.failed}
            icon={<XCircle className="h-4 w-4 text-destructive" />}
            color="text-destructive"
          />
        </div>

        {/* Skip breakdown สำหรับ RAG batch */}
        {isRag && result.skipBreakdown && (
          <div className="mt-4 border-t pt-3">
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">สาเหตุการข้าม</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                ไม่มี text layer: {result.skipBreakdown.noTextLayer}
              </Badge>
              <Badge variant="outline" className="text-xs">
                ไม่มี OCR text: {result.skipBreakdown.emptyOcrText}
              </Badge>
              <Badge variant="outline" className="text-xs">
                embedded แล้ว: {result.skipBreakdown.alreadyEmbedded}
              </Badge>
            </div>
          </div>
        )}

        {/* Tags summary สำหรับ resolve batch */}
        {!isRag && (result.tagsCreated || result.tagsLinked) && (
          <div className="mt-4 border-t pt-3">
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">
                แท็กที่สร้าง: <span className="font-semibold text-foreground">{result.tagsCreated ?? 0}</span>
              </span>
              <span className="text-muted-foreground">
                แท็กที่เชื่อม: <span className="font-semibold text-foreground">{result.tagsLinked ?? 0}</span>
              </span>
            </div>
          </div>
        )}

        {/* Duration */}
        {durationMs !== undefined && (
          <div className="mt-3 font-mono text-xs text-muted-foreground">ใช้เวลา: {durationMs}ms</div>
        )}

        {/* Failures detail */}
        {hasFailures && (
          <div className="mt-4 border-t pt-3">
            <h4 className="mb-2 text-xs font-semibold text-destructive">
              รายการที่ล้มเหลว ({result.failures!.length} รายการ)
            </h4>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {result.failures!.map((f, i) => (
                <div key={i} className="rounded border border-destructive/20 bg-destructive/5 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {f.correspondencePublicId.substring(0, 8)}...
                    </Badge>
                    <span className="font-medium">{f.field}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    ค่า: <span className="font-mono">{f.unresolvedValue}</span>
                  </div>
                  <div className="text-muted-foreground">{f.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** สถิติย่อยใน summary */
function SummaryStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md bg-muted/30 p-3">
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className={cn('font-mono text-2xl font-black', color)}>{value}</span>
    </div>
  );
}
