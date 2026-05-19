// File: components/ai/intent-classification/analytics/method-breakdown-table.tsx
// Change Log
// - 2026-05-19: สร้าง Method Breakdown Table สำหรับ Analytics Dashboard (T036, US3).

'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { MethodStats } from '@/lib/services/ai-intent.service';

interface MethodBreakdownTableProps {
  data: MethodStats[];
}

/** แปลงชื่อ method เป็น label + สี */
function methodBadge(method: string) {
  switch (method) {
    case 'pattern':
      return <Badge variant="default">Pattern Match</Badge>;
    case 'llm_fallback':
      return <Badge variant="secondary">LLM Fallback</Badge>;
    case 'semaphore_overflow':
      return <Badge variant="destructive">Semaphore Overflow</Badge>;
    case 'llm_error':
      return <Badge variant="destructive">LLM Error</Badge>;
    default:
      return <Badge variant="outline">{method}</Badge>;
  }
}

/**
 * ตารางแสดงสถิติแยกตาม method (pattern, llm_fallback, etc.)
 */
export function MethodBreakdownTable({ data }: MethodBreakdownTableProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>;
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Count</TableHead>
          <TableHead className="text-right">%</TableHead>
          <TableHead className="text-right">Avg Confidence</TableHead>
          <TableHead className="text-right">Avg Latency</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.method}>
            <TableCell>{methodBadge(row.method)}</TableCell>
            <TableCell className="text-right">{row.count}</TableCell>
            <TableCell className="text-right">
              {total > 0 ? ((row.count / total) * 100).toFixed(1) : 0}%
            </TableCell>
            <TableCell className="text-right">
              {row.avgConfidence.toFixed(2)}
            </TableCell>
            <TableCell className="text-right">
              {row.avgLatencyMs.toFixed(1)}ms
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
