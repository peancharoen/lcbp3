// File: app/(admin)/admin/import-review/page.tsx
// Change Log:
// - 2026-09-09: Initial creation — frontend UI for 4-Layer Excel Data Review
//   Pipeline (Feature 252, ADR-052, T028-T031). Spec/tasks.md only ever
//   defined backend work (T001-T027); this page + menu entry closes the
//   scope gap so Document Controllers/Admins can actually reach the feature.
//   US1 (check/review dashboard), US2 (download annotated), US3 (Migration
//   Staging mode gated to Admin), US4 (confirm/cancel).
// - 2026-09-09: Add post-confirm result panel (US3, D6) — ConfirmReviewResponse
//   carries failedRowsDownloadUrl for quarantined rows in MIGRATION_STAGING,
//   but it was previously discarded; users had no way to retrieve
//   failed_rows.xlsx after confirming. Also add "เริ่มรายการใหม่" reset action.

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DownloadIcon, UploadIcon, XIcon, CheckIcon } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useProjectStore } from '@/lib/stores/project-store';
import { useCheckImportReview, useConfirmImportReview, useCancelImportReview } from '@/hooks/use-import-review';
import { importReviewService } from '@/lib/services/import-review.service';
import {
  AiReviewerProvider,
  BatchStrategy,
  CheckReviewResponse,
  ConfirmReviewResponse,
  ReviewTargetMode,
} from '@/types/import-review';

const FINDING_BADGE_VARIANT: Record<string, 'destructive' | 'secondary' | 'default'> = {
  BLOCK: 'destructive',
  WARN: 'secondary',
  AI_SUGGEST: 'default',
};

