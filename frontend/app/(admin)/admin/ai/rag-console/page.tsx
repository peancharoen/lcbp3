// File: frontend/app/(admin)/admin/ai/rag-console/page.tsx
// Change Log:
// - 2026-09-10: T024 — สร้าง RAG Admin Console page (single page + 5 tabs — Q23, Q24)

'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRagAdminT } from '@/components/admin/ai/rag-console/rag-admin-i18n';
import { useRagAttachments, useRagClassificationList, useRagClassificationOverride, useRagGenerations, useRagReingest, useRagMetrics, useRagMetricsReset, useRagFailedIngestions, useRagBatchRetry } from '@/hooks/ai/use-rag-admin';
import { RagStatusBadge } from '@/components/admin/ai/rag-console/RagStatusBadge';
import { ClassificationBadge } from '@/components/admin/ai/rag-console/ClassificationBadge';
import { ServiceUnavailableBanner } from '@/components/admin/ai/rag-console/ServiceUnavailableBanner';
import { EmptyState } from '@/components/admin/ai/rag-console/EmptyState';
import { GenerationTimeline } from '@/components/admin/ai/rag-console/GenerationTimeline';
import { MetricsCard } from '@/components/admin/ai/rag-console/MetricsCard';
import { RetryButton } from '@/components/admin/ai/rag-console/RetryButton';
import type {
  RagAdminStatus,
  SecurityClassification,
} from '@/lib/services/admin-rag.service';

/** Tab type */
type RagAdminTab = 'dashboard' | 'classification' | 'lifecycle' | 'metrics' | 'retry';

/**
 * RAG Admin Console — single page + 5 tabs (Q23, Q24)
 * Tabs: Dashboard | Classification | Lifecycle | Metrics | Retry
 */
export default function RagAdminConsolePage() {
  const ragAdminT = useRagAdminT();
  const [activeTab, setActiveTab] = useState<RagAdminTab>('dashboard');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  return (
    <div className="space-y-6">
      <ServiceUnavailableBanner />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{ragAdminT('title')}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RagAdminTab)}>
        <TabsList>
          <TabsTrigger value="dashboard">{ragAdminT('tabs.dashboard')}</TabsTrigger>
          <TabsTrigger value="classification">{ragAdminT('tabs.classification')}</TabsTrigger>
          <TabsTrigger value="lifecycle">{ragAdminT('tabs.lifecycle')}</TabsTrigger>
          <TabsTrigger value="metrics">{ragAdminT('tabs.metrics')}</TabsTrigger>
          <TabsTrigger value="retry">{ragAdminT('tabs.retry')}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        </TabsContent>

        <TabsContent value="classification">
          <ClassificationTab />
        </TabsContent>

        <TabsContent value="lifecycle">
          <LifecycleTab />
        </TabsContent>

        <TabsContent value="metrics">
          <MetricsTab />
        </TabsContent>

        <TabsContent value="retry">
          <RetryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==========================================================
// Dashboard Tab (US1)
// ==========================================================

