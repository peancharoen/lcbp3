'use client';

import type { RFA, RFAItem } from '@/types/rfa';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Send, Edit } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProcessRFA, useSubmitRFA } from '@/hooks/use-rfa';
import { ReviewTeamSelector } from '@/components/review-team/ReviewTeamSelector';

interface RFADetailProps {
  data: RFA;
}

export function RFADetail({ data }: RFADetailProps) {
  const [actionState, setActionState] = useState<'approve' | 'reject' | 'submit' | null>(null);
  const [comments, setComments] = useState('');
  const [templateId, setTemplateId] = useState<number>(1);
  const [reviewTeamPublicId, setReviewTeamPublicId] = useState<string | undefined>(undefined);
  const processMutation = useProcessRFA();
  const submitMutation = useSubmitRFA();
  const currentRevision = data.revisions.find((revision) => revision.isCurrent) ?? data.revisions[0];
  const currentItems = currentRevision?.items ?? [];
  const currentStatus = currentRevision?.statusCode?.statusName || currentRevision?.statusCode?.statusCode || 'Unknown';
  const createdAt = data.correspondence?.createdAt || currentRevision?.createdAt;

  const getDrawingNumber = (item: RFAItem) =>
    item.shopDrawingRevision?.shopDrawing?.drawingNumber ||
    item.asBuiltDrawingRevision?.asBuiltDrawing?.drawingNumber ||
    '-';

  const getRevisionLabel = (item: RFAItem) => {
    if (item.shopDrawingRevision?.revisionLabel) {
      return item.shopDrawingRevision.revisionLabel;
    }

    if (item.shopDrawingRevision?.revisionNumber !== undefined) {
      return String(item.shopDrawingRevision.revisionNumber);
    }

    if (item.asBuiltDrawingRevision?.revisionLabel) {
      return item.asBuiltDrawingRevision.revisionLabel;
    }

    if (item.asBuiltDrawingRevision?.revisionNumber !== undefined) {
      return String(item.asBuiltDrawingRevision.revisionNumber);
    }

    return '-';
  };

  const getRevisionTitle = (item: RFAItem) =>
    item.shopDrawingRevision?.title || item.asBuiltDrawingRevision?.title || '-';

  const handleProcess = () => {
    if (!actionState || actionState === 'submit') return;

    const apiAction = actionState === 'approve' ? 'APPROVE' : 'REJECT';

    processMutation.mutate(
      {
        uuid: data.publicId,
        data: {
          action: apiAction,
          comments: comments,
        },
      },
      {
        onSuccess: () => {
          setActionState(null);
          setComments('');
        },
      }
    );
  };

  const handleSubmit = () => {
    submitMutation.mutate(
      {
        uuid: data.publicId,
        data: {
          templateId,
          reviewTeamPublicId,
        },
      },
      {
        onSuccess: () => {
          setActionState(null);
          setReviewTeamPublicId(undefined);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header / Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/rfas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{data.correspondence?.correspondenceNumber || 'RFA'}</h1>
            {createdAt && (
              <p className="text-muted-foreground">Created on {format(new Date(createdAt), 'dd MMM yyyy HH:mm')}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {currentRevision?.statusCode?.statusCode === 'DFT' && (
            <>
              <Link href={`/rfas/${data.publicId}/edit`}>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <Button onClick={() => setActionState('submit')}>
                <Send className="mr-2 h-4 w-4" />
                Submit RFA
              </Button>
            </>
          )}
        </div>
        {['FAP', 'FRE'].includes(currentRevision?.statusCode?.statusCode ?? '') && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setActionState('reject')}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setActionState('approve')}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>
        )}
      </div>

      {/* Submit RFA Dialog */}
      {actionState === 'submit' && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg">Submit RFA to Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="templateId">Routing Template ID</Label>
              <input
                id="templateId"
                type="number"
                min={1}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={templateId}
                onChange={(e) => setTemplateId(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Enter the routing template ID for this submission.</p>
            </div>
            {data.correspondence?.project?.publicId && (
              <ReviewTeamSelector
                projectPublicId={data.correspondence.project.publicId}
                value={reviewTeamPublicId}
                onChange={setReviewTeamPublicId}
                disabled={submitMutation.isPending}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setActionState(null)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
                {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Input Area */}
      {actionState && actionState !== 'submit' && (
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
                Cancel
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{currentRevision?.subject || 'Untitled RFA'}</CardTitle>
                <StatusBadge status={currentStatus} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {currentRevision?.description || 'No description provided.'}
                </p>
              </div>

              <hr className="my-4 border-t" />

              <div>
                <h3 className="font-semibold mb-3">RFA Items</h3>
                {currentItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No drawing items linked to this RFA.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Type</th>
                          <th className="px-4 py-3 text-left font-medium">Drawing No.</th>
                          <th className="px-4 py-3 text-left font-medium">Revision</th>
                          <th className="px-4 py-3 text-left font-medium">Title</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {currentItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-medium">{item.itemType}</td>
                            <td className="px-4 py-3">{getDrawingNumber(item)}</td>
                            <td className="px-4 py-3">{getRevisionLabel(item)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{getRevisionTitle(item)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Project</p>
                <p className="font-medium mt-1">{data.correspondence?.project?.projectName || '-'}</p>
              </div>

              <hr className="my-4 border-t" />

              <div>
                <p className="text-sm font-medium text-muted-foreground">Discipline</p>
                <p className="font-medium mt-1">
                  {data.correspondence?.discipline?.codeNameEn ||
                    data.correspondence?.discipline?.codeNameTh ||
                    data.correspondence?.discipline?.disciplineCode ||
                    '-'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
