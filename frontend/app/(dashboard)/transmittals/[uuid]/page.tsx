'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTransmittal } from '@/hooks/use-transmittal';
import { useWorkflowHistory } from '@/hooks/use-workflow-history';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, RefreshCw, Printer } from 'lucide-react';
import { IntegratedBanner } from '@/components/workflow/integrated-banner';
import { WorkflowLifecycle } from '@/components/workflow/workflow-lifecycle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function TransmittalDetailPage() {
  const params = useParams();
  const uuid = params.uuid as string;
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);

  const { transmittal, isLoading, error } = useTransmittal(uuid);

  const {
    data: workflowHistory,
    isLoading: historyLoading,
    error: historyError,
  } = useWorkflowHistory(transmittal?.workflowInstanceId);

  const handlePrint = () => {
    toast.info('PDF Export is coming soon...');
    // TODO: Implement PDF download
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !transmittal) {
    return (
      <div className="space-y-4">
        <Link href="/transmittals">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Transmittals
          </Button>
        </Link>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Failed to load transmittal details.
        </div>
      </div>
    );
  }

  const transmittalDocNo = transmittal.correspondence?.correspondenceNumber ?? transmittal.transmittalNo ?? '';
  const transmittalSubject = transmittal.subject ?? '';
  const transmittalStatus = transmittal.workflowInstanceId
    ? (transmittal.workflowState ?? 'SUBMITTED')
    : 'DRAFT';

  return (
    <section className="space-y-4">
      {/* ADR-021: Integrated Banner — wired with live workflow data (v1.8.7) */}
      <IntegratedBanner
        docNo={transmittalDocNo}
        subject={transmittalSubject}
        status={transmittalStatus}
        instanceId={transmittal.workflowInstanceId}
        workflowState={transmittal.workflowState}
        availableActions={transmittal.availableActions}
        pendingAttachmentIds={pendingAttachmentIds}
        isLoading={isLoading}
      />

      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link href="/transmittals">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับ
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
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
          <CardTitle>Transmittal Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Purpose</p>
            <Badge variant="outline">{transmittal.purpose || 'OTHER'}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date</p>
            <p className="font-medium">
              {format(new Date(transmittal.correspondence?.createdAt || transmittal.createdAt), 'dd MMM yyyy')}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Generated From</p>
            {transmittal.correspondence ? (
              <Link
                href={`/correspondences/${transmittal.correspondence.publicId}`}
                className="font-medium text-primary hover:underline"
              >
                {transmittal.correspondence.correspondenceNumber}
              </Link>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
          {transmittal.remarks && (
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Remarks</p>
              <p className="font-medium whitespace-pre-wrap">{transmittal.remarks}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Document ID/No.</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transmittal.items?.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Badge variant="secondary">{item.itemType}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{item.documentNumber || `ID: ${item.itemId}`}</TableCell>
                  <TableCell>{item.description || '-'}</TableCell>
                </TableRow>
              ))}
              {(!transmittal.items || transmittal.items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                    No items in this transmittal
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="workflow">
          {/* ADR-021: WorkflowLifecycle — wired with history data (v1.8.7) */}
          <WorkflowLifecycle
            history={workflowHistory}
            currentState={transmittal.workflowState}
            isLoading={historyLoading}
            error={historyError instanceof Error ? historyError : null}
            onAttachmentsChange={setPendingAttachmentIds}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
