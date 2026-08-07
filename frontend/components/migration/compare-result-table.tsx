// File: components/migration/compare-result-table.tsx
// Change Log:
// - 2026-08-06: Initial creation — compare result table with per-field source selector (Feature 242, FR-011, FR-011c, FR-012c)

'use client';

import React from 'react';
import { CompareResult, CompareFieldResult, FieldResolution } from '@/types/migration';
import { CompareStatus } from '@/types/migration';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, AlertCircle, FileX2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** ป้ายชื่อช่องภาษาไทยสำหรับแสดงในตาราง */
const FIELD_LABELS: Record<string, string> = {
  documentNumber: 'เลขที่เอกสาร',
  subject: 'ชื่อเรื่อง',
  documentDate: 'วันที่เอกสาร',
  fromOrganization: 'หน่วยงานผู้ส่ง',
  toOrganization: 'หน่วยงานผู้รับ',
  correspondenceType: 'ประเภทเอกสาร',
  discipline: 'สาขางาน',
  project: 'โครงการ',
  revision: 'ฉบับแก้ไข',
};

interface CompareResultTableProps {
  compareStatus: CompareStatus;
  compareResult?: CompareResult;
  compareUnavailableReason?: string;
  /** ค่า threshold ที่จับภาพไว้ ณ เวลาประมวลผล (FR-010c) */
  capturedThresholds?: { maxMismatchFields: number; minConfidence: number };
  /** ค่าที่ผู้ตรวจสอบเลือก ณ ปัจจุบัน (controlled) */
  fieldResolutions?: FieldResolution[];
  /** callback เมื่อผู้ตรวจสอบเปลี่ยนแหล่งค่าของช่อง (FR-011b) */
  onFieldResolutionChange?: (resolutions: FieldResolution[]) => void;
}

/**
 * ตารางแสดงผลการเปรียบเทียบทะเบียนกับเอกสารจริง (FR-007, FR-011, FR-012c)
 * ผู้ตรวจสอบสามารถเลือกแหล่งค่าของแต่ละช่องได้: EXCEL, DOCUMENT, MANUAL
 */
