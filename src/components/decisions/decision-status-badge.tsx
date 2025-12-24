'use client';

import { Badge } from '@/components/ui/badge';
import { DecisionStatus, DecisionStatusLabel } from '@/types/enums';
import { cn } from '@/lib/utils';

interface DecisionStatusBadgeProps {
  status: DecisionStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const statusVariant: Record<DecisionStatus, 'warning' | 'success' | 'danger' | 'default'> = {
  [DecisionStatus.Proposed]: 'warning',
  [DecisionStatus.Approved]: 'success',
  [DecisionStatus.Rejected]: 'danger',
  [DecisionStatus.Superseded]: 'default',
};

export function DecisionStatusBadge({
  status,
  size = 'md',
  className,
}: DecisionStatusBadgeProps) {
  const variant = statusVariant[status];
  const label = DecisionStatusLabel[status];
  const isSuperseded = status === DecisionStatus.Superseded;

  return (
    <Badge
      variant={variant}
      size={size}
      dot
      className={cn(
        isSuperseded && 'opacity-60',
        className
      )}
    >
      {label}
    </Badge>
  );
}
