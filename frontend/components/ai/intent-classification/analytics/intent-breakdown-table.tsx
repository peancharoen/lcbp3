// File: components/ai/intent-classification/analytics/intent-breakdown-table.tsx
// Change Log
// - 2026-05-19: สร้าง Intent Breakdown Table สำหรับ Analytics Dashboard (T036, US3).

'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import type { IntentStats } from '@/lib/services/ai-intent.service';

interface IntentBreakdownTableProps {
  data: IntentStats[];
}

/**
 * ตารางแสดงสถิติแยกตาม intent code พร้อม bar แสดง pattern vs llm
 */
export function IntentBreakdownTable({ data }: IntentBreakdownTableProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Intent Code</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Pattern</TableHead>
          <TableHead className="text-right">LLM</TableHead>
          <TableHead className="text-right">Avg Confidence</TableHead>
          <TableHead className="w-[120px]">Pattern Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          const patternRate =
            row.count > 0 ? (row.patternHits / row.count) * 100 : 0;
          return (
            <TableRow key={row.intentCode}>
              <TableCell className="font-mono text-sm">
                {row.intentCode}
              </TableCell>
              <TableCell className="text-right">{row.count}</TableCell>
              <TableCell className="text-right">{row.patternHits}</TableCell>
              <TableCell className="text-right">{row.llmHits}</TableCell>
              <TableCell className="text-right">
                {row.avgConfidence.toFixed(2)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={patternRate} className="h-2" />
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {patternRate.toFixed(0)}%
                  </span>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
