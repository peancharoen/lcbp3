'use client';

import { CorrespondenceDetail } from '@/components/correspondences/detail';
import { useCorrespondence } from '@/hooks/use-correspondence';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function CorrespondenceDetailPage() {
  const params = useParams();
  const uuid = (params?.uuid as string) ?? '';

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

  return <CorrespondenceDetail data={correspondence} />;
}
