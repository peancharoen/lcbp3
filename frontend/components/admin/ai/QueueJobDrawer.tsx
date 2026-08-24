// File: frontend/components/admin/ai/QueueJobDrawer.tsx
// Change Log:
// - 2026-08-24: สร้าง QueueJobDrawer สำหรับดู BullMQ jobs และ Clear Failed (T016/T019)

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from '@/hooks/use-translations';
import { adminAiQueueService, QueueJobItem } from '@/lib/services/admin-ai-queue.service';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, RotateCcw, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

interface QueueJobDrawerProps {
  queueName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** คิวทีรองรับใน AI Engine Control Center */
const AI_QUEUES: string[] = [
  'ai-realtime',
  'ai-batch',
  'ai-ingest',
  'ai-rag',
  'ai-vector-deletion',
];

/** Tabs สำหรับกรองสถานะงาน */
const STATUS_TABS: { key: string; value: string | 'all' }[] = [
  { key: 'ai.queue.tab.all', value: 'all' },
  { key: 'ai.queue.tab.failed', value: 'failed' },
  { key: 'ai.queue.tab.active', value: 'active' },
  { key: 'ai.queue.tab.waiting', value: 'waiting' },
];

/**
* ดึงข้อความผิดพลาดจาก error object ของ axios interceptor
*/
function getErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  const err = error as {
    error?: { message?: string; userMessage?: string };
    message?: string;
  };
  return err.error?.message ?? err.error?.userMessage ?? err.message ?? 'Unknown error';
}

/**
* แปลง timestamp เป็นรูปแบบไทยที่อ่านง่าย
*/
function formatTimestamp(value: number | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('th-TH', { hour12: false });
}

/**
* คืนสี Badge ตามสถานะงาน
*/
function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' {
  switch (status) {
    case 'active':
      return 'default';
    case 'waiting':
      return 'secondary';
    case 'delayed':
      return 'outline';
    case 'completed':
      return 'success';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default function QueueJobDrawer({ queueName, open, onOpenChange }: QueueJobDrawerProps) {
  const t = useTranslations();
  const [selectedQueue, setSelectedQueue] = useState<string>(queueName);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [clearJobId, setClearJobId] = useState<string | null>(null);

  // รีเซ็ตคิวเมื่อเปิด drawer จากค่า props ใหม่
  useEffect(() => {
    if (open) {
      setSelectedQueue(queueName);
      setActiveTab('all');
      setPage(1);
      setClearJobId(null);
    }
  }, [open, queueName]);

  // รีเซ็ตหน้าเมื่อเปลี่ยน tab หรือคิว
  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedQueue]);

  const {
    data: queueData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['ai', 'queue-jobs', selectedQueue, activeTab, page],
    queryFn: async () => adminAiQueueService.getQueueJobs(selectedQueue, activeTab, page, 20),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  const { data: clearStatus } = useQuery({
    queryKey: ['ai', 'clear-failed', selectedQueue, clearJobId],
    queryFn: async () => {
      if (!clearJobId) return null;
      return adminAiQueueService.getClearFailedStatus(selectedQueue, clearJobId);
    },
    enabled: !!clearJobId,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d && (d.status === 'queued' || d.status === 'processing')) return 2000;
      return false;
    },
  });

  // อัปเดต toast ตามสถานะ clear-failed
  useEffect(() => {
    if (!clearStatus || !clearJobId) return;
    if (clearStatus.status === 'completed') {
      toast.success(
        t('ai.queue.clearFailed.toast.success', {
          cleared: String(clearStatus.clearedCount ?? 0),
          remaining: String(clearStatus.remainingFailed ?? 0),
        }),
        { id: clearJobId }
      );
      void refetch();
      setClearJobId(null);
    } else if (clearStatus.status === 'failed') {
      toast.error(clearStatus.error ?? t('ai.queue.clearFailed.toast.error'), { id: clearJobId });
      setClearJobId(null);
    }
  }, [clearStatus, clearJobId, refetch, t]);

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => adminAiQueueService.retryJob(selectedQueue, jobId),
    onSuccess: () => {
      toast.success(t('ai.queue.action.retry.success'));
      void refetch();
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => adminAiQueueService.deleteJob(selectedQueue, jobId),
    onSuccess: () => {
      toast.success(t('ai.queue.action.delete.success'));
      void refetch();
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const onClearFailed = async (): Promise<void> => {
    try {
      const result = await adminAiQueueService.clearFailedJobs(selectedQueue);
      setClearJobId(result.jobId);
      toast.loading(t('ai.queue.clearFailed.toast.started'), { id: result.jobId });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const jobs: QueueJobItem[] = queueData?.jobs ?? [];
  const totalPages = queueData?.totalPages ?? 1;
  const currentQueueLabel = useMemo(
    () => t('ai.queue.drawer.title', { queueName: selectedQueue }),
    [selectedQueue, t]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-base">{currentQueueLabel}</SheetTitle>
          <SheetDescription>{t('ai.queue.drawer.description')}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Select value={selectedQueue} onValueChange={setSelectedQueue}>
              <SelectTrigger className="w-full sm:w-[220px]" aria-label={t('ai.queue.select.label')}>
                <SelectValue placeholder={t('ai.queue.select.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {AI_QUEUES.map((q) => (
                  <SelectItem key={q} value={q}>
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  {STATUS_TABS.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {t(tab.key)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={!!clearJobId}
                    className="gap-1"
                    aria-label={t('ai.queue.clearFailed.button')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('ai.queue.clearFailed.button')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      {t('ai.queue.clearFailed.confirmTitle')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('ai.queue.clearFailed.confirmDescription', { queueName: selectedQueue })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('ai.queue.action.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={onClearFailed}>
                      {t('ai.queue.clearFailed.confirmAction')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-260px)] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">{t('ai.queue.loading')}</span>
              </div>
            ) : jobs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t('ai.queue.empty')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">{t('ai.queue.column.id')}</TableHead>
                    <TableHead>{t('ai.queue.column.type')}</TableHead>
                    <TableHead>{t('ai.queue.column.status')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('ai.queue.column.created')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('ai.queue.column.finished')}</TableHead>
                    <TableHead className="w-[100px]">{t('ai.queue.column.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="py-2 px-3 text-xs font-mono truncate max-w-[120px]">
                        {job.id}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-xs">{job.jobType}</TableCell>
                      <TableCell className="py-2 px-3">
                        <Badge variant={getStatusBadgeVariant(job.status)} className="text-[10px]">
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {formatTimestamp(job.createdAt)}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {formatTimestamp(job.finishedOn)}
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          {job.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => retryMutation.mutate(job.id)}
                              disabled={retryMutation.isPending}
                              title={t('ai.queue.action.retry.label')}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (window.confirm(t('ai.queue.action.delete.confirm', { jobId: job.id }))) {
                                deleteMutation.mutate(job.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            title={t('ai.queue.action.delete.label')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('ai.queue.pagination.info', { page: String(page), total: String(totalPages) })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
