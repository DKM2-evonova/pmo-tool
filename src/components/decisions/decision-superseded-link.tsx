'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

interface DecisionSupersededLinkProps {
  supersededById: string;
  supersededBySmartId: string | null;
  className?: string;
}

export function DecisionSupersededLink({
  supersededById,
  supersededBySmartId,
  className,
}: DecisionSupersededLinkProps) {
  return (
    <Link
      href={`/decisions/${supersededById}`}
      className={cn(
        'inline-flex items-center gap-1.5',
        'text-sm text-surface-500 hover:text-primary-600',
        'transition-colors duration-200',
        className
      )}
    >
      <span>Replaced by</span>
      <span className="font-mono font-semibold text-primary-600">
        {supersededBySmartId || 'new decision'}
      </span>
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}
