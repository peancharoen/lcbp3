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
// - 2026-09-12: Async/polling pattern (ADR-008) — check() คืน sessionId ทันที
//   แล้ว poll GET /status จนเสร็จ แก้ปัญหา axios timeout 15s ไม่พอสำหรับ
//   AI review 265+ แถว. เพิ่ม progress bar + current step display.
// - 2026-09-12: Persist sessionId/result/confirmResult ลง localStorage
//   เพื่อให้ผู้ใช้กลับมาดูผลได้ภายใน 24 ชม. แม้ออกจากหน้า/refresh

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DownloadIcon, UploadIcon, XIcon, CheckIcon, LoaderIcon, ChevronDown, ChevronRight, FolderIcon, FolderOpenIcon } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useProjectStore } from '@/lib/stores/project-store';
import { useCheckImportReview, useReviewStatus, useConfirmImportReview, useCancelImportReview } from '@/hooks/use-import-review';
import { importReviewService } from '@/lib/services/import-review.service';
import { migrationService, type LegacyFolderNode } from '@/lib/services/migration.service';
import {
  AiReviewerProvider,
  BatchStrategy,
  CheckReviewResponse,
  ConfirmReviewResponse,
  ReviewTargetMode,
} from '@/types/import-review';

/** localStorage keys สำหรับ persist session ข้าม page unmount/refresh */
const LS_KEY_SESSION_ID = 'import-review:sessionId';
const LS_KEY_RESULT = 'import-review:result';
const LS_KEY_CONFIRM_RESULT = 'import-review:confirmResult';

