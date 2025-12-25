'use client';

import { Badge } from '@/components/ui';
import { Plus, RefreshCw, CheckCircle } from 'lucide-react';

export function OperationBadge({ operation }: { operation: string }) {
  const config: Record<string, { variant: 'success' | 'warning' | 'default'; label: string; icon: React.ReactNode }> = {
    create: {
      variant: 'success',
      label: 'NEW',
      icon: <Plus className="h-3 w-3" />
    },
    update: {
      variant: 'warning',
      label: 'UPDATE',
      icon: <RefreshCw className="h-3 w-3" />
    },
    close: {
      variant: 'default',
      label: 'CLOSING',
      icon: <CheckCircle className="h-3 w-3" />
    },
  };
  const { variant, label, icon } = config[operation] || { variant: 'default' as const, label: operation, icon: null };
  return (
    <Badge variant={variant} className="flex items-center gap-1">
      {icon}
      {label}
    </Badge>
  );
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
