'use client';

import { Correspondence } from '@/types/correspondence';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ArrowLeft, Download, FileText, Loader2, Send, CheckCircle, XCircle, Edit, Ban, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useSubmitCorrespondence, useProcessWorkflow, useCancelCorrespondence } from '@/hooks/use-correspondence';
import { ReferenceSelector } from '@/components/correspondences/reference-selector';
import { TagManager } from '@/components/correspondences/tag-manager';
import { CirculationStatusCard } from '@/components/correspondences/circulation-status-card';
import { RevisionHistory } from '@/components/correspondences/revision-history';
import { Can } from '@/components/common/can';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface CorrespondenceDetailProps {
  data: Correspondence;
  selectedRevisionId?: string;
}

const normalizeUuid = (value?: string): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
};

export function CorrespondenceDetail({ data, selectedRevisionId }: CorrespondenceDetailProps) {
  const submitMutation = useSubmitCorrespondence();
  const processMutation = useProcessWorkflow();
  const cancelMutation = useCancelCorrespondence();
  const { user, hasPermission } = useAuthStore();
  const [actionState, setActionState] = useState<'approve' | 'reject' | 'cancel' | null>(null);
  const [comments, setComments] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  if (!data) return <div>No data found</div>;

  const normalizedSelectedRevisionId = normalizeUuid(selectedRevisionId);
  const selectedRevision = normalizedSelectedRevisionId
    ? data.revisions?.find((r) => normalizeUuid(r.publicId) === normalizedSelectedRevisionId)
    : undefined;
  const currentRevision = selectedRevision || data.revisions?.find((r) => r.isCurrent) || data.revisions?.[0];
  const subject = currentRevision?.subject || '-';
  const description = currentRevision?.description || '-';
  const status = currentRevision?.status?.statusCode || 'UNKNOWN';
  const attachments = currentRevision?.attachments || [];
  const importance = (currentRevision?.details?.importance as string) || 'NORMAL';
  const canEditMetadata = hasPermission('correspondence.edit');
  const privilegedEditableStatuses = ['SUBCSC', 'SUBOWN', 'IN_REVIEW_CSC'];
  const normalizedRole = (user?.role || '').toUpperCase().replace(/\s+/g, '_');
  const isPrivilegedEditRole = ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN', 'DC', 'DOCUMENT_CONTROL'].includes(
    normalizedRole
  );
  const canEditInStatus =
    status === 'DRAFT' ||
    (privilegedEditableStatuses.includes(status) && isPrivilegedEditRole);
  const canEditDocument = canEditInStatus && (hasPermission('correspondence.edit') || isPrivilegedEditRole);

  const toRecipients = data.recipients?.filter((r) => r.recipientType === 'TO') || [];
  const ccRecipients = data.recipients?.filter((r) => r.recipientType === 'CC') || [];

  const handleSubmit = () => {
    if (confirm('Are you sure you want to submit this correspondence?')) {
      submitMutation.mutate({ uuid: data.publicId, data: {} });
    }
  };

  const handleProcess = () => {
    if (!actionState || actionState === 'cancel') return;
    const action = actionState === 'approve' ? 'APPROVE' : 'REJECT';
    processMutation.mutate(
      { uuid: data.publicId, data: { action, comments } },
      { onSuccess: () => { setActionState(null); setComments(''); } }
    );
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) return;
    cancelMutation.mutate(
      { uuid: data.publicId, reason: cancelReason },
      { onSuccess: () => { setActionState(null); setCancelReason(''); } }
    );
  };

  return (
    <div className="space-y-6">
      {/* EC-CORR-002 Warning: Replying to cancelled document */}
      {status === 'CANCELLED' && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-md">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">This correspondence has been cancelled</p>
            <p className="text-sm text-amber-700 mt-0.5">
              You can still create a new correspondence referencing this document to acknowledge the cancellation.
            </p>
          </div>
        </div>
      )}

      {/* Header / Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/correspondences">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{data.correspondenceNumber}</h1>
            <p className="text-muted-foreground">
              Created on {data.createdAt ? format(new Date(data.createdAt), 'dd MMM yyyy HH:mm') : '-'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEditDocument && (
            <Link href={`/correspondences/${data.publicId}/edit${selectedRevisionId ? `?revId=${selectedRevisionId}` : ''}`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          )}
          {status === 'DRAFT' && (
            <Can permission="correspondence.submit">
              <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
                {submitMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit for Review
              </Button>
            </Can>
          )}
          {status === 'IN_REVIEW' && (
            <Can permission="workflow.action_review">
              <>
                <Button variant="destructive" onClick={() => setActionState('reject')}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => setActionState('approve')}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            </Can>
          )}
          {status !== 'CANCELLED' && (
            <Can permission="correspondence.delete">
              <Button
                variant="outline"
                className="text-destructive border-destructive hover:bg-destructive/10"
                onClick={() => setActionState('cancel')}
              >
                <Ban className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </Can>
          )}
        </div>
      </div>

      {/* Approve / Reject Input Area */}
      {(actionState === 'approve' || actionState === 'reject') && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg">
              {actionState === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Comments</Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Enter comments..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setActionState(null)}>
                Back
              </Button>
              <Button
                variant={actionState === 'approve' ? 'default' : 'destructive'}
                onClick={handleProcess}
                disabled={processMutation.isPending}
                className={actionState === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {processMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm {actionState === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel Confirmation (EC-CORR-001) */}
      {actionState === 'cancel' && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-lg text-destructive flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Cancel Correspondence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-amber-800">
                Cancelling will permanently change this document&apos;s status and force-close any active circulations
                linked to it. This action cannot be undone.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reason for Cancellation <span className="text-destructive">*</span></Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setActionState(null); setCancelReason(''); }}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={cancelMutation.isPending || !cancelReason.trim()}
              >
                {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Cancellation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{subject}</CardTitle>
                <StatusBadge status={status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {description && description !== '-' && (
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{description}</p>
                </div>
              )}
              {currentRevision?.body && (
                <div>
                  <h3 className="font-semibold mb-2">Content</h3>
                  <div className="text-gray-700 whitespace-pre-wrap p-3 bg-muted/10 rounded-md border">
                    {currentRevision.body}
                  </div>
                </div>
              )}
              {currentRevision?.remarks && (
                <div>
                  <h3 className="font-semibold mb-2">Remarks</h3>
                  <p className="text-gray-600 italic">{currentRevision.remarks}</p>
                </div>
              )}

              <hr className="my-4 border-t" />

              <div>
                <h3 className="font-semibold mb-3">Attachments</h3>
                {attachments.length > 0 ? (
                  <div className="grid gap-2">
                    {attachments.map((file, index) => (
                      <div
                        key={file.publicId || index}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="text-sm font-medium">{file.name}</span>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No attachments found.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Core Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">Importance</p>
                <span
                  className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${importance === 'URGENT' ? 'bg-red-100 text-red-800'
                      : importance === 'HIGH' ? 'bg-orange-100 text-orange-800'
                      : 'bg-blue-100 text-blue-800'}`}
                >
                  {String(importance)}
                </span>
              </div>

              <div>
                <p className="font-medium text-muted-foreground">Document Type</p>
                <p className="mt-1">{data.type?.typeName || '-'} <span className="text-xs text-muted-foreground">({data.type?.typeCode || '-'})</span></p>
              </div>

              <hr />

              <div>
                <p className="font-medium text-muted-foreground">Originator (From)</p>
                <p className="font-semibold mt-1">{data.originator?.organizationName || '-'}</p>
                <p className="text-xs text-muted-foreground">{data.originator?.organizationCode}</p>
              </div>

              <div>
                <p className="font-medium text-muted-foreground">To</p>
                {toRecipients.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {toRecipients.map((r) => (
                      <div key={r.recipientOrganizationId}>
                        <p className="font-semibold">{r.recipientOrganization?.organizationName || '-'}</p>
                        <p className="text-xs text-muted-foreground">{r.recipientOrganization?.organizationCode}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground">-</p>
                )}
              </div>

              {ccRecipients.length > 0 && (
                <div>
                  <p className="font-medium text-muted-foreground">CC</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ccRecipients.map((r) => (
                      <Badge key={r.recipientOrganizationId} variant="secondary" className="text-xs">
                        {r.recipientOrganization?.organizationCode || '-'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <hr />

              <div>
                <p className="font-medium text-muted-foreground">Project</p>
                <p className="font-semibold mt-1">{data.project?.projectName || '-'}</p>
                <p className="text-xs text-muted-foreground">{data.project?.projectCode}</p>
              </div>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(
                [
                  { label: 'Document Date', value: currentRevision?.documentDate },
                  { label: 'Issued Date', value: currentRevision?.issuedDate },
                  { label: 'Received Date', value: currentRevision?.receivedDate },
                  { label: 'Due Date', value: currentRevision?.dueDate },
                ] as { label: string; value?: string }[]
              ).map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-medium ${label === 'Due Date' && value && new Date(value) < new Date() && status !== 'CANCELLED' ? 'text-destructive' : ''}`}>
                    {value ? format(new Date(value), 'dd MMM yyyy') : '-'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Circulations */}
          <CirculationStatusCard correspondenceUuid={data.publicId} />

          {/* Tags */}
          <TagManager
            uuid={data.publicId}
            canEdit={status !== 'CANCELLED' && canEditMetadata}
          />

          {/* References */}
          <ReferenceSelector
            uuid={data.publicId}
            canEdit={status !== 'CANCELLED' && canEditMetadata}
          />

          {/* Revision History */}
          {data.revisions && data.revisions.length > 0 && (
            <RevisionHistory revisions={data.revisions} />
          )}
        </div>
      </div>
    </div>
  );
}
