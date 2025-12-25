'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';
import { clientLog } from '@/lib/client-logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    clientLog.error('Application error', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <AlertTriangle className="mb-6 h-16 w-16 text-danger-500" />
      <h1 className="mb-2 text-2xl font-bold text-surface-900">
        Something went wrong
      </h1>
      <p className="mb-8 text-surface-500">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

