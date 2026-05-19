// File: components/ai/intent-classification/analytics/recalibration-panel.tsx
// Change Log
// - 2026-05-19: สร้าง Recalibration Panel สำหรับ Analytics Dashboard (T036, US3).

'use client';

import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RecalibrationRecommendation } from '@/lib/services/ai-intent.service';

interface RecalibrationPanelProps {
  data: RecalibrationRecommendation[];
}

/**
 * แสดงคำแนะนำ Intent ที่ควรเพิ่ม pattern เพื่อลด LLM Calls
 * ตาม SC-001: เป้าหมาย Pattern Hit Rate 70-80%
 */
export function RecalibrationPanel({ data }: RecalibrationPanelProps) {
  if (data.length === 0) {
    return (
      <Alert>
        <AlertTitle>ไม่มีคำแนะนำ</AlertTitle>
        <AlertDescription>
          ยังไม่มี Intent ที่ต้องเพิ่ม Pattern — Pattern Hit Rate อยู่ในระดับดี
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>ควรเพิ่ม Pattern</AlertTitle>
        <AlertDescription>
          Intent ด้านล่างถูก classify ด้วย LLM บ่อย — การเพิ่ม keyword/regex pattern
          จะช่วยลดภาระ LLM และเพิ่มความเร็ว
        </AlertDescription>
      </Alert>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Intent Code</TableHead>
            <TableHead className="text-right">LLM Calls</TableHead>
            <TableHead className="text-right">Avg Confidence</TableHead>
            <TableHead className="text-right">Priority</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.intentCode}>
              <TableCell className="font-mono text-sm">
                {row.intentCode}
              </TableCell>
              <TableCell className="text-right">{row.llmCallCount}</TableCell>
              <TableCell className="text-right">
                {row.avgConfidence.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-medium text-amber-600">
                {row.priority}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
