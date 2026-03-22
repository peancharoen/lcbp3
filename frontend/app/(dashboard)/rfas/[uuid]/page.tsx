'use client';

import { RFADetail } from '@/components/rfas/detail';
import { notFound, useParams } from 'next/navigation';
import { useRFA } from '@/hooks/use-rfa';
import { Loader2 } from 'lucide-react';

export default function RFADetailPage() {
  const { uuid } = useParams();

  if (!uuid) notFound();

  const { data: rfa, isLoading, isError } = useRFA(String(uuid));

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError || !rfa) {
    // Check if error is 404
    return <div className="text-center py-20 text-red-500">RFA not found or failed to load.</div>;
  }

  return <RFADetail data={rfa} />;
}
