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

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Correspondence</h1>
        <p className="text-muted-foreground mt-1">
          Editing: <span className="font-mono font-semibold">{correspondence.correspondenceNumber}</span>
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6 shadow-sm">
        <CorrespondenceForm initialData={correspondence} uuid={uuid} selectedRevisionId={selectedRevisionId} />
      </div>
    </div>
  );
}