/** อ่านค่าจาก localStorage อย่างปลอดภัย (SSR-safe + try/catch) */
function readLS<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** เขียนค่าลง localStorage อย่างปลอดภัย */
function writeLS<T>(key: string, value: T | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // ignore quota/permission errors
  }
}

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
  // NAS folder picker (MIGRATION_STAGING mode)
  const [nasFolderPath, setNasFolderPath] = useState<string>('');
  const [nasFolderTree, setNasFolderTree] = useState<LegacyFolderNode[]>([]);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  // Restore จาก localStorage — ถ้ามี session อยู่กลับมาดูผลต่อได้
  const [sessionId, setSessionId] = useState<string | null>(() => readLS<string>(LS_KEY_SESSION_ID));
  const [result, setResult] = useState<CheckReviewResponse | null>(() => readLS<CheckReviewResponse>(LS_KEY_RESULT));
  const [confirmResult, setConfirmResult] = useState<ConfirmReviewResponse | null>(() => readLS<ConfirmReviewResponse>(LS_KEY_CONFIRM_RESULT));
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingFailedRows, setIsDownloadingFailedRows] = useState(false);

  const checkMutation = useCheckImportReview();
  const statusQuery = useReviewStatus(sessionId);
  const confirmMutation = useConfirmImportReview();
  const cancelMutation = useCancelImportReview();

  // โหลด NAS folder tree เมื่อเลือก MIGRATION_STAGING mode
  useEffect(() => {
    if (targetMode === 'MIGRATION_STAGING' && nasFolderTree.length === 0) {
      migrationService.listLegacyFolders().then(setNasFolderTree).catch(() => undefined);
    }
  }, [targetMode, nasFolderTree.length]);

  // Sync sessionId → localStorage (persist ข้าม unmount/refresh)
  useEffect(() => {
    writeLS(LS_KEY_SESSION_ID, sessionId);
  }, [sessionId]);

  // Sync result → localStorage
  useEffect(() => {
    writeLS(LS_KEY_RESULT, result);
  }, [result]);

  // Sync confirmResult → localStorage
  useEffect(() => {
    writeLS(LS_KEY_CONFIRM_RESULT, confirmResult);
  }, [confirmResult]);

  // เมื่อ status กลายเป็น READY ให้เก็บ result และหยุด poll
  useEffect(() => {
    if (statusQuery.data?.status === 'READY' && statusQuery.data.result) {
      setResult(statusQuery.data.result);
      setSessionId(null); // หยุด poll + clear localStorage sessionId
    }
    // FAILED / EXPIRED / CANCELLED → หยุด poll + clear localStorage
    if (
      statusQuery.data?.status === 'FAILED' ||
      statusQuery.data?.status === 'EXPIRED' ||
      statusQuery.data?.status === 'CANCELLED'
    ) {
      setSessionId(null);
    }
    // Session ไม่พบ (404/expired บน backend) → clear localStorage
    if (statusQuery.isError) {
      setSessionId(null);
    }
  }, [statusQuery.data, statusQuery.isError]);

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
    setResult(null);
    setConfirmResult(null);
    checkMutation.mutate(
      {
        projectPublicId: selectedProjectId,
        targetMode,
        aiProvider,
        batchStrategy,
        file,
        nasFolderPath: targetMode === 'MIGRATION_STAGING' ? nasFolderPath || undefined : undefined,
      },
      { onSuccess: (data) => setSessionId(data.reviewSessionPublicId) }
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
    setSessionId(null);
    // localStorage ถูกเคลียร์โดย useEffect sync ด้านบน
  };

  const isProcessing = !!sessionId && statusQuery.data?.status !== 'READY' && statusQuery.data?.status !== 'FAILED' && statusQuery.data?.status !== 'EXPIRED' && statusQuery.data?.status !== 'CANCELLED' && !statusQuery.isError;
  const progressValue = statusQuery.data?.progress ?? 0;
  const currentStep = statusQuery.data?.currentStep ?? '';
  const failedMessage =
    statusQuery.data?.status === 'FAILED'
      ? statusQuery.data.errorMessage
      : statusQuery.data?.status === 'EXPIRED'
        ? 'session หมดอายุ (เกิน 24 ชม.) — กรุณาอัปโหลดใหม่'
        : statusQuery.isError
          ? 'session ไม่พบ (อาจหมดอายุหรือถูกลบ) — กรุณาอัปโหลดใหม่'
          : null;

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
              <Label htmlFor="import-review-file">
                {targetMode === 'MIGRATION_STAGING'
                  ? 'ไฟล์ Excel (.xlsx เท่านั้น)'
                  : 'ไฟล์ (.xlsx หรือ .zip พร้อมไฟล์แนบ PDF)'}
              </Label>
              <Input
                id="import-review-file"
                type="file"
                accept={targetMode === 'MIGRATION_STAGING' ? '.xlsx' : '.xlsx,.zip'}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {targetMode === 'DIRECT_IMPORT' && (
                <p className="text-xs text-muted-foreground">
                  ถ้ามีไฟล์แนบ PDF ให้รวมเป็น .zip (ที่มีทั้ง .xlsx + PDFs)
                </p>
              )}
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

          {/* NAS folder picker — MIGRATION_STAGING mode only */}
          {targetMode === 'MIGRATION_STAGING' && (
            <div className="space-y-1.5">
              <Label>โฟลเดอร์ Staging PDF บน NAS (ไม่บังคับ)</Label>
              <Popover open={folderPickerOpen} onOpenChange={setFolderPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={nasFolderTree.length === 0}
                    className="w-full justify-between text-sm font-normal"
                  >
                    <span className="truncate">
                      {nasFolderPath
                        ? nasFolderPath.replace(/^.*\/([^/]+)$/, '$1/')
                        : nasFolderTree.length === 0
                          ? 'ไม่พบโฟลเดอร์ใน NAS'
                          : 'เลือกโฟลเดอร์ Staging PDF...'}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[480px] p-0" align="start">
                  <div className="max-h-[320px] overflow-y-auto p-1">
                    {nasFolderTree.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                        ไม่พบโฟลเดอร์ใน NAS
                      </div>
                    ) : (
                      <FolderTree
                        nodes={nasFolderTree}
                        expanded={expandedFolders}
                        onToggle={(path) => {
                          const next = new Set(expandedFolders);
                          if (next.has(path)) {
                            next.delete(path);
                          } else {
                            next.add(path);
                          }
                          setExpandedFolders(next);
                        }}
                        selectedPath={nasFolderPath}
                        onSelect={(path) => {
                          setNasFolderPath(path);
                          setFolderPickerOpen(false);
                        }}
                      />
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                เลือกโฟลเดอร์ที่มีไฟล์ PDF แนบ — ระบบจะสแกนหาไฟล์ PDF ในโฟลเดอร์นี้แทนการอัปโหลด .zip
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Select value={batchStrategy} onValueChange={(v) => setBatchStrategy(v as BatchStrategy)}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL">Full Review (≤200 แถว)</SelectItem>
                <SelectItem value="FAST_SELECTIVE">{`Fast Selective (WARN + สุ่ม 5%, >200 แถว)`}</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleUpload}
              disabled={!file || !selectedProjectId || checkMutation.isPending || isProcessing}
            >
              <UploadIcon className="h-4 w-4 mr-2" />
              {checkMutation.isPending ? 'กำลังส่งไฟล์...' : 'อัปโหลดและตรวจสอบ'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Async progress panel */}
      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LoaderIcon className="h-4 w-4 animate-spin" />
              กำลังตรวจสอบข้อมูล...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progressValue} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{currentStep || 'กำลังประมวลผล...'}</span>
              <span>{progressValue}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              ระบบกำลังรัน 4-Layer review ใน background (ADR-008) — ไม่ต้องรอหน้านี้
              สามารถกลับมาดูผลได้ภายใน 24 ชั่วโมง
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error panel */}
      {failedMessage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">การตรวจสอบล้มเหลว</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{failedMessage}</p>
            <Button variant="secondary" className="mt-4" onClick={handleStartNew}>
              เริ่มรายการใหม่
            </Button>
          </CardContent>
        </Card>
      )}

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

// --- FolderTree: recursive tree view สำหรับเลือก Staging PDF folder ---
interface FolderTreeProps {
  nodes: LegacyFolderNode[];
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string;
  onSelect: (path: string) => void;
  depth?: number;
}

function FolderTree({
  nodes,
  expanded,
  onToggle,
  selectedPath,
  onSelect,
  depth = 0,
}: FolderTreeProps) {
  return (
    <ul className={depth === 0 ? '' : 'ml-3 border-l border-border/40 pl-1'}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expanded.has(node.path);
        const isSelected = selectedPath === node.path;
        return (
          <li key={node.path}>
            <div
              className={`flex items-center gap-1 rounded px-1.5 py-1 text-xs cursor-pointer hover:bg-accent ${
                isSelected ? 'bg-primary/15 text-primary font-medium' : ''
              }`}
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
              onClick={() => onSelect(node.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(node.path);
                }
              }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 hover:bg-accent-foreground/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(node.path);
                  }}
                  aria-label={isExpanded ? 'ย่อ' : 'ขยาย'}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="inline-block w-[22px] shrink-0" />
              )}
              {isExpanded && hasChildren ? (
                <FolderOpenIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <FolderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{node.name}</span>
            </div>
            {hasChildren && isExpanded && (
              <FolderTree
                nodes={node.children}
                expanded={expanded}
                onToggle={onToggle}
                selectedPath={selectedPath}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
