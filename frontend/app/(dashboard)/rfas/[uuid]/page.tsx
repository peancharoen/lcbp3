'use client';

import { useState } from 'react';
import { RFADetail } from '@/components/rfas/detail';
import { IntegratedBanner } from '@/components/workflow/integrated-banner';
import { WorkflowLifecycle } from '@/components/workflow/workflow-lifecycle';
import { FilePreviewModal } from '@/components/common/file-preview-modal';
import { WorkflowErrorBoundary } from '@/components/common/workflow-error-boundary';
import { notFound, useParams } from 'next/navigation';
import { useRFA, useWorkflowHistory } from '@/hooks/use-rfa';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { RFA } from '@/types/rfa';
import type { WorkflowAttachmentSummary } from '@/types/workflow';

export default function RFADetailPage() {
  const { uuid } = useParams();
  const uuidStr = uuid ? String(uuid) : '';

  // Hooks ทั้งหมดต้องเรียกก่อน early return (Rules of Hooks)
  const { data: rfa, isLoading, isError } = useRFA(uuidStr);
  const rfaData = rfa as RFA | undefined;

  // ADR-021: ดึงประวัติ Workflow (disabled อัตโนมัติถ้าไม่มี workflowInstanceId)
  const { data: wfHistory, isLoading: wfLoading, error: wfError } = useWorkflowHistory(
    rfaData?.workflowInstanceId
  );

  // ADR-021 US4: state สำหรับ FilePreviewModal
  const [previewFile, setPreviewFile] = useState<WorkflowAttachmentSummary | null>(null);
  // ADR-021 T029: publicIds ของไฟล์ที่อัปโหลดใน WorkflowLifecycle Upload Zone
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);
  // ADR-021 T041: ติดตาม publicIds ที่ Storage แจ้ง  404
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const handleUnavailable = (publicId: string) =>
    setUnavailableIds((prev) => [...new Set([...prev, publicId])]);

  if (!uuid) notFound();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError || !rfaData) {
    return <div className="text-center py-20 text-red-500">RFA not found or failed to load.</div>;
  }

  // ดึง Current Revision สำหรับแสดงใน Banner
  const currentRevision = rfaData.revisions?.find((r) => r.isCurrent) ?? rfaData.revisions?.[0];
  const docNo = rfaData.correspondence?.correspondenceNumber ?? rfaData.correspondenceNumber ?? '';
  const subject = currentRevision?.subject ?? '';
  const status = currentRevision?.statusCode?.statusCode ?? '';

  return (
    <div className="space-y-4">
      {/* ADR-021: Integrated Banner — เลขเอกสาร + สถานะ + ปุ่ม Action */}
      <IntegratedBanner
        docNo={docNo}
        subject={subject}
        status={status}
        priority={rfa.priority}
        workflowState={rfa.workflowState}
        availableActions={rfa.availableActions}
        instanceId={rfaData.workflowInstanceId}
        pendingAttachmentIds={pendingAttachmentIds}
      />

      {/* Tabs — Details / Workflow (WorkflowLifecycle ถูกเพิ่มใน T019) */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">รายละเอียด</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <RFADetail data={rfa} />
        </TabsContent>
        <TabsContent value="workflow">
          <WorkflowErrorBoundary>
            <WorkflowLifecycle
              history={wfHistory}
              currentState={rfaData.workflowState}
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
