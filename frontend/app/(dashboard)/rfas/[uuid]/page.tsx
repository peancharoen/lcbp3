'use client';

import { useState } from 'react';
import { RFADetail } from '@/components/rfas/detail';
import { IntegratedBanner } from '@/components/workflow/integrated-banner';
import { WorkflowLifecycle } from '@/components/workflow/workflow-lifecycle';
import { FilePreviewModal } from '@/components/common/file-preview-modal';
import { WorkflowErrorBoundary } from '@/components/common/workflow-error-boundary';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useRFA, useWorkflowHistory } from '@/hooks/use-rfa';
import { Loader2, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  DocumentMetadataEditDialog,
  type MetadataField,
} from '@/components/documents/document-metadata-edit-dialog';
import { DocumentHardDeleteDialog } from '@/components/documents/document-hard-delete-dialog';
import { DocumentCancelDialog } from '@/components/documents/document-cancel-dialog';
import { getDocumentActionConfig } from '@/components/documents/document-action-strategy';
import { useDocumentActions } from '@/hooks/use-document-actions';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/hooks/use-translations';
import type { RFA } from '@/types/rfa';
import type { WorkflowAttachmentSummary } from '@/types/workflow';
import { AiChatToggle } from '@/components/ai/ai-chat-toggle';
import { AiChatPanel } from '@/components/ai/ai-chat-panel';

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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const handleUnavailable = (publicId: string) =>
    setUnavailableIds((prev) => [...new Set([...prev, publicId])]);

  // Feature 253 T062: Metadata Edit Dialog
  const [showMetaEdit, setShowMetaEdit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const t = useTranslations();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const rfaActionConfig = getDocumentActionConfig('RFA');
  const router = useRouter();
  const { metadataPatch, isPatching, hardDelete, isHardDeleting, cancel, isCancelling } = useDocumentActions({
    config: rfaActionConfig,
    onSuccess: (action) => {
      if (action === 'hardDelete') router.push('/rfas');
    },
  });
  // Feature 253 T073: Hard-Delete Dialog (Superadmin / rfa.delete)
  const [showHardDelete, setShowHardDelete] = useState(false);
  const canHardDelete = hasPermission('system.manage_all') || hasPermission('rfa.delete');
  const canCancel = hasPermission('rfa.cancel') || hasPermission('document.cancel') || hasPermission('system.manage_all');

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

  // Feature 253: metadata fields สำหรับ Edit Dialog
  const canEditMetadata = hasPermission('rfa.edit') && status !== 'CC';
  const metaFields: MetadataField[] = [
    { key: 'subject', label: 'Subject', value: currentRevision?.subject ?? '', tier: 1 },
    { key: 'description', label: 'Description', value: currentRevision?.description ?? '', tier: 1 },
    { key: 'remarks', label: 'Remarks', value: currentRevision?.remarks ?? '', tier: 1 },
  ];

  return (
    <div className={`relative transition-all duration-300 ${isChatOpen ? 'lg:pr-[400px]' : ''}`}>
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

      {/* Feature 253: Cancel + Edit Metadata + Hard-Delete actions (permission-gated) */}
      {(canEditMetadata || canHardDelete || canCancel) && (
        <div className="flex justify-end gap-2">
          {canCancel && (
            <Button variant="outline" size="sm" onClick={() => setShowCancel(true)}>
              {t('document.action.cancel')}
            </Button>
          )}
          {canEditMetadata && (
            <Button variant="outline" size="sm" onClick={() => setShowMetaEdit(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('document.action.editMetadata')}
            </Button>
          )}
          {canHardDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowHardDelete(true)}
            >
              {t('document.action.hardDelete')}
            </Button>
          )}
        </div>
      )}

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

      {/* Feature 253 T073: Hard-Delete Dialog */}
      <DocumentHardDeleteDialog
        open={showHardDelete}
        onOpenChange={setShowHardDelete}
        config={rfaActionConfig}
        documentLabel={docNo}
        isLoading={isHardDeleting}
        onConfirm={() => hardDelete({ publicId: uuidStr })}
      />

      {/* Feature 253 T115: Cancel Dialog */}
      <DocumentCancelDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        config={rfaActionConfig}
        documentLabel={docNo}
        isLoading={isCancelling}
        onConfirm={(reason) => cancel({ publicId: uuidStr, reason })}
      />

      {/* Feature 253 T062: Metadata Edit Dialog */}
      <DocumentMetadataEditDialog
        open={showMetaEdit}
        onOpenChange={setShowMetaEdit}
        config={rfaActionConfig}
        documentLabel={docNo}
        currentVersion={rfaData.version ?? 0}
        fields={metaFields}
        isLoading={isPatching}
        onConfirm={(patch, version) =>
          metadataPatch({ publicId: uuidStr, patch, version })
        }
      />

      {/* ADR-021 US4: File Preview Modal */}
      <WorkflowErrorBoundary fallback={null}>
        <FilePreviewModal
          attachment={previewFile}
          onClose={() => setPreviewFile(null)}
          onUnavailable={handleUnavailable}
        />
      </WorkflowErrorBoundary>
      </div>
      <AiChatToggle isOpen={isChatOpen} onClick={() => setIsChatOpen(!isChatOpen)} />
      <AiChatPanel
        context={{ type: 'rfa', publicId: uuidStr }}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onToggle={() => setIsChatOpen((prev) => !prev)}
      />
    </div>
  );
}
