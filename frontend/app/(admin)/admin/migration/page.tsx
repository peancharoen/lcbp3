'use client';

import { useEffect, useState, useCallback } from 'react';
import { aiService } from '@/lib/services/ai.service';
import { migrationService } from '@/lib/services/migration.service';
import { AiMigrationLog, AiMigrationLogStatus } from '@/types/ai';
import { MigrationReviewQueueItem, MigrationReviewStatus } from '@/types/migration';
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

// --- Legacy Queue Tab (ระบบ Migration เดิม) ---

function LegacyQueueTab() {
  const [items, setItems] = useState<MigrationReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await migrationService.getReviewQueue({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as MigrationReviewStatus),
        limit: 50,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      setSelectedIds([]);
    } catch (error: unknown) {
      setItems([]);
      setErrorMessage(getApiErrorMessage(error, 'Failed to load queue'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id).filter((id): id is number => id !== undefined));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      setSubmitting(true);
      const batchItems = items
        .filter((i): i is typeof i & { id: number } => i.id !== undefined)
        .filter((i) => selectedIds.includes(i.id))
        .map((item) => ({
          queueId: item.id,
          dto: {
            document_number: item.documentNumber,
            subject: item.title || item.originalTitle || 'Untitled',
            category: item.aiSuggestedCategory || 'Correspondence',
            project_id: item.projectId || 1,
            migrated_by: 'SYSTEM_IMPORT',
            temp_attachment_id: item.tempAttachmentId,
            ai_confidence: item.aiConfidence,
            ai_issues: item.aiIssues,
            issued_date: item.issuedDate,
            received_date: item.receivedDate,
            sender_id: item.senderOrganizationId,
            receiver_id: item.receiverOrganizationId,
            details: { tags: item.extractedTags },
          },
        }));
      const batchId = `BATCH_UI_${Date.now()}`;
      await migrationService.commitBatch({ items: batchItems, batchId }, batchId);
      await fetchData();
    } catch (_error) {
      toast.error('Batch commit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap justify-between items-center gap-4">
          <CardTitle>Legacy Review Queue - {statusFilter}</CardTitle>
          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <Button variant="default" onClick={handleBatchApprove} disabled={submitting}>
                <CheckCircleIcon className="mr-2 h-4 w-4" />
                {submitting ? 'Processing...' : `Batch Approve (${selectedIds.length})`}
              </Button>
            )}
            <Link href="/admin/migration/errors">
              <Button variant="outline">
                <FileXIcon className="mr-2 h-4 w-4" /> View Errors
              </Button>
            </Link>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
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
          <div className="py-10 text-center">Loading queue...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">No items in the queue.</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={items.length > 0 && selectedIds.length === items.length}
                      onCheckedChange={handleToggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Document No.</TableHead>
                  <TableHead>Suggested Category</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id ?? item.publicId}>
                    <TableCell>
                      <Checkbox
                        checked={item.id !== undefined && selectedIds.includes(item.id)}
                        onCheckedChange={() => item.id !== undefined && handleToggleSelect(item.id)}
                        aria-label={`Select item ${item.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.documentNumber}</TableCell>
                    <TableCell>{item.aiSuggestedCategory || 'Unknown'}</TableCell>
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
                          item.status === 'PENDING'
                            ? 'outline'
                            : item.status === 'APPROVED'
                              ? 'default'
                              : 'destructive'
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(item.createdAt), 'dd MMM yyyy, HH:mm')}</TableCell>
                    <TableCell className="text-right">
                      {item.id !== undefined && (
                        <Link href={`/admin/migration/review/${item.id}`}>
                          <Button size="sm" variant="ghost">
                            <EyeIcon className="h-4 w-4 mr-2" /> Review
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
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
          <TabsTrigger value="legacy">Legacy Queue</TabsTrigger>
        </TabsList>
        <TabsContent value="ai">
          <AiMigrationTab />
        </TabsContent>
        <TabsContent value="legacy">
          <LegacyQueueTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
