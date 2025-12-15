'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function ActionItemNotFound() {
  const router = useRouter();

  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-4">
        <AlertCircle className="h-16 w-16 text-surface-400" />
      </div>
      <h2 className="text-2xl font-bold text-surface-900">Action Item Not Found</h2>
      <p className="mt-2 text-surface-500 max-w-md mx-auto">
        The action item you're looking for doesn't exist or you don't have permission to view it.
      </p>
      <div className="mt-6 flex justify-center gap-4">
        <Button onClick={() => router.back()} variant="secondary" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
        <Button onClick={() => router.push('/action-items')}>
          View All Action Items
        </Button>
      </div>
    </div>
  );
}








