'use client';

import { useEffect } from 'react';

// global-error.tsx catches errors in the root layout.tsx itself.
// It MUST include its own <html> and <body> tags per Next.js spec.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error Boundary]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '16px',
            textAlign: 'center',
            padding: '16px',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            Application Error
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', maxWidth: '400px' }}>
            {error.message || 'A critical error occurred. Please refresh the page.'}
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: 'white',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