function DashboardTab({
  statusFilter,
  setStatusFilter,
}: {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
}) {
  const ragAdminT = useRagAdminT();

  const params = {
    ...(statusFilter !== 'all' && { status: statusFilter as RagAdminStatus }),
  };
  const { data, isLoading, refetch, isFetching } = useRagAttachments(params);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={ragAdminT('dashboard.filter_status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ragAdminT('dashboard.all_statuses')}</SelectItem>
            <SelectItem value="NOT_STARTED">{ragAdminT('status.NOT_STARTED')}</SelectItem>
            <SelectItem value="BUILDING">{ragAdminT('status.BUILDING')}</SelectItem>
            <SelectItem value="ACTIVE">{ragAdminT('status.ACTIVE')}</SelectItem>
            <SelectItem value="RETIRED">{ragAdminT('status.RETIRED')}</SelectItem>
            <SelectItem value="FAILED">{ragAdminT('status.FAILED')}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {ragAdminT('dashboard.refresh')}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">{ragAdminT("common.loading")}</div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          titleKey="dashboard.empty_state.no_data"
          suggestionKey="dashboard.empty_state.suggestion"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">{ragAdminT('dashboard.columns.filename')}</th>
                <th className="p-2">{ragAdminT('dashboard.columns.rag_status')}</th>
                <th className="p-2">{ragAdminT('dashboard.columns.ai_processing_status')}</th>
                <th className="p-2">{ragAdminT('dashboard.columns.chunk_count')}</th>
                <th className="p-2">{ragAdminT('dashboard.columns.classification')}</th>
                <th className="p-2">{ragAdminT('dashboard.columns.last_updated')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.attachmentPublicId} className="border-b">
                  <td className="p-2">{item.originalFilename}</td>
                  <td className="p-2">
                    <RagStatusBadge status={item.ragStatus} />
                  </td>
                  <td className="p-2">{item.aiProcessingStatus}</td>
                  <td className="p-2">{item.chunkCount}</td>
                  <td className="p-2">
                    <ClassificationBadge classification={item.effectiveClassification as SecurityClassification} />
                  </td>
                  <td className="p-2">
                    {item.lastUpdated ? new Date(item.lastUpdated).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==========================================================
// Classification Tab (US2) — T030-T033
// ==========================================================

function ClassificationTab() {
  const ragAdminT = useRagAdminT();
  const { data, isLoading } = useRagClassificationList({});
  const overrideMutation = useRagClassificationOverride();
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null);
  const [newClassification, setNewClassification] = useState<SecurityClassification>('PUBLIC');
  const [reason, setReason] = useState('');

  const handleOverride = async () => {
    if (!selectedAttachment || !reason.trim()) return;
    try {
      await overrideMutation.mutateAsync({
        attachmentPublicId: selectedAttachment,
        classification: newClassification,
        reason: reason.trim(),
      });
      setSelectedAttachment(null);
      setReason('');
      setNewClassification('PUBLIC');
    } catch {
      // Error handled by toast (Q50)
    }
  };

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">{ragAdminT("common.loading")}</div>;
  }

  if (!data || data.items.length === 0) {
    return (
      <EmptyState titleKey="classification.empty_state.no_data" />
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">{ragAdminT('dashboard.columns.filename')}</th>
              <th className="p-2">{ragAdminT('classification.current_classification')}</th>
              <th className="p-2">{ragAdminT('dashboard.columns.override')}</th>
              <th className="p-2">{ragAdminT('classification.reason')}</th>
              <th className="p-2">{ragAdminT('classification.override_info.overridden_by')}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr
                key={item.attachmentPublicId}
                className={`border-b cursor-pointer hover:bg-muted/50 ${selectedAttachment === item.attachmentPublicId ? 'bg-muted' : ''}`}
                onClick={() => setSelectedAttachment(item.attachmentPublicId)}
              >
                <td className="p-2">{item.originalFilename}</td>
                <td className="p-2">
                  <ClassificationBadge classification={item.effectiveClassification} />
                </td>
                <td className="p-2">
                  {item.classificationOverride ? (
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.classificationOverride.overriddenAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">
                      {ragAdminT('classification.override_info.no_override')}
                    </span>
                  )}
                </td>
                <td className="p-2">
                  {item.classificationOverride?.reason ?? '-'}
                </td>
                <td className="p-2">
                  {item.classificationOverride?.overriddenBy ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedAttachment && (
        <div className="rounded-md border p-4 space-y-3">
          <h3 className="font-medium">{ragAdminT('classification.title')}</h3>
          <div className="space-y-2">
            <label className="text-sm">{ragAdminT('classification.new_classification')}</label>
            <Select value={newClassification} onValueChange={(v) => setNewClassification(v as SecurityClassification)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">PUBLIC</SelectItem>
                <SelectItem value="INTERNAL">INTERNAL</SelectItem>
                <SelectItem value="CONFIDENTIAL">CONFIDENTIAL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm">{ragAdminT('classification.reason')}</label>
            <textarea
              className="w-full rounded-md border p-2 text-sm"
              placeholder={ragAdminT('classification.reason_placeholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <Button
            onClick={handleOverride}
            disabled={!reason.trim() || overrideMutation.isPending}
          >
            {ragAdminT('classification.submit')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ==========================================================
// Lifecycle Tab (US3) — T041-T042
// ==========================================================

function LifecycleTab() {
  const ragAdminT = useRagAdminT();
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null);
  const { data: attachmentsData } = useRagAttachments({});
  const { data, isLoading } = useRagGenerations(selectedAttachment);
  const reingestMutation = useRagReingest();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleReingest = async () => {
    if (!selectedAttachment) return;
    const idempotencyKey = `reingest-${selectedAttachment}-${Date.now()}`;
    try {
      await reingestMutation.mutateAsync({ attachmentPublicId: selectedAttachment, idempotencyKey });
      setConfirmDialogOpen(false);
    } catch (err: unknown) {
      // 409 Conflict handled by toast (Q50 — mutation errors use toast.error)
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const message = error?.response?.data?.error?.message;
      if (message?.includes('BUILDING')) {
        // Show specific building_in_progress message (Q14, T042)
        // toast.error already called by mutation
      }
      setConfirmDialogOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select
          value={selectedAttachment ?? ''}
          onValueChange={setSelectedAttachment}
        >
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder={ragAdminT('lifecycle.select_attachment')} />
          </SelectTrigger>
          <SelectContent>
            {attachmentsData?.items.map((item) => (
              <SelectItem
                key={item.attachmentPublicId}
                value={item.attachmentPublicId}
              >
                {item.originalFilename}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedAttachment && (
          <Button
            variant="outline"
            onClick={() => setConfirmDialogOpen(true)}
            disabled={reingestMutation.isPending}
          >
            {ragAdminT('lifecycle.force_reingest')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">{ragAdminT("common.loading")}</div>
      ) : !selectedAttachment ? (
        <EmptyState
          titleKey="lifecycle.empty_state.no_generation"
          suggestionKey="lifecycle.empty_state.suggestion"
        />
      ) : !data || data.generations.length === 0 ? (
        <EmptyState
          titleKey="lifecycle.empty_state.no_generation"
          suggestionKey="lifecycle.empty_state.suggestion"
        />
      ) : (
        <GenerationTimeline generations={data.generations} />
      )}

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ragAdminT('lifecycle.force_reingest')}</DialogTitle>
            <DialogDescription>{ragAdminT('lifecycle.confirm_reingest')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              {ragAdminT('common.cancel')}
            </Button>
            <Button onClick={handleReingest} disabled={reingestMutation.isPending}>
              {ragAdminT('lifecycle.force_reingest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================================
// Metrics Tab (US4) — T049
// ==========================================================

function MetricsTab() {
  const ragAdminT = useRagAdminT();
  const { data, isLoading } = useRagMetrics();
  const resetMutation = useRagMetricsReset();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync();
      setConfirmDialogOpen(false);
    } catch {
      // Error handled by toast (Q50)
      setConfirmDialogOpen(false);
    }
  };

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">{ragAdminT("common.loading")}</div>;
  }

  if (!data) {
    return <EmptyState titleKey="metrics.empty_state.no_data" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setConfirmDialogOpen(true)}
          disabled={resetMutation.isPending}
        >
          {ragAdminT('metrics.reset')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricsCard
          titleKey={ragAdminT('metrics.cards.ingestion_duration')}
          value={`${data.ingestionDuration?.count ?? 0}`}
          details={[
            { label: ragAdminT('metrics.labels.sum_ms'), value: data.ingestionDuration?.sumMs ?? 0 },
            { label: ragAdminT('metrics.labels.buckets'), value: JSON.stringify(data.ingestionDuration?.buckets ?? {}) },
          ]}
        />
        <MetricsCard
          titleKey={ragAdminT('metrics.cards.chunk_count')}
          value={`${data.chunkCount?.totalChunks ?? 0}`}
          details={[
            { label: ragAdminT('metrics.labels.ingestions'), value: data.chunkCount?.ingestions ?? 0 },
          ]}
        />
        <MetricsCard
          titleKey={ragAdminT('metrics.cards.vector_latency')}
          value={`${data.vectorLatency?.count ?? 0}`}
          details={[
            { label: ragAdminT('metrics.labels.sum_ms'), value: data.vectorLatency?.sumMs ?? 0 },
          ]}
        />
        <MetricsCard
          titleKey={ragAdminT('metrics.cards.stale_result_rate')}
          value={`${data.staleResultRate?.filtered ?? 0}/${data.staleResultRate?.total ?? 0}`}
          details={[
            { label: ragAdminT('metrics.labels.filtered'), value: data.staleResultRate?.filtered ?? 0 },
            { label: ragAdminT('metrics.labels.total'), value: data.staleResultRate?.total ?? 0 },
          ]}
        />
        <MetricsCard
          titleKey={ragAdminT('metrics.cards.fallback_rate')}
          value={`${data.fallbackRate?.fullTextFallbacks ?? 0}/${data.fallbackRate?.totalQueries ?? 0}`}
          details={[
            { label: ragAdminT('metrics.labels.full_text_fallbacks'), value: data.fallbackRate?.fullTextFallbacks ?? 0 },
            { label: ragAdminT('metrics.labels.total_queries'), value: data.fallbackRate?.totalQueries ?? 0 },
          ]}
        />
        <MetricsCard
          titleKey={ragAdminT('metrics.cards.cleanup_retry_rate')}
          value={`${data.cleanupRetryRate?.retries ?? 0}`}
          details={[
            { label: ragAdminT('metrics.labels.retries'), value: data.cleanupRetryRate?.retries ?? 0 },
          ]}
        />
      </div>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ragAdminT('metrics.reset')}</DialogTitle>
            <DialogDescription>{ragAdminT('metrics.confirm_reset')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              {ragAdminT('common.cancel')}
            </Button>
            <Button onClick={handleReset} disabled={resetMutation.isPending}>
              {ragAdminT('metrics.reset')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================================
// Retry Tab (US5) — T060
// ==========================================================

function RetryTab() {
  const ragAdminT = useRagAdminT();
  const { data, isLoading } = useRagFailedIngestions({});
  const batchRetryMutation = useRagBatchRetry();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [partialSuccess, setPartialSuccess] = useState<{ succeeded: number; failed: number } | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchRetry = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const idempotencyKey = `batch-retry-${Date.now()}`;
    try {
      const result = await batchRetryMutation.mutateAsync({
        attachmentPublicIds: ids,
        idempotencyKey,
      });
      setPartialSuccess({
        succeeded: result.totalSucceeded,
        failed: result.totalFailed,
      });
      setSelectedIds(new Set());
    } catch {
      // Error handled by toast (Q50)
    }
  };

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">{ragAdminT("common.loading")}</div>;
  }

  if (!data || (data.ragFailures.items.length === 0 && data.aiPipelineFailures.items.length === 0)) {
    return <EmptyState titleKey="retry.empty_state.no_failures" />;
  }

  return (
    <div className="space-y-6">
      {partialSuccess && (
        <div className="rounded-md border border-blue-500/50 bg-blue-500/10 p-3 text-sm">
          {ragAdminT('retry.partial_success', {
            succeeded: partialSuccess.succeeded,
            failed: partialSuccess.failed,
          })}
        </div>
      )}

      {/* Section 1: RAG failures (paginated, with retry) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{ragAdminT('retry.rag_failures')}</h3>
          {data.ragFailures.items.length > 0 && (
            <RetryButton
              selectedCount={selectedIds.size}
              isPending={batchRetryMutation.isPending}
              onClick={handleBatchRetry}
            />
          )}
        </div>

        {data.ragFailures.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{ragAdminT('retry.empty_state.no_failures')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2 w-8">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(data.ragFailures.items.map((i) => i.attachmentPublicId)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="p-2">{ragAdminT('retry.columns.filename')}</th>
                  <th className="p-2">{ragAdminT('retry.columns.error_code')}</th>
                  <th className="p-2">{ragAdminT('retry.columns.error_message')}</th>
                  <th className="p-2">{ragAdminT('retry.columns.failed_at')}</th>
                </tr>
              </thead>
              <tbody>
                {data.ragFailures.items.map((item) => (
                  <tr key={item.attachmentPublicId} className="border-b">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.attachmentPublicId)}
                        onChange={() => toggleSelect(item.attachmentPublicId)}
                      />
                    </td>
                    <td className="p-2">{item.originalFilename}</td>
                    <td className="p-2">{item.errorCode ?? '-'}</td>
                    <td className="p-2">{item.errorMessage ?? '-'}</td>
                    <td className="p-2">
                      {item.failedAt ? new Date(item.failedAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: AI pipeline failures (read-only, no retry — Q32) */}
      <div className="space-y-3">
        <h3 className="font-medium">{ragAdminT('retry.ai_pipeline_failures')}</h3>
        {data.aiPipelineFailures.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{ragAdminT('retry.empty_state.no_failures')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">{ragAdminT('retry.columns.filename')}</th>
                  <th className="p-2">{ragAdminT('retry.columns.status')}</th>
                </tr>
              </thead>
              <tbody>
                {data.aiPipelineFailures.items.map((item) => (
                  <tr key={item.attachmentPublicId} className="border-b">
                    <td className="p-2">{item.originalFilename}</td>
                    <td className="p-2">{item.aiProcessingStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
