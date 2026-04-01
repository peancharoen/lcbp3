import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Loader2 } from 'lucide-react';
import { CorrespondencesContent } from '@/components/correspondences/correspondences-content';
import { Can } from '@/components/common/can';

export const dynamic = 'force-dynamic';

interface CorrespondencesPageProps {
  searchParams: Promise<{
    type?: string;
  }>;
}

export default async function CorrespondencesPage({
  searchParams,
}: CorrespondencesPageProps) {
  const params = await searchParams;
  const isRfaView = params?.type?.toUpperCase() === 'RFA';
  const heading = isRfaView ? 'RFAs (Request for Approval)' : 'Correspondences';
  const description = isRfaView
    ? 'Unified list view for RFA documents'
    : 'Manage official letters and communications';
  const createHref = isRfaView ? '/rfas/new' : '/correspondences/new';
  const createLabel = isRfaView ? 'New RFA' : 'New Correspondence';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{heading}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        <Can permission="correspondence.create">
          <Link href={createHref}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {createLabel}
            </Button>
          </Link>
        </Can>
      </div>

      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <CorrespondencesContent />
      </Suspense>
    </div>
  );
}
