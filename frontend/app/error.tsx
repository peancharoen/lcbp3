'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <div>
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground mt-1 text-sm max-w-md">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground mt-2">Error ID: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
