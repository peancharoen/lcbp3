// File: app/(admin)/admin/migration/page.tsx
// Change Log:
// - 2026-08-23: Batch commit ส่ง sourceFilePath และ disciplineId จาก queue item details
// - 2026-08-23: Legacy Review Queue - column-header filters, delete all/selected with BullMQ cleanup

'use client';

import { useEffect, useState, useCallback } from 'react';
import { aiService } from '@/lib/services/ai.service';
import { migrationService } from '@/lib/services/migration.service';
import { AiMigrationLog, AiMigrationLogStatus } from '@/types/ai';
import { MigrationReviewQueueItem, MigrationReviewStatus, MigrationAiStatus } from '@/types/migration';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { format } from 'date-fns';
import { EyeIcon, FileXIcon, CheckCircleIcon, XCircleIcon, RefreshCwIcon } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/types/api-error';
import { LegacyIngestionCard } from '@/components/migration/legacy-ingestion-card';
import { v4 as uuidv4 } from 'uuid';

// --- AI Migration Tab ---

function AiMigrationTab() {
  const [items, setItems] = useState<AiMigrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_REVIEW');
  // ADR-019: ใช้ publicId (string) สำหรับ selection
  const [selectedPublicIds, setSelectedPublicIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Sheet สำหรับ inline review
  const [reviewItem, setReviewItem] = useState<AiMigrationLog | null>(null);
  const [adminFeedback, setAdminFeedback] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await aiService.getMigrationList({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as AiMigrationLogStatus),
        limit: 50,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      setSelectedPublicIds([]);
    } catch (error: unknown) {
      setItems([]);
      setErrorMessage(getApiErrorMessage(error, 'ไม่สามารถโหลดข้อมูล AI Migration Logs ได้'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ADR-019: toggle โดยใช้ publicId (string) ไม่ใช่ numeric id
  const handleToggleSelectAll = () => {
    if (selectedPublicIds.length === items.length) {
      setSelectedPublicIds([]);
    } else {
      setSelectedPublicIds(items.map((i) => i.publicId));
    }
  };

  const handleToggleSelect = (publicId: string) => {
    setSelectedPublicIds((prev) =>
      prev.includes(publicId) ? prev.filter((id) => id !== publicId) : [...prev, publicId]
    );
  };

  // Bulk verify รายการที่เลือก (ADR-019: ใช้ publicId)
  const handleBulkVerify = async () => {
    if (selectedPublicIds.length === 0) return;
    try {
      setSubmitting(true);
      await Promise.all(
        selectedPublicIds.map((publicId) =>
          aiService.updateMigration(
            publicId, // ADR-019: UUID เท่านั้น
            { status: AiMigrationLogStatus.VERIFIED },
            `bulk-verify-${publicId}-${uuidv4()}`
          )
        )
      );
      toast.success(`ยืนยัน ${selectedPublicIds.length} รายการเรียบร้อย`);
      await fetchData();
    } catch (_error) {
      toast.error('การยืนยันแบบกลุ่มล้มเหลว');
    } finally {
      setSubmitting(false);
    }
  };

  // อัปเดตสถานะ item เดี่ยว (ADR-019: ใช้ publicId)
  const handleUpdateStatus = async (status: AiMigrationLogStatus) => {
    if (!reviewItem) return;
    try {
      setSubmitting(true);
      await aiService.updateMigration(
        reviewItem.publicId, // ADR-019: UUID เท่านั้น
        { status, adminFeedback: adminFeedback || undefined },
        `review-${reviewItem.publicId}-${uuidv4()}`
      );
      const label = status === AiMigrationLogStatus.VERIFIED ? 'ยืนยัน' : 'ปฏิเสธ';
      toast.success(`${label}เอกสารเรียบร้อย`);
      setReviewItem(null);
      setAdminFeedback('');
      await fetchData();
    } catch (_error) {
      toast.error('ไม่สามารถอัปเดตสถานะได้');
    } finally {
      setSubmitting(false);
    }
  };

  // สีของ confidence badge
  const getConfidenceVariant = (score?: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (!score) return 'destructive';
    if (score >= 0.95) return 'default';
    if (score >= 0.75) return 'secondary';
    return 'destructive';
  };

  // สีของ status badge
  const getStatusVariant = (status: AiMigrationLogStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case AiMigrationLogStatus.VERIFIED:
      case AiMigrationLogStatus.IMPORTED:
        return 'default';
      case AiMigrationLogStatus.FAILED:
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const statusLabels: Record<string, string> = {
    PENDING_REVIEW: 'รอตรวจสอบ',
    VERIFIED: 'ผ่านการตรวจสอบ',
    IMPORTED: 'นำเข้าแล้ว',
    FAILED: 'ล้มเหลว',
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <CardTitle>AI Migration Logs</CardTitle>
            <div className="flex items-center gap-3">
              {selectedPublicIds.length > 0 && (
                <Button variant="default" onClick={handleBulkVerify} disabled={submitting}>
                  <CheckCircleIcon className="mr-2 h-4 w-4" />
                  {submitting ? 'กำลังดำเนินการ...' : `ยืนยัน ${selectedPublicIds.length} รายการ`}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCwIcon className="h-4 w-4 mr-2" />
                รีเฟรช
              </Button>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ทุกสถานะ</SelectItem>
                  <SelectItem value="PENDING_REVIEW">รอตรวจสอบ</SelectItem>
                  <SelectItem value="VERIFIED">ผ่านการตรวจสอบ</SelectItem>
                  <SelectItem value="FAILED">ล้มเหลว</SelectItem>
                  <SelectItem value="IMPORTED">นำเข้าแล้ว</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">กำลังโหลด...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">ไม่มีรายการ</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={items.length > 0 && selectedPublicIds.length === items.length}
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="เลือกทั้งหมด"
                      />
                    </TableHead>
                    <TableHead>ไฟล์ต้นทาง</TableHead>
                    <TableHead>ความมั่นใจ AI</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่สร้าง</TableHead>
                    <TableHead className="text-right">การดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    // ADR-019: ใช้ publicId เป็น key
                    <TableRow key={item.publicId}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPublicIds.includes(item.publicId)}
                          onCheckedChange={() => handleToggleSelect(item.publicId)}
                          aria-label={`เลือก ${item.publicId}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">
                        {item.sourceFile}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getConfidenceVariant(item.confidenceScore)}>
                          {item.confidenceScore
                            ? (item.confidenceScore * 100).toFixed(1) + '%'
                            : 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(item.status)}>
                          {statusLabels[item.status] ?? item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(item.createdAt), 'dd MMM yyyy, HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReviewItem(item);
                            setAdminFeedback(item.adminFeedback ?? '');
                          }}
                          disabled={item.status === AiMigrationLogStatus.IMPORTED}
                        >
                          <EyeIcon className="h-4 w-4 mr-2" />
                          ตรวจสอบ
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline Review Sheet */}
      <Sheet
        open={reviewItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReviewItem(null);
            setAdminFeedback('');
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>ตรวจสอบ AI Migration Log</SheetTitle>
          </SheetHeader>
          {reviewItem && (
            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Public ID (ADR-019)</p>
                <p className="font-mono text-xs break-all">{reviewItem.publicId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ไฟล์ต้นทาง</p>
                <p className="text-sm">{reviewItem.sourceFile}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ความมั่นใจ AI</p>
                <Badge variant={getConfidenceVariant(reviewItem.confidenceScore)}>
                  {reviewItem.confidenceScore
                    ? (reviewItem.confidenceScore * 100).toFixed(1) + '%'
                    : 'N/A'}
                </Badge>
              </div>
              {reviewItem.aiExtractedMetadata &&
                Object.keys(reviewItem.aiExtractedMetadata).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      ข้อมูลที่ AI สกัดได้
                    </p>
                    <div className="bg-muted/40 rounded p-3 text-xs space-y-1 max-h-48 overflow-y-auto">
                      {Object.entries(reviewItem.aiExtractedMetadata).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="font-medium text-muted-foreground min-w-[100px]">{k}:</span>
                          <span>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              <div className="space-y-1">
                <label className="text-sm font-medium">ความเห็น Admin</label>
                <Textarea
                  value={adminFeedback}
                  onChange={(e) => setAdminFeedback(e.target.value)}
                  placeholder="ระบุความเห็นหรือเหตุผล (ถ้ามี)"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={
                    submitting ||
                    reviewItem.status === AiMigrationLogStatus.IMPORTED ||
                    reviewItem.status === AiMigrationLogStatus.FAILED
                  }
                  onClick={() => handleUpdateStatus(AiMigrationLogStatus.FAILED)}
                >
                  <XCircleIcon className="h-4 w-4 mr-2" />
                  ปฏิเสธ
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={
                    submitting ||
                    reviewItem.status === AiMigrationLogStatus.IMPORTED ||
                    reviewItem.status === AiMigrationLogStatus.VERIFIED
                  }
                  onClick={() => handleUpdateStatus(AiMigrationLogStatus.VERIFIED)}
                >
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  {submitting ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// --- Legacy Management Tab (ระบบ Migration เดิม) ---

function LegacyManagementTab() {
  const [items, setItems] = useState<MigrationReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Filter สถานะทั้ง Status และ AI Status — ค่า 'ALL' คือไม่กรอง
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [aiStatusFilter, setAiStatusFilter] = useState<string>('ALL');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [batchOptions, setBatchOptions] = useState<string[]>([]);
  // ADR-019: ใช้ publicId (string) สำหรับ selection ห้ามใช้ INT id
  const [selectedPublicIds, setSelectedPublicIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Pagination
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await migrationService.getReviewQueue({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as MigrationReviewStatus),
        aiStatus: aiStatusFilter === 'ALL' ? undefined : (aiStatusFilter as MigrationAiStatus),
        batchId: batchFilter === 'ALL' ? undefined : batchFilter,
        page,
        limit: pageSize,
      });
      const fetchedItems = Array.isArray(res.items) ? res.items : [];
      setItems(fetchedItems);
      setTotalRows(res.total ?? fetchedItems.length);
      setTotalPages(res.totalPages ?? 1);
      setSelectedPublicIds([]);
    } catch (error: unknown) {
      setItems([]);
      setErrorMessage(getApiErrorMessage(error, 'Failed to load queue'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, aiStatusFilter, batchFilter, page]);

  // ADR-047: โหลด batch options สำหรับ filter dropdown
  const fetchBatches = useCallback(async () => {
    try {
      const batches = await migrationService.getQueueBatches();
      setBatchOptions(batches);
    } catch {
      setBatchOptions([]);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // ADR-019: toggle โดยใช้ publicId (string)
  // ADR-047: "Select All" เลือกรายการทั้งหมดในหน้าปัจจุบัน แต่ละ action จะ filter ตามสถานะเอง
  const isExecutable = (item: typeof items[number]) =>
    item.status === MigrationReviewStatus.PENDING_REVIEW &&
    item.aiStatus === MigrationAiStatus.DONE;

  // ADR-047: ห้าม re-extract รายการที่มี BullMQ job อยู่แล้ว (aiJobId != null)
  // ยกเว้น FAILED ที่อนุญาตให้ retry ได้ — ป้องกัน duplicate jobs ใน BullMQ
  const isExtractable = (item: typeof items[number]) =>
    item.status === MigrationReviewStatus.PENDING &&
    item.aiStatus !== MigrationAiStatus.RUNNING &&
    item.aiStatus !== MigrationAiStatus.DONE &&
    (!item.aiJobId || item.aiStatus === MigrationAiStatus.FAILED);

  const handleToggleSelectAll = () => {
    if (selectedPublicIds.length === items.length && items.length > 0) {
      setSelectedPublicIds([]);
    } else {
      setSelectedPublicIds(items.map((i) => i.publicId));
    }
  };

  const handleToggleSelect = (publicId: string) => {
    setSelectedPublicIds((prev) =>
      prev.includes(publicId) ? prev.filter((id) => id !== publicId) : [...prev, publicId]
    );
  };

  // ADR-047: Batch start OCR/AI extract — ใช้ publicId สำหรับรายการ PENDING
  const handleBatchExtract = async () => {
    if (selectedPublicIds.length === 0) return;
    const extractable = items.filter(
      (i) => selectedPublicIds.includes(i.publicId) && isExtractable(i)
    );
    if (extractable.length === 0) {
      toast.warning('ไม่มีรายการทีสามารถเริ่ม Extract ได้');
      return;
    }
    try {
      setSubmitting(true);
      const idempotencyKey = `batch-extract-${Date.now()}`;
      const result = await migrationService.startExtractBatch(
        extractable.map((i) => i.publicId),
        idempotencyKey
      );
      const okCount = Array.isArray(result.results)
        ? result.results.filter((r: unknown) => !(r as { error?: string })?.error).length
        : extractable.length;
      toast.success(`เริ่ม Extract ${okCount} รายการใน BullMQ`);
      await fetchData();
    } catch (_error) {
      toast.error('Batch extract failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Batch execute import — ส่งผ่าน background queue (ADR-008)
  // ADR-019: ใช้ queuePublicId (UUIDv7) ไม่ใช่ INT id
  const handleBatchExecuteImport = async () => {
    if (selectedPublicIds.length === 0) return;
    try {
      setSubmitting(true);
      const batchItems = items
        .filter((i) => selectedPublicIds.includes(i.publicId) && isExecutable(i))
        .map((item) => ({
          queuePublicId: item.publicId,
          dto: {
            documentNumber: item.documentNumber,
            subject: item.subject || item.originalSubject || 'Untitled',
            category: item.aiSuggestedCategory || 'Correspondence',
            projectId: item.projectId || 1,
            migratedBy: 'SYSTEM_IMPORT',
            // ADR-019: tempAttachmentId/tempAttachmentIds เป็น @Exclude ใน entity
            // backend จะดึงจาก queueItem โดยตรงใน approveQueueItemByPublicId
            aiConfidence: item.aiConfidence,
            aiIssues: item.aiIssues,
            // Mapping: issuedDate จาก excel → documentDate (วันที่ออกเอกสาร)
            documentDate: item.issuedDate,
            receivedDate: item.receivedDate,
            // ADR-019: ส่ง publicId (UUID) สำหรับ sender/receiver
            senderPublicId: item.senderOrganizationPublicId || undefined,
            receiverPublicId: item.receiverOrganizationPublicId || undefined,
            // อ่าน canonical path และ disciplineId จาก details ที่ ingestion / AI เก็บไว้
            sourceFilePath:
              typeof item.details?.source_file_path === 'string'
                ? item.details.source_file_path
                : undefined,
            disciplineId:
              typeof item.details?.disciplineId === 'number'
                ? item.details.disciplineId
                : undefined,
            details: { tags: item.extractedTags },
          },
        }));
      if (batchItems.length === 0) {
        toast.warning('เลือกเฉพาะรายการที่ OCR/AI เสร็จแล้วเท่านั้น');
        return;
      }
      const batchId = `BATCH_UI_${Date.now()}`;
      await migrationService.commitBatch({ items: batchItems, batchId }, batchId);
      toast.success(`Execute Import ${batchItems.length} รายการเรียบร้อย`);
      await fetchData();
    } catch (_error) {
      toast.error('Batch import failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // ADR-047: ลบรายการทั้งหมด หรือเฉพาะที่เลือก พร้อมลบ BullMQ job จาก backend
  const handleDelete = async () => {
    const hasSelection = selectedPublicIds.length > 0;
    const confirmMsg = hasSelection
      ? `ยืนยันลบ ${selectedPublicIds.length} รายการที่เลือก?`
      : 'ยืนยันลบรายการทั้งหมดในคิว?';
    if (!window.confirm(confirmMsg)) return;
    try {
      setDeleting(true);
      const result = await migrationService.deleteReviewQueue(
        undefined,
        !hasSelection,
        hasSelection ? selectedPublicIds : undefined
      );
      toast.success(`ลบ ${result.deleted} รายการเรียบร้อย`);
      setSelectedPublicIds([]);
      await fetchData();
      await fetchBatches();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'ลบไม่สำเร็จ'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <LegacyIngestionCard onIngestionStarted={fetchData} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <CardTitle>Legacy Review Queue</CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            {selectedPublicIds.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={handleBatchExtract}
                  disabled={submitting}
                >
                  <RefreshCwIcon className="mr-2 h-4 w-4" />
                  {submitting
                    ? 'Processing...'
                    : `Start Extract (${selectedPublicIds.length})`}
                </Button>
                <Button
                  variant="default"
                  onClick={handleBatchExecuteImport}
                  disabled={submitting}
                >
                  <CheckCircleIcon className="mr-2 h-4 w-4" />
                  {submitting
                    ? 'Processing...'
                    : `Execute Import (${items.filter(isExecutable).filter((i) => selectedPublicIds.includes(i.publicId)).length})`}
                </Button>
              </>
            )}
            <Link href="/admin/migration/errors">
              <Button variant="outline">
                <FileXIcon className="mr-2 h-4 w-4" /> View Errors
              </Button>
            </Link>
            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Batches</SelectItem>
                {batchOptions.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || (selectedPublicIds.length === 0 && items.length === 0)}
              size="sm"
            >
              {deleting
                ? 'กำลังลบ...'
                : selectedPublicIds.length > 0
                  ? `ลบที่เลือก (${selectedPublicIds.length})`
                  : 'ลบทั้งหมด'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {errorMessage && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}
        {loading ? (
          <div className="py-10 text-center">Loading queue...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">No items in the queue.</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]" />
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={items.length > 0 && selectedPublicIds.length === items.length}
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="เลือกรายการทั้งหมดในหน้านี้"
                      />
                      <span>Document No.</span>
                    </div>
                  </TableHead>
                  <TableHead>Correspondence Type</TableHead>
                  <TableHead>Issued Date</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>
                    <Select value={aiStatusFilter} onValueChange={setAiStatusFilter}>
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue placeholder="AI Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">ทุก AI Status</SelectItem>
                        {Object.values(MigrationAiStatus).map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">ทุก Status</SelectItem>
                        {Object.values(MigrationReviewStatus).map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  // ADR-019: ใช้ publicId เป็น key
                  <TableRow key={item.publicId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPublicIds.includes(item.publicId)}
                        onCheckedChange={() => handleToggleSelect(item.publicId)}
                        aria-label={`Select item ${item.publicId}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.documentNumber}</TableCell>
                    <TableCell>{item.aiSuggestedCategoryName || item.aiSuggestedCategory || 'Unknown'}</TableCell>
                    <TableCell>{item.issuedDate ? format(new Date(item.issuedDate), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell>{item.receivedDate ? format(new Date(item.receivedDate), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell>{item.senderOrganizationCode ?? '—'}</TableCell>
                    <TableCell>{item.receiverOrganizationCode ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          !item.aiConfidence
                            ? 'destructive'
                            : item.aiConfidence > 0.8
                              ? 'default'
                              : item.aiConfidence > 0.5
                                ? 'secondary'
                                : 'destructive'
                        }
                      >
                        {item.aiConfidence ? (item.aiConfidence * 100).toFixed(1) + '%' : 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.aiStatus === 'DONE'
                            ? 'default'
                            : item.aiStatus === 'RUNNING'
                              ? 'secondary'
                              : item.aiStatus === 'FAILED'
                                ? 'destructive'
                                : 'outline'
                        }
                      >
                        {item.aiStatus || 'PENDING'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === 'PENDING'
                            ? 'outline'
                            : item.status === 'PENDING_REVIEW'
                              ? 'default'
                              : item.status === 'IMPORTED'
                                ? 'default'
                                : 'destructive'
                        }
                      >
                        {item.status}
                      </Badge>
                      {item.aiFailed && (
                        <Badge variant="destructive" className="ml-1 text-xs">
                          AI Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(item.createdAt), 'dd MMM yyyy, HH:mm')}</TableCell>
                    <TableCell className="text-right">
                      {/* ADR-019: ใช้ publicId ใน route */}
                      <Link href={`/admin/migration/review/${item.publicId}`}>
                        <Button size="sm" variant="ghost">
                          <EyeIcon className="h-4 w-4 mr-2" /> Review
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {/* Pagination + row count */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            ทั้งหมด {totalRows} รายการ (หน้า {page}/{totalPages})
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ก่อนหน้า
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ถัดไป
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}

// --- Main Page ---

export default function MigrationManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Migration Management</h1>
        <p className="text-muted-foreground mt-1">จัดการการนำเข้าเอกสาร — AI Migration Logs และ Legacy Review Queue</p>
      </div>
      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">AI Migration Logs</TabsTrigger>
          <TabsTrigger value="legacy">Legacy Management</TabsTrigger>
        </TabsList>
        <TabsContent value="ai">
          <AiMigrationTab />
        </TabsContent>
        <TabsContent value="legacy">
          <LegacyManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
