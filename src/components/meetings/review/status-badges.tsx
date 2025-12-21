'use client';

import { Badge } from '@/components/ui';

export function OperationBadge({ operation }: { operation: string }) {
  const variants: Record<string, 'success' | 'warning' | 'default'> = {
    create: 'success',
    update: 'warning',
    close: 'default',
  };
  return <Badge variant={variants[operation] || 'default'}>{operation}</Badge>;
}

export function ResolutionStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { variant: 'success' | 'warning' | 'danger' | 'primary'; label: string }
  > = {
    resolved: { variant: 'success', label: 'Resolved' },
    needs_confirmation: { variant: 'warning', label: 'Needs Confirmation' },
    ambiguous: { variant: 'danger', label: 'Ambiguous' },
    conference_room: { variant: 'danger', label: 'Conference Room' },
    unknown: { variant: 'danger', label: 'Unknown' },
    placeholder: { variant: 'primary', label: 'Placeholder' },
  };
  const { variant, label } = config[status] || {
    variant: 'default' as 'success',
    label: status,
  };
  return <Badge variant={variant}>{label}</Badge>;
}
