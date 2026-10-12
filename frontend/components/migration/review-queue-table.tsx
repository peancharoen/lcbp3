// File: components/migration/review-queue-table.tsx
// Change Log:
// - 2026-09-24: แสดงเลขเอกสารฐาน + revision badge ผ่าน QueueDocNumber —
//   queue document_number เป็น staging key ตั้งแต่ revision-chain import
// - 2026-09-14: T023 (ADR-054) — compareResult ย้ายลง details (ai_metadata_json);
//   badge อ่าน mismatch count ผ่าน getCompareResult helper แทน top-level read ที่ always-undefined
// - 2026-09-15: ADR-054 review fold — เพิ่ม OCR backup indicator (hasOcrTextBak)
//   ใน status cell พร้อม i18n keys (has_ocr_backup*)
// - 2026-08-31: T032/T033/T034 — เพิ่ม requiresHumanReview badge, OCR quality indicator, needs-review filter, sort-by-OCR-quality, legacy re-extract (ADR-050)
// - 2026-05-22: Initial creation of ReviewQueueTable component for US2 (T024)
// - 2026-05-22: Integrated hybrid identifiers and Radix Sheet panel with zero blank lines inside function bodies (T024)

import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useCommitMigrationReview,
  useRejectMigrationReview,
  useStartExtractQueueItem,
} from '@/hooks/use-migration-review';
import { useProjects, useOrganizations } from '@/hooks/use-master-data';
import { MigrationReviewQueueItem, MigrationReviewStatus, CompareStatus, CompareResult } from '@/types/migration';
import {
  Loader2,
  Calendar,
  Tag,
  AlertCircle,
  Edit,
  Check,
  X,
  Plus,
  GitCompare,
  RefreshCw,
  ShieldAlert,
  History,
} from 'lucide-react';
import { QueueDocNumber } from '@/components/migration/queue-doc-number';
import { getQueueBaseDocNumber, getQueueRevisionLabel } from '@/lib/utils/queue-doc-number';
import aiMessages from '@/public/locales/th/ai.json';

/** ADR-050: i18n helper สำหรับ migration_review namespace จาก ai.json */
const migrationReviewT = (key: string): string => {
  const parts = key.split('.');
  let current: unknown = (aiMessages as Record<string, unknown>).migration_review;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : key;
};

interface ReviewTag {
  name?: string;
  tagName?: string;
  is_new?: boolean;
  isNew?: boolean;
}

interface ProjectOption {
  publicId: string;
  projectName: string;
  projectCode?: string;
}

interface OrganizationOption {
  publicId: string;
  organizationName: string;
}

const getStringField = (value: Record<string, unknown>, key: string): string | undefined =>
  typeof value[key] === 'string' ? value[key] : undefined;

const toReviewTag = (value: Record<string, unknown>): ReviewTag => ({
  name: getStringField(value, 'name'),
  tagName: getStringField(value, 'tagName'),
  is_new: typeof value.is_new === 'boolean' ? value.is_new : undefined,
  isNew: typeof value.isNew === 'boolean' ? value.isNew : undefined,
});

const getTagLabel = (tag: Record<string, unknown>): string =>
  getStringField(tag, 'name') ?? getStringField(tag, 'tagName') ?? '';

const getIssueText = (issue: Record<string, unknown>): string =>
  getStringField(issue, 'description') ?? getStringField(issue, 'message') ?? '';

/** ADR-054 (T023): ดึง compareResult จาก details อย่างปลอดภัย
 *  (AI output ใน ai_metadata_json — ไม่ใช่ top-level field ของ item อีกต่อไป) */
const getCompareResult = (item: MigrationReviewQueueItem): CompareResult | undefined => {
  if (!item.details || typeof item.details !== 'object') return undefined;
  const compareResult = (item.details as Record<string, unknown>).compareResult;
  if (!compareResult || typeof compareResult !== 'object') return undefined;
  return compareResult as CompareResult;
};

