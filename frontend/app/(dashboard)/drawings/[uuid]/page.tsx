'use client';

import { use, useState } from 'react';
import { notFound, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Download, FileText, Loader2, Pencil, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { RevisionHistory } from '@/components/drawings/revision-history';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contractDrawingService } from '@/lib/services/contract-drawing.service';
import { shopDrawingService } from '@/lib/services/shop-drawing.service';
import { asBuiltDrawingService } from '@/lib/services/asbuilt-drawing.service';
import { useUpdateContractDrawing, useUploadRevision } from '@/hooks/use-drawing';

type DrawingType = 'CONTRACT' | 'SHOP' | 'AS_BUILT';

interface FetchedDrawing {
  _type: DrawingType;
  uuid: string;
  contractDrawingNo?: string;
  drawingNumber?: string;
  title?: string;
  volumePage?: number;
  createdAt?: string;
  updatedAt?: string;
  currentRevision?: { title?: string; revisionNumber?: string; legacyDrawingNumber?: string };
  revisions?: {
    revisionId?: number;
    uuid: string;
    revisionNumber: string;
    title?: string;
    legacyDrawingNumber?: string;
    revisionDate: string;
    revisionDescription?: string;
    revisedByName: string;
    fileUrl: string;
    isCurrent: boolean | null;
    createdBy?: number;
    updatedBy?: number;
  }[];
}

async function fetchDrawingByUuid(uuid: string): Promise<FetchedDrawing | null> {
  try {
    const result = await contractDrawingService.getByUuid(uuid);
    if (result?.data) return { ...result.data, _type: 'CONTRACT' as const };
  } catch {
    /* not found */
  }

  try {
    const result = await shopDrawingService.getByUuid(uuid);
    if (result?.data) return { ...result.data, _type: 'SHOP' as const };
  } catch {
    /* not found */
  }

  try {
    const result = await asBuiltDrawingService.getByUuid(uuid);
    if (result?.data) return { ...result.data, _type: 'AS_BUILT' as const };
  } catch {
    /* not found */
  }

  return null;
}

