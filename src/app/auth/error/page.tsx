import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
          <AlertCircle className="h-8 w-8 text-danger-500" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-surface-900">
          Authentication Error
        </h1>
        <p className="mb-8 max-w-md text-surface-500">
          There was a problem signing you in. Please try again or contact your
          administrator if the problem persists.
        </p>
        <Link href="/login" className="btn-primary">
          Back to Login
        </Link>
      </div>
    </div>
  );
}

