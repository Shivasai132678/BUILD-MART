'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="card max-w-md w-full p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
          <AlertTriangle className="h-6 w-6 text-danger" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">
          Something went wrong
        </h2>
        <p className="text-sm text-text-secondary">
          An unexpected error occurred. Please try again or reload the page.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
          <Button variant="primary" size="sm" onClick={reset}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
