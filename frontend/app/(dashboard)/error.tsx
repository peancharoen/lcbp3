'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div>
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground mt-1 text-sm max-w-md">
          {error.message || 'An error occurred while loading this page.'}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground mt-2">Error ID: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
