'use client';

import { useState } from 'react';
import { CorrespondenceDetail } from '@/components/correspondences/detail';
import { IntegratedBanner } from '@/components/workflow/integrated-banner';
import { WorkflowLifecycle } from '@/components/workflow/workflow-lifecycle';
import { FilePreviewModal } from '@/components/common/file-preview-modal';
import { WorkflowErrorBoundary } from '@/components/common/workflow-error-boundary';
import { useCorrespondence, useWorkflowHistory } from '@/hooks/use-correspondence';
import { Loader2, Pencil, FileEdit } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
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

  // Feature 253 T061: Metadata Edit Dialog (DC edit metadata after submit)
  const [showMetaEdit, setShowMetaEdit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const t = useTranslations();
  const router = useRouter();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const corrActionConfig = getDocumentActionConfig('CORRESPONDENCE');
  const { metadataPatch, isPatching, hardDelete, isHardDeleting, cancel, isCancelling } = useDocumentActions({
    config: corrActionConfig,
    onSuccess: (action) => {
      if (action === 'hardDelete') router.push('/correspondences');
    },
  });
  // Feature 253 T073: Hard-Delete Dialog (Superadmin only)
  const [showHardDelete, setShowHardDelete] = useState(false);
  const canHardDelete = hasPermission('system.manage_all') || hasPermission('correspondence.delete');
  const canCancel = hasPermission('correspondence.cancel') || hasPermission('document.cancel') || hasPermission('system.manage_all');

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

  // Feature 253: metadata fields สำหรับ Edit Dialog (Tier 1 แก้ได้ทันที)
  const canEditMetadata = hasPermission('correspondence.edit') && status !== 'CANCELLED';
  const canEditContent = hasPermission('correspondence.edit') && status === 'DRAFT';
  const metaFields: MetadataField[] = [
    { key: 'subject', label: 'Subject', value: currentRevision?.subject ?? '', tier: 1 },
    { key: 'description', label: 'Description', value: currentRevision?.description ?? '', tier: 1 },
    { key: 'remarks', label: 'Remarks', value: currentRevision?.remarks ?? '', tier: 1 },
  ];

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

      {/* Feature 253: Edit Content (DRAFT) / Edit Metadata (DC, non-CANCELLED) + Cancel + Hard-Delete */}
      {(canEditContent || canEditMetadata || canHardDelete || canCancel) && (
        <div className="flex justify-end gap-2">
          {canCancel && (
            <Button variant="outline" size="sm" onClick={() => setShowCancel(true)}>
              {t('document.action.cancel')}
            </Button>
          )}
          {canEditContent && (
            <Link href={`/correspondences/${uuid}/edit?revId=${currentRevision?.publicId ?? ''}`}>
              <Button variant="outline" size="sm">
                <FileEdit className="mr-2 h-4 w-4" />
                {t('document.action.editContent')}
              </Button>
            </Link>
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

      {/* Feature 253 T073: Hard-Delete Dialog */}
      <DocumentHardDeleteDialog
        open={showHardDelete}
        onOpenChange={setShowHardDelete}
        config={corrActionConfig}
        documentLabel={docNo}
        isLoading={isHardDeleting}
        onConfirm={() => hardDelete({ publicId: uuid })}
      />

      {/* Feature 253 T115: Cancel Dialog */}
      <DocumentCancelDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        config={corrActionConfig}
        documentLabel={docNo}
        isLoading={isCancelling}
        onConfirm={(reason) => cancel({ publicId: uuid, reason })}
      />

      {/* Feature 253 T061: Metadata Edit Dialog */}
      <DocumentMetadataEditDialog
        open={showMetaEdit}
        onOpenChange={setShowMetaEdit}
        config={corrActionConfig}
        documentLabel={docNo}
        currentVersion={corrData!.version ?? 0}
        fields={metaFields}
        isLoading={isPatching}
        onConfirm={(patch, version) =>
          metadataPatch({ publicId: uuid, patch, version })
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
  );
}
