'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { circulationService } from '@/lib/services/circulation.service';
import { UpdateCirculationRoutingDto } from '@/types/circulation';
import { useCirculation, circulationKeys } from '@/hooks/use-circulation';
import { useWorkflowHistory } from '@/hooks/use-workflow-history';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { format, isPast, addDays, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { IntegratedBanner } from '@/components/workflow/integrated-banner';
import { WorkflowLifecycle } from '@/components/workflow/workflow-lifecycle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * EC-CIRC-003: ตรวจสอบว่า deadline เลยกำหนดแล้วหรือไม่ (overdue = วันถัดไปหลัง deadline + 1 วัน)
 */
function isOverdue(deadlineDate?: string): boolean {
  if (!deadlineDate) return false;
  return isPast(addDays(parseISO(deadlineDate), 1));
}

/**
 * Get initials from name
 */
function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0) || '';
  const last = lastName?.charAt(0) || '';
  return (first + last).toUpperCase() || '?';
}

/**
 * Get status badge variant
 */
function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status?.toUpperCase()) {
    case 'PENDING':
      return 'outline';
    case 'IN_PROGRESS':
      return 'default';
    case 'COMPLETED':
      return 'secondary';
    case 'REJECTED':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default function CirculationDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const uuid = params.uuid as string;
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);

  const { circulation, isLoading, error } = useCirculation(uuid);

  const {
    data: workflowHistory,
    isLoading: historyLoading,
    error: historyError,
  } = useWorkflowHistory(circulation?.workflowInstanceId);

  const completeMutation = useMutation({
    mutationFn: ({ routingId, data }: { routingId: number; data: UpdateCirculationRoutingDto }) =>
      circulationService.updateRouting(routingId, data),
    onSuccess: () => {
      toast.success('Task completed successfully');
      queryClient.invalidateQueries({ queryKey: circulationKeys.detail(uuid) });
    },
    onError: () => {
      toast.error('Failed to update task status');
    },
  });

  const handleComplete = (routingId: number) => {
    completeMutation.mutate({
      routingId,
      data: { status: 'COMPLETED', comments: 'Completed via UI' },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !circulation) {
    return (
      <div className="space-y-4">
        <Link href="/circulation">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Circulations
          </Button>
        </Link>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Failed to load circulation details.
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {/* ADR-021: Integrated Banner — wired with live workflow data (v1.8.7) */}
      <IntegratedBanner
        docNo={circulation.circulationNo ?? ''}
        subject={circulation.subject ?? ''}
        status={circulation.statusCode ?? ''}
        instanceId={circulation.workflowInstanceId}
        workflowState={circulation.workflowState}
        availableActions={circulation.availableActions}
        pendingAttachmentIds={pendingAttachmentIds}
        isLoading={isLoading}
      />

      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link href="/circulation">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับ
          </Button>
        </Link>
      </div>

      {/* Tabs — Details / Workflow */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">รายละเอียด</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="space-y-4">

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Circulation Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Organization</p>
            <p className="font-medium">{circulation.organization?.organizationName || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created By</p>
            <p className="font-medium">
              {circulation.creator
                ? `${circulation.creator.firstName || ''} ${circulation.creator.lastName || ''}`.trim() ||
                  circulation.creator.username
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created At</p>
            <p className="font-medium">{format(new Date(circulation.createdAt), 'dd MMM yyyy, HH:mm')}</p>
          </div>
          {circulation.correspondence && (
            <div>
              <p className="text-sm text-muted-foreground">Linked Document</p>
              <Link
                href={`/correspondences/${circulation.correspondence.publicId}`}
                className="font-medium text-primary hover:underline"
              >
                {circulation.correspondence.correspondenceNumber}
              </Link>
            </div>
          )}
          {circulation.deadlineDate && (
            <div>
              <p className="text-sm text-muted-foreground">Deadline</p>
              <p className="font-medium flex items-center gap-1">
                {format(parseISO(circulation.deadlineDate), 'dd MMM yyyy')}
                {isOverdue(circulation.deadlineDate) && (
                  <Badge variant="destructive" className="text-xs ml-1">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Overdue
                  </Badge>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignees/Routings */}
      <Card>
        <CardHeader>
          <CardTitle>Assignees</CardTitle>
        </CardHeader>
        <CardContent>
          {circulation.routings && circulation.routings.length > 0 ? (
            <div className="space-y-3">
              {circulation.routings.map((routing) => (
                <div key={routing.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {getInitials(routing.assignee?.firstName, routing.assignee?.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {routing.assignee
                          ? `${routing.assignee.firstName || ''} ${routing.assignee.lastName || ''}`.trim() ||
                            routing.assignee.username
                          : 'Unassigned'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Step {routing.stepNumber}
                        {routing.comments && ` • ${routing.comments}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(routing.status)}>{routing.status}</Badge>
                    {routing.status === 'PENDING' && (
                      <Button
                        size="sm"
                        onClick={() => handleComplete(routing.id)}
                        disabled={completeMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No assignees found</p>
          )}
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="workflow">
          {/* ADR-021: WorkflowLifecycle — wired with history data (v1.8.7) */}
          <WorkflowLifecycle
            history={workflowHistory}
            currentState={circulation.workflowState}
            isLoading={historyLoading}
            error={historyError instanceof Error ? historyError : null}
            onAttachmentsChange={setPendingAttachmentIds}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
