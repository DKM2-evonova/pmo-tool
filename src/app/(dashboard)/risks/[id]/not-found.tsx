import Link from 'next/link';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-warning-500" />
      <h1 className="text-2xl font-bold text-surface-900">Risk Not Found</h1>
      <p className="mt-2 text-surface-500">
        The risk you're looking for doesn't exist or you don't have access to it.
      </p>
      <Link href="/risks" className="mt-6">
        <Button className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Risks
        </Button>
      </Link>
    </div>
  );
}