export function CompareResultTable({
  compareStatus,
  compareResult,
  compareUnavailableReason,
  capturedThresholds,
  fieldResolutions,
  onFieldResolutionChange,
}: CompareResultTableProps) {
  // FR-012a: ถ้า compareStatus = UNAVAILABLE ให้แสดงแจ้งเตือนแทนตาราง
  if (compareStatus === CompareStatus.UNAVAILABLE) {
    return (
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-orange-600">
            <FileX2 className="h-5 w-5" />
            ไม่สามารถเปรียบเทียบได้
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {compareUnavailableReason || 'ไม่สามารถเปรียบเทียบทะเบียนกับเอกสารจริงได้'}
          </p>
        </CardContent>
      </Card>
    );
  }
  if (!compareResult) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          ไม่มีข้อมูลการเปรียบเทียบ
        </CardContent>
      </Card>
    );
  }
  const mismatchCount = compareResult.mismatches.length;
  const isOverThreshold = capturedThresholds
    ? mismatchCount > capturedThresholds.maxMismatchFields
    : false;
  const isLowConfidence = capturedThresholds
    ? compareResult.confidence < capturedThresholds.minConfidence
    : false;
  const handleSourceChange = (field: string, source: 'EXCEL' | 'DOCUMENT' | 'MANUAL', finalValue: string) => {
    if (!onFieldResolutionChange) return;
    const existing = fieldResolutions ?? [];
    const filtered = existing.filter((r) => r.field !== field);
    onFieldResolutionChange([...filtered, { field, source, finalValue }]);
  };
  return (
    <Card className="border-muted shadow-sm">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold">ผลการเปรียบเทียบทะเบียนกับเอกสาร</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={mismatchCount === 0 ? 'default' : isOverThreshold ? 'destructive' : 'secondary'}>
              {mismatchCount === 0
                ? 'ตรงทั้งหมด'
                : `ไม่ตรง ${mismatchCount} ช่อง`}
            </Badge>
            {capturedThresholds && (
              <span className="text-xs text-muted-foreground font-mono">
                ขั้นต่ำ {capturedThresholds.maxMismatchFields} ช่อง
              </span>
            )}
          </div>
        </div>
        {isOverThreshold && (
          <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>จำนวนช่องที่ไม่ตรงเกินขีดจำกัด — ต้องตรวจสอบด้วยมือ</span>
          </div>
        )}
        {isLowConfidence && (
          <div className="flex items-center gap-2 mt-1 text-xs text-orange-600">
            <AlertCircle className="h-4 w-4" />
            <span>ค่าความมั่นใจต่ำกว่าขั้นต่ำ — ต้องตรวจสอบด้วยมือ</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">ช่องข้อมูล</th>
                <th className="py-2 pr-4 font-semibold">ทะเบียน (Excel)</th>
                <th className="py-2 pr-4 font-semibold">เอกสารจริง (OCR)</th>
                <th className="py-2 pr-4 font-semibold text-center">ผล</th>
                <th className="py-2 pr-4 font-semibold text-center">ใช้ค่าจาก</th>
              </tr>
            </thead>
            <tbody>
              {compareResult.fieldResults.map((fr) => (
                <CompareFieldRow
                  key={fr.field}
                  fieldResult={fr}
                  resolution={fieldResolutions?.find((r) => r.field === fr.field)}
                  onSourceChange={handleSourceChange}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>ค่าความมั่นใจ: <span className="font-mono font-semibold">{(compareResult.confidence * 100).toFixed(0)}%</span></span>
          {capturedThresholds && (
            <span>ขั้นต่ำ: <span className="font-mono">{(capturedThresholds.minConfidence * 100).toFixed(0)}%</span></span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** แถวแสดงผลการเปรียบเทียบรายช่อง */
function CompareFieldRow({
  fieldResult,
  resolution,
  onSourceChange,
}: {
  fieldResult: CompareFieldResult;
  resolution?: FieldResolution;
  onSourceChange: (field: string, source: 'EXCEL' | 'DOCUMENT' | 'MANUAL', finalValue: string) => void;
}) {
  const label = FIELD_LABELS[fieldResult.field] ?? fieldResult.field;
  const currentSource = resolution?.source ?? 'EXCEL';
  const currentValue = resolution?.finalValue ?? fieldResult.excelValue ?? '';
  const handleRadioChange = (source: 'EXCEL' | 'DOCUMENT' | 'MANUAL') => {
    let value = currentValue;
    if (source === 'EXCEL') value = fieldResult.excelValue ?? '';
    else if (source === 'DOCUMENT') value = fieldResult.ocrValue ?? '';
    onSourceChange(fieldResult.field, source, value);
  };
  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="py-2 pr-4 font-medium">{label}</td>
      <td className="py-2 pr-4 text-muted-foreground">{fieldResult.excelValue ?? '—'}</td>
      <td className="py-2 pr-4 text-muted-foreground">
        {fieldResult.foundInDocument ? (fieldResult.ocrValue ?? '—') : (
          <span className="italic text-orange-600">ไม่พบในเอกสาร</span>
        )}
      </td>
      <td className="py-2 pr-4 text-center">
        {fieldResult.match ? (
          <CheckCircle2 className="inline h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="inline h-4 w-4 text-red-500" />
        )}
      </td>
      <td className="py-2 pr-4 text-center">
        <div className="inline-flex items-center gap-1">
          <label className={cn('text-xs cursor-pointer', currentSource === 'EXCEL' && 'font-bold text-blue-600')}>
            <input
              type="radio"
              name={`source-${fieldResult.field}`}
              value="EXCEL"
              checked={currentSource === 'EXCEL'}
              onChange={() => handleRadioChange('EXCEL')}
              className="sr-only"
            />
            ทะเบียน
          </label>
          {fieldResult.foundInDocument && (
            <>
              <span className="text-muted-foreground">|</span>
              <label className={cn('text-xs cursor-pointer', currentSource === 'DOCUMENT' && 'font-bold text-green-600')}>
                <input
                  type="radio"
                  name={`source-${fieldResult.field}`}
                  value="DOCUMENT"
                  checked={currentSource === 'DOCUMENT'}
                  onChange={() => handleRadioChange('DOCUMENT')}
                  className="sr-only"
                />
                เอกสาร
              </label>
            </>
          )}
          <span className="text-muted-foreground">|</span>
          <label className={cn('text-xs cursor-pointer', currentSource === 'MANUAL' && 'font-bold text-purple-600')}>
            <input
              type="radio"
              name={`source-${fieldResult.field}`}
              value="MANUAL"
              checked={currentSource === 'MANUAL'}
              onChange={() => handleRadioChange('MANUAL')}
              className="sr-only"
            />
            พิมพ์เอง
          </label>
        </div>
      </td>
    </tr>
  );
}
