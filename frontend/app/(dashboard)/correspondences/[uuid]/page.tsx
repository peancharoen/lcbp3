'use client';

import { useState } from 'react';
import { CorrespondenceDetail } from '@/components/correspondences/detail';
import { IntegratedBanner } from '@/components/workflow/integrated-banner';
import { WorkflowLifecycle } from '@/components/workflow/workflow-lifecycle';
import { FilePreviewModal } from '@/components/common/file-preview-modal';
import { WorkflowErrorBoundary } from '@/components/common/workflow-error-boundary';
import { useCorrespondence, useWorkflowHistory } from '@/hooks/use-correspondence';
import { Loader2 } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Correspondence } from '@/types/correspondence';
import type { WorkflowAttachmentSummary } from '@/types/workflow';

export default function CorrespondenceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const uuid = (params?.uuid as string) ?? '';
  const selectedRevisionId = searchParams.get('revId') ?? undefined;

  // Hooks ทั้งหมดต้องเรียกก่อน early return (Rules of Hooks)
  const { data: correspondence, isLoading, isError } = useCorrespondence(uuid);
  const corrData = correspondence as Correspondence | undefined;

  // ADR-021: ดึงประวัติ Workflow (disabled อัตโนมัติถ้าไม่มี workflowInstanceId)
  const { data: wfHistory, isLoading: wfLoading, error: wfError } = useWorkflowHistory(
    corrData?.workflowInstanceId
  );

  // ADR-021 US4: state สำหรับ FilePreviewModal
  const [previewFile, setPreviewFile] = useState<WorkflowAttachmentSummary | null>(null);
  // ADR-021 T029: publicIds ของไฟล์ที่อัปโหลดใน WorkflowLifecycle Upload Zone
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);
  // ADR-021 T041: ติดตาม publicIds ที่ Storage แจ้ง 404
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const handleUnavailable = (publicId: string) =>
    setUnavailableIds((prev) => [...new Set([...prev, publicId])]);

  if (!uuid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-xl font-bold text-red-500">Invalid Correspondence UUID</h1>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex bg-muted/20 min-h-screen justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError || !correspondence) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-xl font-bold text-red-500">Failed to load correspondence</h1>
        <p>Please try again later or verify the UUID.</p>
      </div>
    );
  }

  // ดึง Current Revision สำหรับแสดงใน Banner
  const currentRevision = corrData!.revisions?.find((r) => r.isCurrent) ?? corrData!.revisions?.[0];
  const docNo = corrData!.correspondenceNumber ?? '';
  const subject = currentRevision?.subject ?? '';
  const status = currentRevision?.status?.statusCode ?? '';

  return (
    <div className="space-y-4">
      {/* ADR-021: Integrated Banner — เลขเอกสาร + สถานะ + ปุ่ม Action */}
      <IntegratedBanner
        docNo={docNo}
        subject={subject}
        status={status}
        priority={correspondence.priority}
        workflowState={correspondence.workflowState}
        availableActions={correspondence.availableActions}
        instanceId={corrData!.workflowInstanceId}
        pendingAttachmentIds={pendingAttachmentIds}
      />

      {/* Tabs — Details / Workflow (WorkflowLifecycle ถูกเพิ่มใน T020) */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">รายละเอียด</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <CorrespondenceDetail data={correspondence} selectedRevisionId={selectedRevisionId} />
        </TabsContent>
        <TabsContent value="workflow">
          <WorkflowErrorBoundary>
            <WorkflowLifecycle
              history={wfHistory}
              currentState={corrData?.workflowState}
              isLoading={wfLoading}
              error={wfError instanceof Error ? wfError : null}
              onFileClick={setPreviewFile}
              onAttachmentsChange={setPendingAttachmentIds}
              unavailableAttachmentIds={unavailableIds}
            />
          </WorkflowErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* ADR-021 US4: File Preview Modal */}
      <WorkflowErrorBoundary fallback={null}>
        <FilePreviewModal
          attachment={previewFile}
          onClose={() => setPreviewFile(null)}
          onUnavailable={handleUnavailable}
        />
      </WorkflowErrorBoundary>
    </div>
  );
}
