'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    //     // console.error('[Admin Error Boundary]', error); /* TODO: Remove before prod */
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="h-10 w-10 text-warning" />
      <div>
        <h2 className="text-lg font-semibold">Admin Panel Error</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error.message || 'An error occurred in the admin panel.'}
        </p>
        {error.digest && <p className="mt-2 text-xs text-muted-foreground">Error ID: {error.digest}</p>}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">Back to Admin</Link>
        </Button>
      </div>
    </div>
  );
}
