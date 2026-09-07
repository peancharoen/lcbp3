'use client';

// File: app/(dashboard)/drawings/page.tsx
// Change Log:
// - 2026-09-07: Add bulk action bar + selection support for drawings (Feature 253 T086)

import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DrawingList } from '@/components/drawings/list';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useProjects } from '@/hooks/use-master-data';
import { BulkActionBar } from '@/components/documents/bulk-action-bar';
import { useBulkActions } from '@/hooks/use-bulk-actions';
import { DocumentCancelDialog } from '@/components/documents/document-cancel-dialog';
import { BulkTagDialog } from '@/components/documents/bulk-tag-dialog';
import { getDocumentActionConfig } from '@/components/documents/document-action-strategy';

export default function DrawingsPage() {
  const [selectedProjectUuid, setSelectedProjectUuid] = useState<string | undefined>(undefined);
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Drawings</h1>
          <p className="text-muted-foreground mt-1">Manage contract, shop, and as-built drawings</p>
        </div>
        <Link href="/drawings/upload">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Drawing
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Project:</span>
        <Select value={selectedProjectUuid ?? ''} onValueChange={(v) => setSelectedProjectUuid(v || undefined)}>
          <SelectTrigger className="w-[300px]">
            {isLoadingProjects ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SelectValue placeholder="Select Project" />
            )}
          </SelectTrigger>
          <SelectContent>
            {(projects as Array<{ id?: number; publicId?: string; projectName: string; projectCode: string }>).map((project) => (
              <SelectItem key={project.publicId || project.id} value={String(project.publicId || project.id)}>
                {project.projectCode} - {project.projectName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedProjectUuid ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
          Please select a project to view drawings.
        </div>
      ) : (
        <DrawingTabs projectUuid={selectedProjectUuid} />
      )}
    </div>
  );
}

function DrawingTabs({ projectUuid }: { projectUuid: string }) {
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<'CONTRACT' | 'SHOP' | 'AS_BUILT'>('CONTRACT');
  const [selectionByType, setSelectionByType] = useState<Record<string, string[]>>({
    CONTRACT: [],
    SHOP: [],
    AS_BUILT: [],
  });
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);

  const selectedIds = useMemo(
    () => selectionByType[activeType] || [],
    [selectionByType, activeType]
  );

  const { bulkCancel, bulkTag, bulkExport, isBulkCancelling } = useBulkActions({
    documentType: 'DRAWING',
    onComplete: () =>
      setSelectionByType((prev) => ({ ...prev, [activeType]: [] })),
  });

  const handleSelectionChange = (type: 'CONTRACT' | 'SHOP' | 'AS_BUILT') => (ids: string[]) => {
    setSelectionByType((prev) => ({ ...prev, [type]: ids }));
  };

  const handleClear = () => {
    setSelectionByType((prev) => ({ ...prev, [activeType]: [] }));
  };

  return (
    <Tabs
      defaultValue="contract"
      className="w-full"
      onValueChange={(value) => setActiveType(value as typeof activeType)}
    >
      <div className="flex justify-between items-center mb-6">
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="contract">Contract</TabsTrigger>
          <TabsTrigger value="shop">Shop</TabsTrigger>
          <TabsTrigger value="asbuilt">As Built</TabsTrigger>
        </TabsList>

        <div className="flex gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search drawings..."
              className="h-10 w-[250px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <TabsContent value="contract" className="mt-0">
        <DrawingList
          type="CONTRACT"
          projectUuid={projectUuid}
          filters={{ search }}
          onSelectionChange={handleSelectionChange('CONTRACT')}
        />
      </TabsContent>

      <TabsContent value="shop" className="mt-0">
        <DrawingList
          type="SHOP"
          projectUuid={projectUuid}
          filters={{ search }}
          onSelectionChange={handleSelectionChange('SHOP')}
        />
      </TabsContent>

      <TabsContent value="asbuilt" className="mt-0">
        <DrawingList
          type="AS_BUILT"
          projectUuid={projectUuid}
          filters={{ search }}
          onSelectionChange={handleSelectionChange('AS_BUILT')}
        />
      </TabsContent>

      <BulkActionBar
        selectedCount={selectedIds.length}
        onBulkCancel={() => setShowCancelDialog(true)}
        onBulkTag={() => setShowTagDialog(true)}
        onBulkExport={() =>
          bulkExport({
            publicIds: selectedIds,
            format: 'CSV',
            columns: ['publicId', 'drawingNumber', 'title'],
          })
        }
        onClear={handleClear}
        isLoading={isBulkCancelling}
      />

      <DocumentCancelDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        config={getDocumentActionConfig('DRAWING')}
        documentLabel={`${selectedIds.length} drawing(s)`}
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
    </Tabs>
  );
}
