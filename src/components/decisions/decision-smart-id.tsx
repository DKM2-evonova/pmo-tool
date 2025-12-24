'use client';

import { cn } from '@/lib/utils';
import { Hash } from 'lucide-react';

interface DecisionSmartIdProps {
  smartId: string | null;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function DecisionSmartId({
  smartId,
  size = 'md',
  showIcon = true,
  className,
}: DecisionSmartIdProps) {
  if (!smartId) {
    return (
      <span className={cn('text-surface-400 italic', className)}>
        No ID
      </span>
    );
  }

  const sizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  // Extract prefix and number for styling
  const [prefix, number] = smartId.split('-');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-mono font-semibold',
        'text-surface-700',
        sizes[size],
        className
      )}
    >
      {showIcon && (
        <Hash className={cn(iconSizes[size], 'text-surface-400')} />
      )}
      <span className="text-primary-600">{prefix}</span>
      <span className="text-surface-400">-</span>
      <span>{number}</span>
    </span>
  );
}
