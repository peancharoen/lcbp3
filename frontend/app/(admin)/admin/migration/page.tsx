// File: app/(admin)/admin/migration/page.tsx
// Change Log:
// - 2026-09-24: แสดงเลขเอกสารฐาน + revision badge ผ่าน QueueDocNumber และส่ง
//   เลขฐานใน batch dto (queue document_number เป็น staging key ตั้งแต่
//   revision-chain import — เลขจริงใน details.original_document_number)
// - 2026-09-16: เพิ่ม filter ที่ column Correspondence Type + Confidence, pagination
//   แบบเลขหน้า (กระโดดข้ามได้), reset page=1 เมื่อเปลี่ยน filter, และแก้ bug header
//   หายเมื่อ filter ไม่พบข้อมูล (render TableHeader เสมอ ย้าย empty state เข้า TableBody)
// - 2026-09-14: T023 (ADR-054) — sourceFilePath อ่านจาก item.storageTempPath (first-class column)
//   แทน details.source_file_path ที่ถูกย้ายออกจาก details payload แล้ว (FR-010)
// - 2026-08-23: Batch commit ส่ง sourceFilePath และ disciplineId จาก queue item details
// - 2026-08-23: Legacy Review Queue - column-header filters, delete all/selected with BullMQ cleanup
// - 2026-08-25: D161 — ลบ AI Migration Logs tab + AiMigrationTab component (dead UI — migration_logs ไม่ถูกเขียนตั้งแต่ ADR-023/023A เปลี่ยนไป BullMQ)
// - 2026-09-19: URL-backed page+filters (useSearchParams) — กด Review แล้วย้อนกลับคงหน้า/filter เดิม
// - 2026-09-19: page-size selector 10/20/50/100 (URL-backed ?limit=) — เปลี่ยน size แล้ว reset ไปหน้า 1

'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { migrationService } from '@/lib/services/migration.service';
import { MigrationReviewQueueItem, MigrationReviewStatus, MigrationAiStatus } from '@/types/migration';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { EyeIcon, FileXIcon, CheckCircleIcon, RefreshCwIcon } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/types/api-error';
import { LegacyIngestionCard } from '@/components/migration/legacy-ingestion-card';
import { QueueDocNumber } from '@/components/migration/queue-doc-number';
import { getQueueBaseDocNumber, getQueueDocDisplayText } from '@/lib/utils/queue-doc-number';
import { masterDataService } from '@/lib/services/master-data.service';
import { CorrespondenceType } from '@/types/master-data';

// --- Legacy Management Tab (ระบบ Migration เดิม) ---

/** ช่วง confidence ที่ตรงกับเกณฑ์ badge — ส่งไป backend ผ่าน confidenceBucket param */
type ConfidenceBucket = 'low' | 'mid' | 'high' | 'missing';

/** page size ที่เลือกได้ — ต้องไม่เกิน @Max(100) ของ backend DTO */
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

/** สร้างลำดับเลขหน้าสำหรับ pagination — แสดงหน้าแรก/สุดท้าย + window ±2 รอบหน้าปัจจุบัน คั่นด้วย ellipsis */
const getPageNumbers = (page: number, totalPages: number): (number | 'ellipsis')[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages]);
  for (let p = page - 2; p <= page + 2; p += 1) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('ellipsis');
    result.push(sorted[i]);
  }
  return result;
};

