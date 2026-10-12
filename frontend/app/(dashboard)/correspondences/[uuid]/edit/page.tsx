'use client';

import { CorrespondenceForm } from '@/components/correspondences/form';
import { useCorrespondence } from '@/hooks/use-correspondence';
import { Loader2 } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';

export default function EditCorrespondencePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const uuid = (params?.uuid as string) ?? '';
  const selectedRevisionId = searchParams.get('revId') ?? undefined;

  const { data: correspondence, isLoading, isError } = useCorrespondence(uuid);

  if (!uuid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-xl font-bold text-destructive">Invalid Correspondence UUID</h1>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError || !correspondence) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-xl font-bold text-destructive">Failed to load correspondence</h1>
        <p>Please try again later or verify the UUID.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Correspondence</h1>
        <p className="mt-1 text-muted-foreground">
          Editing: <span className="font-mono font-semibold">{correspondence.correspondenceNumber}</span>
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <CorrespondenceForm initialData={correspondence} uuid={uuid} selectedRevisionId={selectedRevisionId} />
      </div>
    </div>
  );
}