/** ADR-050 (T034): ตรวจสอบ legacy item — details ไม่มี metadata.confidence (pre-refactor shape) */
const isLegacyItem = (item: MigrationReviewQueueItem): boolean => {
  if (!item.details || typeof item.details !== 'object') return true;
  const details = item.details as Record<string, unknown>;
  const metadata = details.metadata;
  if (!metadata || typeof metadata !== 'object') return true;
  const confidence = (metadata as Record<string, unknown>).confidence;
  return !confidence || typeof confidence !== 'object';
};

interface ReviewQueueTableProps {
  items: MigrationReviewQueueItem[];
  isLoading: boolean;
}

export function ReviewQueueTable({ items, isLoading }: ReviewQueueTableProps) {
  const [selectedItem, setSelectedItem] = useState<MigrationReviewQueueItem | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editProjectId, setEditProjectId] = useState<string>('');
  const [editSenderId, setEditSenderId] = useState<string>('');
  const [editReceiverId, setEditReceiverId] = useState<string>('');
  const [editIssuedDate, setEditIssuedDate] = useState('');
  const [editReceivedDate, setEditReceivedDate] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  // T033: needs-review filter + sort-by-OCR-quality state
  const [needsReviewFilter, setNeedsReviewFilter] = useState(false);
  const [sortByOcrQuality, setSortByOcrQuality] = useState<'none' | 'asc' | 'desc'>('none');
  const commitMutation = useCommitMigrationReview();
  const rejectMutation = useRejectMigrationReview();
  const extractMutation = useStartExtractQueueItem();
  const { data: projects = [] } = useProjects();
  const { data: organizations = [] } = useOrganizations();
  const projectOptions = projects as ProjectOption[];
  const organizationOptions = organizations as OrganizationOption[];
  // T033: compute filtered + sorted items for display
  const displayItems = useMemo(() => {
    let result = items;
    if (needsReviewFilter) {
      result = result.filter((item) => item.requiresHumanReview === true);
    }
    if (sortByOcrQuality !== 'none') {
      const sorted = [...result].sort((a, b) => {
        const aConf = a.ocrQualityConfidence ?? -1;
        const bConf = b.ocrQualityConfidence ?? -1;
        return sortByOcrQuality === 'asc' ? aConf - bConf : bConf - aConf;
      });
      result = sorted;
    }
    return result;
  }, [items, needsReviewFilter, sortByOcrQuality]);
  const handleOpenReview = (item: MigrationReviewQueueItem) => {
    setSelectedItem(item);
    setEditSubject(item.subject || item.title || '');
    setEditCategory(item.aiSuggestedCorrespondenceType || 'Correspondence');
    setEditProjectId(String(item.projectId || ''));
    setEditSenderId(String(item.senderOrganizationId || ''));
    setEditReceiverId(String(item.receiverOrganizationId || ''));
    setEditIssuedDate(item.issuedDate ? item.issuedDate.substring(0, 10) : '');
    setEditReceivedDate(item.receivedDate ? item.receivedDate.substring(0, 10) : '');
    setEditBody(item.body || '');
    const tags = Array.isArray(item.extractedTags)
      ? item.extractedTags.map((tag) => getTagLabel(tag)).filter(Boolean)
      : [];
    setEditTags(tags);
    setNewTagInput('');
    setIsSheetOpen(true);
  };
  const handleAddTag = () => {
    if (newTagInput.trim() && !editTags.includes(newTagInput.trim())) {
      setEditTags([...editTags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };
  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter((t) => t !== tagToRemove));
  };
  const handleCommit = async () => {
    if (!selectedItem) return;
    try {
      const idempotencyKey = `migration_review_${selectedItem.publicId}_${Date.now()}`;
      await commitMutation.mutateAsync({
        publicId: selectedItem.publicId,
        idempotencyKey,
        subject: editSubject,
        correspondenceType: editCategory,
        projectId: editProjectId || undefined,
        senderId: editSenderId || undefined,
        receiverId: editReceiverId || undefined,
        issuedDate: editIssuedDate || undefined,
        receivedDate: editReceivedDate || undefined,
        tags: editTags,
        body: editBody || undefined,
      });
      setIsSheetOpen(false);
      setSelectedItem(null);
    } catch {
      return;
    }
  };
  const handleReject = async () => {
    if (!selectedItem) return;
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการปฏิเสธเอกสารนี้?')) {
      try {
        const queueIntId = selectedItem.id || 0;
        await rejectMutation.mutateAsync(queueIntId);
        setIsSheetOpen(false);
        setSelectedItem(null);
      } catch {
        return;
      }
    }
  };
  // T034: เริ่มดึงข้อมูล OCR/AI ใหม่สำหรับ legacy item
  const handleReExtract = async (publicId: string) => {
    const idempotencyKey = `migration_extract_${publicId}_${Date.now()}`;
    try {
      await extractMutation.mutateAsync({ publicId, idempotencyKey });
    } catch {
      return;
    }
  };
  const getStatusBadge = (status: MigrationReviewStatus) => {
    const configs: Record<MigrationReviewStatus, { label: string; className: string }> = {
      [MigrationReviewStatus.PENDING]: {
        label: 'รอตรวจสอบ',
        className: 'bg-warning/20 text-warning border-warning/30',
      },
      [MigrationReviewStatus.PENDING_REVIEW]: {
        label: 'รอ Review OCR',
        className: 'bg-info/20 text-info border-info/30',
      },
      [MigrationReviewStatus.REJECTED]: {
        label: 'ปฏิเสธ',
        className: 'bg-destructive/20 text-destructive border-destructive/30',
      },
      [MigrationReviewStatus.IMPORTED]: {
        label: 'นำเข้าแล้ว',
        className: 'bg-success/20 text-success border-success/30',
      },
    };
    const config = configs[status] || { label: status, className: '' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };
  /** Feature 242: ป้ายสถานะการเปรียบเทียบทะเบียนกับเอกสารจริง (FR-012c) */
  const getCompareStatusBadge = (compareStatus?: CompareStatus, mismatchCount?: number) => {
    if (!compareStatus) return <span className="text-xs text-muted-foreground">—</span>;
    if (compareStatus === CompareStatus.UNAVAILABLE) {
      return (
        <Badge variant="outline" className="border-caution/30 bg-caution/5 text-caution">
          <GitCompare className="mr-1 h-3 w-3" />
          ไม่สามารถเปรียบเทียบ
        </Badge>
      );
    }
    if (mismatchCount === undefined) {
      return (
        <Badge variant="outline" className="border-info/30 bg-info/5 text-info">
          <GitCompare className="mr-1 h-3 w-3" />
          เปรียบเทียบแล้ว
        </Badge>
      );
    }
    if (mismatchCount === 0) {
      return (
        <Badge variant="outline" className="border-success/30 bg-success/5 text-success">
          <GitCompare className="mr-1 h-3 w-3" />
          ตรงทั้งหมด
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/5 text-destructive">
        <GitCompare className="mr-1 h-3 w-3" />
        ไม่ตรง {mismatchCount} ช่อง
      </Badge>
    );
  };
  /** T032: แสดง OCR quality confidence indicator (ADR-050) */
  const getOcrQualityConfidenceDisplay = (item: MigrationReviewQueueItem) => {
    if (item.ocrQualityConfidence === null || item.ocrQualityConfidence === undefined) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    const pct = `${(Number(item.ocrQualityConfidence) * 100).toFixed(1)}%`;
    const conf = Number(item.ocrQualityConfidence);
    let className = 'text-success';
    if (conf < 0.5) {
      className = 'text-destructive';
    } else if (conf < 0.75) {
      className = 'text-warning';
    }
    return (
      <span
        className={`font-mono text-sm font-semibold ${className}`}
        title={migrationReviewT('ocr_quality_confidence')}
      >
        {pct}
      </span>
    );
  };
  /** T032: แสดง requiresHumanReview badge (visually distinct — ADR-050) */
  const getRequiresHumanReviewBadge = (item: MigrationReviewQueueItem) => {
    if (!item.requiresHumanReview) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <Badge
        data-testid="requires-human-review-badge"
        className="animate-pulse border-destructive/30 bg-destructive/20 text-destructive"
      >
        <ShieldAlert className="mr-1 h-3 w-3" />
        {migrationReviewT('requires_human_review_badge')}
      </Badge>
    );
  };
  return (
    <div className="w-full">
      {/* T033: needs-review filter + sort-by-OCR-quality controls */}
      <div className="mb-3 flex items-center justify-between gap-4 px-1">
        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={needsReviewFilter}
            onChange={(e) => setNeedsReviewFilter(e.target.checked)}
            data-testid="needs-review-filter"
            className="h-4 w-4 rounded border-input"
          />
          <span className="text-sm font-medium">{migrationReviewT('requires_human_review_badge')}</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{migrationReviewT('ocr_quality_confidence')}:</span>
          <Select
            value={sortByOcrQuality}
            onValueChange={(value: string) => setSortByOcrQuality(value as 'none' | 'asc' | 'desc')}
          >
            <SelectTrigger className="h-8 w-[160px]" data-testid="sort-ocr-quality">
              <SelectValue placeholder={migrationReviewT('sort_none')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{migrationReviewT('sort_none')}</SelectItem>
              <SelectItem value="asc">{migrationReviewT('sort_asc')}</SelectItem>
              <SelectItem value="desc">{migrationReviewT('sort_desc')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">เลขที่เอกสาร</TableHead>
              <TableHead>หัวข้อเอกสาร (Subject)</TableHead>
              <TableHead className="w-[120px]">หมวดหมู่ AI</TableHead>
              <TableHead className="w-[100px] text-center">ความมั่นใจ AI</TableHead>
              <TableHead className="w-[100px] text-center">{migrationReviewT('ocr_quality_title')}</TableHead>
              <TableHead className="w-[120px] text-center">การเปรียบเทียบ</TableHead>
              <TableHead className="w-[110px] text-center">{migrationReviewT('requires_human_review_badge')}</TableHead>
              <TableHead className="w-[120px]">สถานะ</TableHead>
              <TableHead className="w-[100px] text-right">การกระทำ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">กำลังโหลดรายการรอรีวิว...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : displayItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  ไม่พบรายการที่รอตรวจสอบในคิวขณะนี้
                </TableCell>
              </TableRow>
            ) : (
              displayItems.map((item) => {
                // T034: legacy items (details lacks metadata.confidence) → re-extract required state
                if (isLegacyItem(item)) {
                  return (
                    <TableRow key={item.publicId} className="bg-warning/5 transition-colors hover:bg-muted/50">
                      <TableCell className="font-mono text-sm font-semibold">
                        <QueueDocNumber item={item} revisionPrefix={migrationReviewT('revision_badge')} />
                      </TableCell>
                      <TableCell className="max-w-md truncate font-medium">
                        {item.subject || item.title || 'ไม่มีหัวข้อ'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="opacity-60">
                          {item.aiSuggestedCorrespondenceType || 'Correspondence'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {item.aiConfidence ? `${(Number(item.aiConfidence) * 100).toFixed(1)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs italic text-muted-foreground">—</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs italic text-muted-foreground">—</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="border-warning/30 bg-warning/20 text-warning">
                          <RefreshCw className="mr-1 h-3 w-3" />
                          {migrationReviewT('legacy_reextract_badge')}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReExtract(item.publicId)}
                          disabled={extractMutation.isPending}
                          data-testid={`re-extract-${item.publicId}`}
                          className="inline-flex items-center space-x-1"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${extractMutation.isPending ? 'animate-spin' : ''}`} />
                          <span>{migrationReviewT('legacy_reextract_button')}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }
                return (
                  <TableRow key={item.publicId} className="transition-colors hover:bg-muted/50">
                    <TableCell className="font-mono text-sm font-semibold">
                      <QueueDocNumber item={item} revisionPrefix={migrationReviewT('revision_badge')} />
                    </TableCell>
                    <TableCell className="max-w-md truncate font-medium">
                      {item.subject || item.title || 'ไม่มีหัวข้อ'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.aiSuggestedCorrespondenceType || 'Correspondence'}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {item.aiConfidence ? `${(Number(item.aiConfidence) * 100).toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-center">{getOcrQualityConfidenceDisplay(item)}</TableCell>
                    <TableCell className="text-center">
                      {getCompareStatusBadge(item.compareStatus, getCompareResult(item)?.mismatches.length)}
                    </TableCell>
                    <TableCell className="text-center">{getRequiresHumanReviewBadge(item)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getStatusBadge(item.status)}
                        {/* ADR-054: มี OCR text สำรอง (ocr_text_bak) — กู้คืนได้ในหน้า detail */}
                        {item.hasOcrTextBak && (
                          <Badge
                            variant="secondary"
                            className="text-xs"
                            title={migrationReviewT('has_ocr_backup_tooltip')}
                          >
                            <History className="mr-1 h-3 w-3" />
                            {migrationReviewT('has_ocr_backup')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={item.status === MigrationReviewStatus.PENDING ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleOpenReview(item)}
                        className="inline-flex items-center space-x-1"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>{item.status === MigrationReviewStatus.PENDING ? 'รีวิว' : 'ดูรายละเอียด'}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[650px] overflow-y-auto border-l bg-background p-6 shadow-2xl sm:max-w-2xl">
          <SheetHeader className="mb-6 border-b pb-4">
            <SheetTitle className="flex items-center space-x-2 text-xl font-bold">
              <span>รีวิวการย้ายข้อมูลเอกสาร</span>
              <Badge variant="outline" className="font-mono text-xs">
                {selectedItem ? getQueueBaseDocNumber(selectedItem) : ''}
                {selectedItem && getQueueRevisionLabel(selectedItem) !== undefined
                  ? ` · ${migrationReviewT('revision_badge')} ${getQueueRevisionLabel(selectedItem)}`
                  : ''}
              </Badge>
            </SheetTitle>
            <SheetDescription>
              ตรวจสอบ แก้ไขข้อมูล Metadata และยืนยันความถูกต้องเพื่อนำข้อมูลเข้าสู่ระบบจดหมายโต้ตอบจริง
            </SheetDescription>
          </SheetHeader>

          {selectedItem && (
            <div className="space-y-6">
              {selectedItem.aiIssues && selectedItem.aiIssues.length > 0 && (
                <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  <div className="flex items-center space-x-2 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    <span>ข้อควรระวังจากการตรวจสอบของ AI:</span>
                  </div>
                  <ul className="list-disc space-y-1 pl-5">
                    {selectedItem.aiIssues.map((issue, idx: number) => (
                      <li key={idx}>{getIssueText(issue)}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-sm font-semibold">
                    หัวข้อเรื่อง (Subject)
                  </Label>
                  <Input
                    id="subject"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="ป้อนหัวข้อเรื่องภาษาไทยหรืออังกฤษ"
                    className="w-full border-input"
                  />
                  {selectedItem.originalSubject && selectedItem.originalSubject !== editSubject && (
                    <p className="text-xs italic text-muted-foreground">
                      หัวข้อเดิมที่ AI ดึงได้: {selectedItem.originalSubject}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-semibold">
                      หมวดหมู่เอกสาร
                    </Label>
                    <Select value={editCategory} onValueChange={setEditCategory}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="เลือกหมวดหมู่" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Correspondence">Correspondence (LETTER)</SelectItem>
                        <SelectItem value="RFA">RFA</SelectItem>
                        <SelectItem value="Drawing">Drawing (OTHER)</SelectItem>
                        <SelectItem value="Report">Report (OTHER)</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project" className="text-sm font-semibold">
                      โครงการ (Project)
                    </Label>
                    <Select value={editProjectId} onValueChange={setEditProjectId}>
                      <SelectTrigger id="project">
                        <SelectValue placeholder="เลือกโครงการ" />
                      </SelectTrigger>
                      <SelectContent>
                        {projectOptions.map((proj) => (
                          <SelectItem key={proj.publicId} value={proj.publicId}>
                            {proj.projectName} ({proj.projectCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sender" className="text-sm font-semibold">
                      องค์กรผู้ส่ง (Sender)
                    </Label>
                    <Select value={editSenderId} onValueChange={setEditSenderId}>
                      <SelectTrigger id="sender">
                        <SelectValue placeholder="เลือกองค์กรผู้ส่ง" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizationOptions.map((org) => (
                          <SelectItem key={org.publicId} value={org.publicId}>
                            {org.organizationName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receiver" className="text-sm font-semibold">
                      องค์กรผู้รับ (Receiver)
                    </Label>
                    <Select value={editReceiverId} onValueChange={setEditReceiverId}>
                      <SelectTrigger id="receiver">
                        <SelectValue placeholder="เลือกองค์กรผู้รับ" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizationOptions.map((org) => (
                          <SelectItem key={org.publicId} value={org.publicId}>
                            {org.organizationName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issuedDate" className="flex items-center space-x-1 text-sm font-semibold">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>วันที่ออกเอกสาร (Issued Date)</span>
                    </Label>
                    <Input
                      id="issuedDate"
                      type="date"
                      value={editIssuedDate}
                      onChange={(e) => setEditIssuedDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receivedDate" className="flex items-center space-x-1 text-sm font-semibold">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>วันที่ลงรับเอกสาร (Received Date)</span>
                    </Label>
                    <Input
                      id="receivedDate"
                      type="date"
                      value={editReceivedDate}
                      onChange={(e) => setEditReceivedDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body" className="text-sm font-semibold">
                    เนื้อหาสรุปจดหมาย (Body)
                  </Label>
                  <Textarea
                    id="body"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    placeholder="ป้อนเนื้อความย่อของจดหมาย"
                    rows={4}
                    className="w-full resize-y border-input font-sans text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center space-x-1 text-sm font-semibold">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span>แท็กภาษาไทยที่แนะนำ (Tags)</span>
                  </Label>
                  <div className="flex min-h-[50px] flex-wrap gap-2 rounded-md border bg-muted/40 p-3">
                    {editTags.map((tag) => {
                      const origItem = Array.isArray(selectedItem.extractedTags)
                        ? selectedItem.extractedTags
                            .map((item) => toReviewTag(item))
                            .find((item) => (item.name || item.tagName) === tag)
                        : null;
                      const isNew = origItem?.is_new || origItem?.isNew;
                      return (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className={`flex items-center space-x-1 pr-1 font-sans ${isNew ? 'border-success/30 bg-success/20 text-success' : 'bg-secondary'}`}
                        >
                          <span>{tag}</span>
                          <button onClick={() => handleRemoveTag(tag)} className="rounded-full p-0.5 hover:bg-muted">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                    {editTags.length === 0 && (
                      <span className="flex items-center text-xs italic text-muted-foreground">ไม่มีแท็ก</span>
                    )}
                  </div>
                  <div className="mt-2 flex space-x-2">
                    <Input
                      placeholder="เพิ่มแท็กภาษาไทย..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="h-8 max-w-[200px] text-xs"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleAddTag} className="h-8">
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      <span>เพิ่ม</span>
                    </Button>
                  </div>
                </div>
              </div>

              {selectedItem.status === MigrationReviewStatus.PENDING_REVIEW && (
                <SheetFooter className="mt-6 flex justify-between border-t pt-4 sm:justify-between">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={commitMutation.isPending || rejectMutation.isPending}
                    className="inline-flex items-center space-x-1"
                  >
                    <X className="h-4 w-4" />
                    <span>ปฏิเสธการนำเข้า (Reject)</span>
                  </Button>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsSheetOpen(false)}
                      disabled={commitMutation.isPending || rejectMutation.isPending}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCommit}
                      disabled={commitMutation.isPending || rejectMutation.isPending}
                      className="inline-flex items-center space-x-1"
                    >
                      {commitMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span>กดยอมรับการนำเข้า (Commit)</span>
                    </Button>
                  </div>
                </SheetFooter>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