export default function ImportReviewPage() {
  const { hasPermission, hasRole } = useAuthStore();
  const { selectedProjectId } = useProjectStore();

  const isAdmin = hasRole('Admin') || hasRole('ADMIN') || hasRole('admin');
  const canAccess = hasPermission('correspondence.import_review');

  const [file, setFile] = useState<File | null>(null);
  const [targetMode, setTargetMode] = useState<ReviewTargetMode>('DIRECT_IMPORT');
  const [aiProvider, setAiProvider] = useState<AiReviewerProvider>('LOCAL_OLLAMA');
  const [batchStrategy, setBatchStrategy] = useState<BatchStrategy>('FULL');
  const [result, setResult] = useState<CheckReviewResponse | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmReviewResponse | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingFailedRows, setIsDownloadingFailedRows] = useState(false);

  const checkMutation = useCheckImportReview();
  const confirmMutation = useConfirmImportReview();
  const cancelMutation = useCancelImportReview();

  if (!canAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-muted-foreground">
            ไม่มีสิทธิ์เข้าถึงหน้านี้ — ต้องมีสิทธิ์ <code>correspondence.import_review</code>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleUpload = () => {
    if (!file || !selectedProjectId) return;
    checkMutation.mutate(
      { projectPublicId: selectedProjectId, targetMode, aiProvider, batchStrategy, file },
      { onSuccess: (data) => setResult(data) }
    );
  };

  const handleDownloadAnnotated = async () => {
    if (!result) return;
    setIsDownloading(true);
    try {
      await importReviewService.downloadAnnotated(result.reviewSessionPublicId);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConfirm = () => {
    if (!result) return;
    confirmMutation.mutate(result.reviewSessionPublicId, {
      onSuccess: (data) => {
        setResult(null);
        setConfirmResult(data);
      },
    });
  };

  const handleCancel = () => {
    if (!result) return;
    cancelMutation.mutate(result.reviewSessionPublicId, {
      onSuccess: () => setResult(null),
    });
  };

  const handleDownloadFailedRows = async () => {
    if (!confirmResult) return;
    setIsDownloadingFailedRows(true);
    try {
      await importReviewService.downloadFailedRows(confirmResult.reviewSessionPublicId);
    } finally {
      setIsDownloadingFailedRows(false);
    }
  };

  const handleStartNew = () => {
    setFile(null);
    setResult(null);
    setConfirmResult(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตรวจสอบข้อมูลนำเข้า Excel</h1>
        <p className="text-sm text-muted-foreground">
          ด่านตรวจข้อมูล 4 ชั้น (Schema → Business Rules → AI Reviewer → Confirmation) — ADR-052
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. อัปโหลดไฟล์</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedProjectId && (
            <p className="text-sm text-destructive">กรุณาเลือกโครงการก่อน (มุมบนของหน้าจอ)</p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="import-review-file">ไฟล์ (.xlsx หรือ .zip)</Label>
              <Input
                id="import-review-file"
                type="file"
                accept=".xlsx,.zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>โหมดปลายทาง</Label>
              <Select
                value={targetMode}
                onValueChange={(v) => setTargetMode(v as ReviewTargetMode)}
                disabled={!isAdmin && targetMode === 'MIGRATION_STAGING'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECT_IMPORT">Direct Import (นำเข้าประจำวัน)</SelectItem>
                  {isAdmin && (
                    <SelectItem value="MIGRATION_STAGING">Migration Staging (Admin เท่านั้น)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>AI Reviewer</Label>
              <Select value={aiProvider} onValueChange={(v) => setAiProvider(v as AiReviewerProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOCAL_OLLAMA">Local Ollama (Default)</SelectItem>
                  {isAdmin && <SelectItem value="GEMINI">Google Gemini (Admin เท่านั้น)</SelectItem>}
                  {isAdmin && <SelectItem value="CLAUDE">Anthropic Claude (Admin เท่านั้น)</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={batchStrategy} onValueChange={(v) => setBatchStrategy(v as BatchStrategy)}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL">Full Review (≤200 แถว)</SelectItem>
                <SelectItem value="FAST_SELECTIVE">Fast Selective (WARN + สุ่ม 5%, &gt;200 แถว)</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleUpload}
              disabled={!file || !selectedProjectId || checkMutation.isPending}
            >
              <UploadIcon className="h-4 w-4 mr-2" />
              {checkMutation.isPending ? 'กำลังตรวจสอบ...' : 'อัปโหลดและตรวจสอบ'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. ผลการตรวจสอบ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
                <SummaryStat label="ทั้งหมด" value={result.totalRows} />
                <SummaryStat label="ผ่าน" value={result.passCount} className="text-green-600" />
                <SummaryStat label="คำเตือน" value={result.warnCount} className="text-amber-600" />
                <SummaryStat label="ติด BLOCK" value={result.blockCount} className="text-red-600" />
                <SummaryStat label="AI แนะนำ" value={result.aiSuggestCount} className="text-blue-600" />
              </div>

              {!result.aiAvailable && (
                <p className="text-sm text-muted-foreground mb-4">
                  AI Review unavailable{result.aiUnavailableReason ? `: ${result.aiUnavailableReason}` : ''} —
                  ยังตรวจสอบผลจาก Layer 1/2 ได้ตามปกติ
                </p>
              )}

              <div className="flex items-center gap-2 mb-4">
                <Button variant="outline" onClick={handleDownloadAnnotated} disabled={isDownloading}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  ดาวน์โหลดไฟล์ Annotated Excel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!result.canConfirm || confirmMutation.isPending}
                >
                  <CheckIcon className="h-4 w-4 mr-2" />
                  ยืนยันนำเข้า
                </Button>
                <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending}>
                  <XIcon className="h-4 w-4 mr-2" />
                  ยกเลิก
                </Button>
              </div>

              {!result.canConfirm && (
                <p className="text-sm text-destructive mb-4">
                  ไม่สามารถยืนยันนำเข้าได้ — มีแถวที่ติดสถานะ BLOCK กรุณาแก้ไขและอัปโหลดใหม่
                </p>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>แถว</TableHead>
                    <TableHead>คอลัมน์</TableHead>
                    <TableHead>ระดับ</TableHead>
                    <TableHead>ข้อความ</TableHead>
                    <TableHead>ค่าที่แนะนำ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.findings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        ไม่พบข้อผิดพลาดหรือคำเตือน
                      </TableCell>
                    </TableRow>
                  )}
                  {result.findings.map((finding, idx) => (
                    <TableRow key={`${finding.row}-${finding.column}-${idx}`}>
                      <TableCell>{finding.row}</TableCell>
                      <TableCell>{finding.column}</TableCell>
                      <TableCell>
                        <Badge variant={FINDING_BADGE_VARIANT[finding.level] ?? 'default'}>
                          {finding.level}
                        </Badge>
                      </TableCell>
                      <TableCell>{finding.message}</TableCell>
                      <TableCell>
                        {finding.suggestedValue != null ? String(finding.suggestedValue) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {confirmResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. ผลการยืนยันนำเข้า</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <SummaryStat label="Batch ID" value={confirmResult.batchId} />
              <SummaryStat label="ทั้งหมด" value={confirmResult.totalRows} />
              <SummaryStat label="นำเข้าสำเร็จ" value={confirmResult.enqueuedCount} className="text-green-600" />
              <SummaryStat
                label="กักกัน (Quarantine)"
                value={confirmResult.quarantinedCount}
                className={confirmResult.quarantinedCount > 0 ? 'text-amber-600' : undefined}
              />
            </div>

            {confirmResult.quarantinedCount > 0 && confirmResult.failedRowsDownloadUrl && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800 mb-2">
                  มี {confirmResult.quarantinedCount} แถวถูกกักกันไว้ (D6) — ดาวน์โหลดไฟล์เพื่อตรวจสอบและแก้ไขย้อนหลัง
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadFailedRows}
                  disabled={isDownloadingFailedRows}
                >
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  ดาวน์โหลด failed_rows.xlsx
                </Button>
              </div>
            )}

            <Button variant="secondary" onClick={handleStartNew}>
              เริ่มรายการใหม่
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number | string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold truncate ${className ?? ''}`}>{value}</p>
    </div>
  );
}