function LegacyManagementTab() {
  const [items, setItems] = useState<MigrationReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Filter+page เป็น URL-backed state — กด Review ไปหน้าอื่นแล้วย้อนกลับจะคงหน้า/filter เดิม
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const statusFilter = searchParams.get('status') ?? 'ALL';
  const aiStatusFilter = searchParams.get('aiStatus') ?? 'ALL';
  const batchFilter = searchParams.get('batch') ?? 'ALL';
  const correspondenceTypeFilter = searchParams.get('ctype') ?? 'ALL';
  const confidenceBucketFilter = searchParams.get('conf') ?? 'ALL';
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;
  // page size เป็น URL-backed เช่นเดียวกับ page/filters — ค่าที่ไม่ใช่ 10/20/50/100 fallback เป็น default
  const limitParam = Number(searchParams.get('limit'));
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(limitParam) ? limitParam : DEFAULT_PAGE_SIZE;
  const [correspondenceTypeOptions, setCorrespondenceTypeOptions] = useState<CorrespondenceType[]>([]);
  const [batchOptions, setBatchOptions] = useState<string[]>([]);
  // ADR-019: ใช้ publicId (string) สำหรับ selection ห้ามใช้ INT id
  const [selectedPublicIds, setSelectedPublicIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  /** อัปเดต query params — ลบ param ที่เป็นค่า default/null ออกจาก URL; replace (ไม่ push) กัน history รก */
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === 'ALL') params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, pathname, router]
  );
  const setPage = useCallback(
    (p: number) => updateParams({ page: p > 1 ? String(p) : null }),
    [updateParams]
  );
  // เปลี่ยน page size ต้องกลับไปหน้า 1 เสมอ — ไม่อย่างนั้นอาจตกหน้าว่าง (เช่นอยู่หน้า 13 ที่ size 20)
  const setPageSize = useCallback(
    (size: number) => updateParams({ limit: size === DEFAULT_PAGE_SIZE ? null : String(size), page: null }),
    [updateParams]
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await migrationService.getReviewQueue({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as MigrationReviewStatus),
        aiStatus: aiStatusFilter === 'ALL' ? undefined : (aiStatusFilter as MigrationAiStatus),
        batchId: batchFilter === 'ALL' ? undefined : batchFilter,
        correspondenceType: correspondenceTypeFilter === 'ALL' ? undefined : correspondenceTypeFilter,
        confidenceBucket: confidenceBucketFilter === 'ALL' ? undefined : (confidenceBucketFilter as ConfidenceBucket),
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
  }, [statusFilter, aiStatusFilter, batchFilter, correspondenceTypeFilter, confidenceBucketFilter, page, pageSize]);

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

  // โหลด correspondence types สำหรับ column filter — ไม่ block หน้าถ้าโหลดไม่ได้
  useEffect(() => {
    masterDataService
      .getCorrespondenceTypes()
      .then((types) => setCorrespondenceTypeOptions(types ?? []))
      .catch(() => setCorrespondenceTypeOptions([]));
  }, []);

  // เปลี่ยน filter แล้วต้องกลับไปหน้า 1 เสมอ — ไม่อย่างนั้น filter ใหม่อาจตกหน้าว่าง
  const applyFilter = (key: string) => (value: string) => {
    updateParams({ [key]: value === 'ALL' ? null : value, page: null });
  };

  // ADR-019: toggle โดยใช้ publicId (string)
  // ADR-047: "Select All" เลือกรายการทั้งหมดในหน้าปัจจุบัน แต่ละ action จะ filter ตามสถานะเอง
  const isExecutable = (item: (typeof items)[number]) =>
    item.status === MigrationReviewStatus.PENDING_REVIEW && item.aiStatus === MigrationAiStatus.DONE;

  // ADR-047: ห้าม re-extract รายการที่มี BullMQ job อยู่แล้ว (aiJobId != null)
  // ยกเว้น FAILED ที่อนุญาตให้ retry ได้ — ป้องกัน duplicate jobs ใน BullMQ
  const isExtractable = (item: (typeof items)[number]) =>
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
    const extractable = items.filter((i) => selectedPublicIds.includes(i.publicId) && isExtractable(i));
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
            // เลขฐานจริง — document_number เป็น staging key (backend resolve
            // จาก details เหมือนกัน แต่ส่งค่าที่ถูกต้องตาม semantics ของ DTO)
            documentNumber: getQueueBaseDocNumber(item),
            subject: item.subject || item.originalSubject || 'Untitled',
            correspondenceType: item.aiSuggestedCorrespondenceType || 'Correspondence',
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
            // ADR-054 (FR-010): canonical path อ่านจาก storageTempPath column
            // (details.source_file_path ถูกย้ายออกแล้ว), disciplineId ยังอยู่ใน details
            sourceFilePath:
              typeof item.storageTempPath === 'string' && item.storageTempPath.length > 0
                ? item.storageTempPath
                : undefined,
            disciplineId: typeof item.details?.disciplineId === 'number' ? item.details.disciplineId : undefined,
            details: { tags: item.extractedTags },
          },
        }));
      if (batchItems.length === 0) {
        toast.warning('เลือกเฉพาะรายการที่ OCR/AI เสร็จแล้วเท่านั้น');
        return;
      }
      const batchId = `BATCH_UI_${Date.now()}`;
      const result = await migrationService.commitBatch({ items: batchItems, batchId }, batchId);
      // per-item failures ไม่ throw — ต้องอ่าน result.failed/errors เอง
      // (flagged items โดน MIGRATION_REQUIRES_MANUAL_REVIEW ต้องเปิด review ทีละรายการ)
      const failedCount = typeof result?.failed === 'number' ? result.failed : 0;
      if (failedCount > 0) {
        const failedIds = new Set(
          (Array.isArray(result?.errors) ? result.errors : []).map((e: { queuePublicId?: string }) => e.queuePublicId)
        );
        const failedDocs = items.filter((i) => failedIds.has(i.publicId)).map((i) => getQueueDocDisplayText(i));
        toast.warning(`Import สำเร็จ ${result?.processed ?? 0} / ล้มเหลว ${failedCount} รายการ`, {
          description:
            failedDocs.slice(0, 5).join(', ') +
            (failedDocs.length > 5 ? ` +${failedDocs.length - 5} รายการ` : '') +
            ' — รายการที่ถูก flag ต้องเปิดหน้า Review ทีละรายการ',
        });
      } else {
        toast.success(`Execute Import ${batchItems.length} รายการเรียบร้อย`);
      }
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
      <LegacyIngestionCard
        onIngestionStarted={() => {
          fetchData();
          fetchBatches();
        }}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <CardTitle>Legacy Review Queue</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              {selectedPublicIds.length > 0 && (
                <>
                  <Button variant="outline" onClick={handleBatchExtract} disabled={submitting}>
                    <RefreshCwIcon className="mr-2 h-4 w-4" />
                    {submitting ? 'Processing...' : `Start Extract (${selectedPublicIds.length})`}
                  </Button>
                  <Button variant="default" onClick={handleBatchExecuteImport} disabled={submitting}>
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
              <Select value={batchFilter} onValueChange={applyFilter('batch')}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Batches</SelectItem>
                  {batchOptions.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
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
          {/* ตาราง + header ต้อง render เสมอ — filter Selects อยู่ใน TableHead
            ถ้าซ่อนทั้งตารางตอนไม่มีข้อมูล user จะเปลี่ยน filter กลับไม่ได้ (ต้อง reload) */}
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
                  <TableHead>
                    <Select value={correspondenceTypeFilter} onValueChange={applyFilter('ctype')}>
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <SelectValue placeholder="Correspondence Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">ทุก Type</SelectItem>
                        {correspondenceTypeOptions.map((ct) => (
                          <SelectItem key={ct.typeCode} value={ct.typeCode}>
                            {ct.typeCode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead>Issued Date</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>
                    <Select value={confidenceBucketFilter} onValueChange={applyFilter('conf')}>
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue placeholder="Confidence" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">ทุก Confidence</SelectItem>
                        <SelectItem value="high">&gt; 80%</SelectItem>
                        <SelectItem value="mid">50–80%</SelectItem>
                        <SelectItem value="low">≤ 50%</SelectItem>
                        <SelectItem value="missing">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead>
                    <Select value={aiStatusFilter} onValueChange={applyFilter('aiStatus')}>
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue placeholder="AI Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">ทุก AI Status</SelectItem>
                        {Object.values(MigrationAiStatus).map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead>
                    <Select value={statusFilter} onValueChange={applyFilter('status')}>
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">ทุก Status</SelectItem>
                        {Object.values(MigrationReviewStatus).map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      Loading queue...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      No items in the queue.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    // ADR-019: ใช้ publicId เป็น key
                    <TableRow key={item.publicId}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPublicIds.includes(item.publicId)}
                          onCheckedChange={() => handleToggleSelect(item.publicId)}
                          aria-label={`Select item ${item.publicId}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <QueueDocNumber item={item} />
                      </TableCell>
                      <TableCell>
                        {item.aiSuggestedCorrespondenceTypeName || item.aiSuggestedCorrespondenceType || 'Unknown'}
                      </TableCell>
                      <TableCell>{item.issuedDate ? format(new Date(item.issuedDate), 'dd/MM/yyyy') : '—'}</TableCell>
                      <TableCell>
                        {item.receivedDate ? format(new Date(item.receivedDate), 'dd/MM/yyyy') : '—'}
                      </TableCell>
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
                                  : item.aiStatus === 'WAITING'
                                    ? 'secondary'
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* Pagination + row count — เลขหน้ากระโดดข้ามได้ (window ±2 รอบหน้าปัจจุบัน) */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                ทั้งหมด {totalRows} รายการ (หน้า {page}/{totalPages})
              </span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s} / หน้า
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
              >
                ก่อนหน้า
              </Button>
              {getPageNumbers(page, totalPages).map((p, idx) =>
                p === 'ellipsis' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    className="min-w-[36px]"
                    disabled={loading}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(page + 1)}
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
        <p className="text-muted-foreground mt-1">จัดการการนำเข้าเอกสารจากระบบเดิม</p>
      </div>
      {/* D160: ซ่อน AI Migration Logs tab — migration_logs เป็น dead table ตั้งแต่ ADR-023/023A
          เปลี่ยน migration pipeline ไปใช้ BullMQ + migration_review_queue แทน n8n orchestrator
          AiMigrationTab component ยังเก็บไว้เผื่อมีการ revive ในอนาคต แต่ไม่แสดงใน UI */}
      <Suspense>
        <LegacyManagementTab />
      </Suspense>
    </div>
  );
}
