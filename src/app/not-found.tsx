import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <FileQuestion className="mb-6 h-16 w-16 text-surface-300" />
      <h1 className="mb-2 text-2xl font-bold text-surface-900">
        Page Not Found
      </h1>
      <p className="mb-8 text-surface-500">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/dashboard" className="btn-primary">
        Back to Dashboard
      </Link>
    </div>
  );
}

