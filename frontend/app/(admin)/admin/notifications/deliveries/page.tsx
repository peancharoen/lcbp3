// File: frontend/app/(admin)/admin/notifications/deliveries/page.tsx
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US4, T057) — admin delivery audit list (FR-009/FR-019)
'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/data-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/types/api-error';

import { useNotificationDeliveries } from '@/hooks/use-notification-admin';
import { NotificationDelivery } from '@/lib/services/notification-admin.service';

const STATUS_VARIANT: Record<NotificationDelivery['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SENT: 'default',
  PENDING: 'secondary',
  FAILED: 'destructive',
  SKIPPED: 'outline',
};

export default function NotificationDeliveriesPage() {
  const [status, setStatus] = useState<string>('all');
  const [target, setTarget] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading, isError, error } = useNotificationDeliveries({
    channelType: 'TELEGRAM',
    status: status === 'all' ? undefined : status,
    target: target || undefined,
    page,
    limit,
  });

  const items = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const columns: ColumnDef<NotificationDelivery>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Time',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleString('th-TH')}
        </span>
      ),
    },
    {
      accessorKey: 'eventType',
      header: 'Event',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.eventType}</span>,
    },
    {
      accessorKey: 'target',
      header: 'Target',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.target}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>,
    },
    {
      accessorKey: 'attemptCount',
      header: 'Attempts',
    },
    {
      id: 'error',
      header: 'Error',
      cell: ({ row }) =>
        row.original.errorCode ? (
          <span className="text-xs text-destructive" title={row.original.errorMessage}>
            {row.original.errorCode}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Notification Deliveries</h1>
        <p className="text-muted-foreground mt-1">Telegram send-attempt audit trail</p>
      </div>

      <div className="flex gap-4 items-center bg-muted/30 p-4 rounded-lg">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by target chat ID..."
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setPage(1);
            }}
            className="pl-8 bg-background"
          />
        </div>
        <div className="w-[180px]">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="SKIPPED">Skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {getApiErrorMessage(error, 'Failed to load deliveries')}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable columns={columns} data={items} />
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} deliveries — page {page} / {totalPages}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
