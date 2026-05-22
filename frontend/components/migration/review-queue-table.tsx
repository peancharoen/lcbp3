// File: components/migration/review-queue-table.tsx
// Change Log:
// - 2026-05-22: Initial creation of ReviewQueueTable component for US2 (T024)
// - 2026-05-22: Integrated hybrid identifiers and Radix Sheet panel with zero blank lines inside function bodies (T024)

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCommitMigrationReview, useRejectMigrationReview } from '@/hooks/use-migration-review';
import { useProjects, useOrganizations } from '@/hooks/use-master-data';
import { MigrationReviewQueueItem, MigrationReviewStatus } from '@/types/migration';
import { Loader2, Calendar, Tag, AlertCircle, Edit, Check, X, Plus } from 'lucide-react';

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
  const commitMutation = useCommitMigrationReview();
  const rejectMutation = useRejectMigrationReview();
  const { data: projects = [] } = useProjects();
  const { data: organizations = [] } = useOrganizations();
  const projectOptions = projects as ProjectOption[];
  const organizationOptions = organizations as OrganizationOption[];
  const handleOpenReview = (item: MigrationReviewQueueItem) => {
    setSelectedItem(item);
    setEditSubject(item.subject || item.title || '');
    setEditCategory(item.aiSuggestedCategory || 'Correspondence');
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
        category: editCategory,
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
  const getStatusBadge = (status: MigrationReviewStatus) => {
    const configs: Record<MigrationReviewStatus, { label: string; className: string }> = {
      [MigrationReviewStatus.PENDING]: {
        label: 'รอตรวจสอบ',
        className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      },
      [MigrationReviewStatus.APPROVED]: {
        label: 'อนุมัติแล้ว',
        className: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      },
      [MigrationReviewStatus.REJECTED]: {
        label: 'ปฏิเสธ',
        className: 'bg-red-500/20 text-red-500 border-red-500/30',
      },
      [MigrationReviewStatus.IMPORTED]: {
        label: 'นำเข้าแล้ว',
        className: 'bg-green-500/20 text-green-500 border-green-500/30',
      },
    };
    const config = configs[status] || { label: status, className: '' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };
  return (
    <div className="w-full">
      <div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">เลขที่เอกสาร</TableHead>
              <TableHead>หัวข้อเอกสาร (Subject)</TableHead>
              <TableHead className="w-[120px]">หมวดหมู่ AI</TableHead>
              <TableHead className="w-[100px] text-center">ความมั่นใจ AI</TableHead>
              <TableHead className="w-[120px]">สถานะ</TableHead>
              <TableHead className="w-[100px] text-right">การกระทำ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">กำลังโหลดรายการรอรีวิว...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  ไม่พบรายการที่รอตรวจสอบในคิวขณะนี้
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.publicId} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-mono text-sm font-semibold">{item.documentNumber}</TableCell>
                  <TableCell className="max-w-md truncate font-medium">
                    {item.subject || item.title || 'ไม่มีหัวข้อ'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.aiSuggestedCategory || 'Correspondence'}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {item.aiConfidence ? `${(Number(item.aiConfidence) * 100).toFixed(1)}%` : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto w-[650px] p-6 bg-background border-l shadow-2xl">
          <SheetHeader className="mb-6 border-b pb-4">
            <SheetTitle className="text-xl font-bold flex items-center space-x-2">
              <span>รีวิวการย้ายข้อมูลเอกสาร</span>
              <Badge variant="outline" className="font-mono text-xs">
                {selectedItem?.documentNumber}
              </Badge>
            </SheetTitle>
            <SheetDescription>
              ตรวจสอบ แก้ไขข้อมูล Metadata และยืนยันความถูกต้องเพื่อนำข้อมูลเข้าสู่ระบบจดหมายโต้ตอบจริง
            </SheetDescription>
          </SheetHeader>

          {selectedItem && (
            <div className="space-y-6">
              {selectedItem.aiIssues && selectedItem.aiIssues.length > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500 space-y-2">
                  <div className="flex items-center space-x-2 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    <span>ข้อควรระวังจากการตรวจสอบของ AI:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedItem.aiIssues.map((issue, idx: number) => (
                      <li key={idx}>
                        {getIssueText(issue)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-sm font-semibold">หัวข้อเรื่อง (Subject)</Label>
                  <Input
                    id="subject"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="ป้อนหัวข้อเรื่องภาษาไทยหรืออังกฤษ"
                    className="w-full border-input"
                  />
                  {selectedItem.originalSubject && selectedItem.originalSubject !== editSubject && (
                    <p className="text-xs text-muted-foreground italic">
                      หัวข้อเดิมที่ AI ดึงได้: {selectedItem.originalSubject}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-semibold">หมวดหมู่เอกสาร</Label>
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
                    <Label htmlFor="project" className="text-sm font-semibold">โครงการ (Project)</Label>
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
                    <Label htmlFor="sender" className="text-sm font-semibold">องค์กรผู้ส่ง (Sender)</Label>
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
                    <Label htmlFor="receiver" className="text-sm font-semibold">องค์กรผู้รับ (Receiver)</Label>
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
                    <Label htmlFor="issuedDate" className="text-sm font-semibold flex items-center space-x-1">
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
                    <Label htmlFor="receivedDate" className="text-sm font-semibold flex items-center space-x-1">
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
                  <Label htmlFor="body" className="text-sm font-semibold">เนื้อหาสรุปจดหมาย (Body)</Label>
                  <Textarea
                    id="body"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    placeholder="ป้อนเนื้อความย่อของจดหมาย"
                    rows={4}
                    className="w-full border-input font-sans text-sm resize-y"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center space-x-1">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span>แท็กภาษาไทยที่แนะนำ (Tags)</span>
                  </Label>
                  <div className="flex flex-wrap gap-2 p-3 bg-muted/40 rounded-md border min-h-[50px]">
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
                          className={`flex items-center space-x-1 pr-1 font-sans ${isNew ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' : 'bg-secondary'}`}
                        >
                          <span>{tag}</span>
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:bg-muted rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                    {editTags.length === 0 && (
                      <span className="text-xs text-muted-foreground italic flex items-center">
                        ไม่มีแท็ก
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2 mt-2">
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
                      className="h-8 text-xs max-w-[200px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTag}
                      className="h-8"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      <span>เพิ่ม</span>
                    </Button>
                  </div>
                </div>
              </div>

              {selectedItem.status === MigrationReviewStatus.PENDING && (
                <SheetFooter className="border-t pt-4 mt-6 flex justify-between sm:justify-between">
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
