'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TransmittalList } from '@/components/transmittal/transmittal-list';
import { transmittalService } from '@/lib/services/transmittal.service';
import { projectService } from '@/lib/services/project.service';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { TransmittalListResponse } from '@/types/transmittal';
import { TransmittalPurpose } from '@/types/dto/transmittal/transmittal.dto';
import { BulkActionBar } from '@/components/documents/bulk-action-bar';
import { useBulkActions } from '@/hooks/use-bulk-actions';
import { DocumentCancelDialog } from '@/components/documents/document-cancel-dialog';
import { BulkTagDialog } from '@/components/documents/bulk-tag-dialog';
import { getDocumentActionConfig } from '@/components/documents/document-action-strategy';

const PURPOSE_OPTIONS: { value: TransmittalPurpose | ''; label: string }[] = [
  { value: '', label: 'All Purposes' },
  { value: TransmittalPurpose.FOR_APPROVAL, label: 'For Approval' },
  { value: TransmittalPurpose.FOR_INFORMATION, label: 'For Information' },
  { value: TransmittalPurpose.FOR_REVIEW, label: 'For Review' },
  { value: TransmittalPurpose.OTHER, label: 'Other' },
];

export default function TransmittalPage() {
  // ADR-019: Dynamic project selection via UUID
  const [selectedProjectUuid, setSelectedProjectUuid] = useState<string>('');
  const [selectedPurpose, setSelectedPurpose] = useState<TransmittalPurpose | ''>('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);

  const { data: projectsData } = useQuery({
    queryKey: ['projects-for-transmittals'],
    queryFn: () => projectService.getAll(),
  });
  const projects = projectsData?.data || projectsData || [];

  const { data, isLoading, error, refetch } = useQuery<TransmittalListResponse>({
    queryKey: ['transmittals', selectedProjectUuid, selectedPurpose],
    queryFn: () =>
      transmittalService.getAll({
        projectId: selectedProjectUuid,
        ...(selectedPurpose ? { purpose: selectedPurpose } : {}),
      }),
    enabled: !!selectedProjectUuid,
  });

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((key) => rowSelection[key]),
    [rowSelection]
  );

  const { bulkCancel, bulkTag, bulkExport, isBulkCancelling } = useBulkActions({
    documentType: 'TRANSMITTAL',
    onComplete: () => setRowSelection({}),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transmittals</h1>
          <p className="text-muted-foreground">Manage document transmittal slips</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Link href="/transmittals/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Transmittal
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters: Project + Purpose (v1.8.7 B3) */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Project:</span>
        <Select value={selectedProjectUuid} onValueChange={setSelectedProjectUuid}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {(Array.isArray(projects) ? projects : []).map(
              (p: { publicId: string; projectName?: string; projectCode?: string }) => (
                <SelectItem key={p.publicId} value={p.publicId}>
                  {p.projectName || p.projectCode}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        <span className="text-sm font-medium text-muted-foreground">Purpose:</span>
        <Select
          value={selectedPurpose || '__all__'}
          onValueChange={(v) => setSelectedPurpose(v === '__all__' ? '' : (v as TransmittalPurpose))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Purposes" />
          </SelectTrigger>
          <SelectContent>
            {PURPOSE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || '__all__'} value={opt.value || '__all__'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">Failed to load transmittals.</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <TransmittalList
          data={data?.data || []}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      )}

      <BulkActionBar
        selectedCount={selectedIds.length}
        onBulkCancel={() => setShowCancelDialog(true)}
        onBulkTag={() => setShowTagDialog(true)}
        onBulkExport={() =>
          bulkExport({
            publicIds: selectedIds,
            format: 'CSV',
            columns: ['publicId', 'transmittalNo', 'purpose'],
          })
        }
        onClear={() => setRowSelection({})}
        isLoading={isBulkCancelling}
      />

      <DocumentCancelDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        config={getDocumentActionConfig('TRANSMITTAL')}
        documentLabel={`${selectedIds.length} transmittal(s)`}
        isLoading={isBulkCancelling}
        onConfirm={(reason) => {
          bulkCancel({ publicIds: selectedIds, reason });
          setShowCancelDialog(false);
        }}
      />

      <BulkTagDialog
        open={showTagDialog}
        onOpenChange={setShowTagDialog}
        selectedCount={selectedIds.length}
        onConfirm={(addTags, removeTags) => {
          bulkTag({ publicIds: selectedIds, addTags, removeTags });
        }}
      />
    </section>
  );
}