export default function DrawingDetailPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const isUploadMode = searchParams.get('upload') === 'true';

  const { data: drawing, isLoading } = useQuery({
    queryKey: ['drawing-detail', uuid],
    queryFn: () => fetchDrawingByUuid(uuid),
    enabled: !!uuid,
  });

  if (!uuid) {
    notFound();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!drawing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/drawings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Drawing Not Found</h1>
        </div>
        <p className="text-muted-foreground">
          The drawing with UUID <code>{uuid}</code> could not be found.
        </p>
      </div>
    );
  }

  const drawingNumber = drawing.contractDrawingNo || drawing.drawingNumber || 'N/A';
  const title = drawing.title || drawing.currentRevision?.title || 'Untitled';
  const revisions = drawing.revisions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/drawings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{drawingNumber}</h1>
            <p className="text-muted-foreground">{title}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {!isEditMode && !isUploadMode && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/drawings/${uuid}?edit=true`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Detail
                </Link>
              </Button>
              {drawing._type !== 'CONTRACT' && (
                <Button variant="outline" asChild>
                  <Link href={`/drawings/${uuid}?upload=true`}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Revision
                  </Link>
                </Button>
              )}
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download Current
              </Button>
            </>
          )}
          {(isEditMode || isUploadMode) && (
            <Button variant="ghost" asChild>
              <Link href={`/drawings/${uuid}`}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Edit Detail Form */}
      {isEditMode && <EditDetailForm drawing={drawing} uuid={uuid} onDone={() => router.push(`/drawings/${uuid}`)} />}

      {/* Upload Revision Form */}
      {isUploadMode && drawing._type !== 'CONTRACT' && (
        <UploadRevisionForm drawingType={drawing._type} uuid={uuid} onDone={() => router.push(`/drawings/${uuid}`)} />
      )}

      {/* Detail View (shown when not in edit/upload mode) */}
      {!isEditMode && !isUploadMode && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">Drawing Details</CardTitle>
                  <Badge>{drawing._type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Drawing Number</p>
                    <p className="font-medium mt-1">{drawingNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Type</p>
                    <p className="font-medium mt-1">{drawing._type}</p>
                  </div>
                  {drawing.volumePage && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Volume Page</p>
                      <p className="font-medium mt-1">{drawing.volumePage}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                    <p className="font-medium mt-1">
                      {drawing.createdAt ? format(new Date(drawing.createdAt), 'dd MMM yyyy') : 'N/A'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Preview</h3>
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">PDF Preview Placeholder</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <RevisionHistory revisions={revisions} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Edit Detail Form ─── */
function EditDetailForm({ drawing, uuid, onDone }: { drawing: FetchedDrawing; uuid: string; onDone: () => void }) {
  const updateMutation = useUpdateContractDrawing();
  const queryClient = useQueryClient();

  const [formTitle, setFormTitle] = useState(drawing.title || drawing.currentRevision?.title || '');
  const [formDrawingNo, setFormDrawingNo] = useState(drawing.contractDrawingNo || drawing.drawingNumber || '');
  const [formVolumePage, setFormVolumePage] = useState(drawing.volumePage?.toString() || '');

  const handleSave = () => {
    if (drawing._type === 'CONTRACT') {
      updateMutation.mutate(
        {
          uuid,
          data: {
            title: formTitle,
            contractDrawingNo: formDrawingNo,
            volumePage: formVolumePage ? Number(formVolumePage) : undefined,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['drawing-detail', uuid] });
            onDone();
          },
        }
      );
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Edit Drawing Details</h3>
      <div className="space-y-4 max-w-xl">
        <div>
          <Label>Drawing Number</Label>
          <Input value={formDrawingNo} onChange={(e) => setFormDrawingNo(e.target.value)} />
        </div>
        <div>
          <Label>Title</Label>
          <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
        </div>
        {drawing._type === 'CONTRACT' && (
          <div>
            <Label>Volume Page</Label>
            <Input type="number" value={formVolumePage} onChange={(e) => setFormVolumePage(e.target.value)} />
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/drawings/${uuid}`}>Cancel</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ─── Upload Revision Form ─── */
function UploadRevisionForm({
  drawingType,
  uuid,
  onDone,
}: {
  drawingType: DrawingType;
  uuid: string;
  onDone: () => void;
}) {
  const uploadMutation = useUploadRevision(drawingType);
  const queryClient = useQueryClient();

  const [revisionLabel, setRevisionLabel] = useState('');
  const [revTitle, setRevTitle] = useState('');
  const [description, setDescription] = useState('');
  const [legacyNo, setLegacyNo] = useState('');

  const handleUpload = () => {
    if (!revisionLabel || !revTitle) return;

    uploadMutation.mutate(
      {
        uuid,
        data: {
          revisionLabel,
          title: revTitle,
          description: description || undefined,
          legacyDrawingNumber: legacyNo || undefined,
          revisionDate: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['drawing-detail', uuid] });
          onDone();
        },
      }
    );
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Upload New Revision</h3>
      <div className="space-y-4 max-w-xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Revision Label *</Label>
            <Input
              placeholder="e.g. A, B, 1, 2"
              value={revisionLabel}
              onChange={(e) => setRevisionLabel(e.target.value)}
            />
          </div>
          <div>
            <Label>Legacy Drawing No.</Label>
            <Input placeholder="Optional" value={legacyNo} onChange={(e) => setLegacyNo(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Revision Title *</Label>
          <Input placeholder="Title for this revision" value={revTitle} onChange={(e) => setRevTitle(e.target.value)} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            placeholder="What changed in this revision?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button onClick={handleUpload} disabled={uploadMutation.isPending || !revisionLabel || !revTitle}>
            {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload Revision
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/drawings/${uuid}`}>Cancel</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
