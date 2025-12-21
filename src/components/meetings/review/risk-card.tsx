'use client';

import { Button, Select, Badge } from '@/components/ui';
import { Edit2, Trash2, CheckCircle, XCircle, User, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OperationBadge, ResolutionStatusBadge } from './status-badges';
import type { ProposedRisk } from '@/types/database';
import type { OwnerSelectOption } from './types';

interface RiskCardProps {
  item: ProposedRisk;
  hasLock: boolean;
  ownerOptions: OwnerSelectOption[];
  onToggleAccept: (tempId: string) => void;
  onEdit: (tempId: string) => void;
  onReject: (tempId: string) => void;
  onUpdateOwner: (tempId: string, selectedValue: string) => void;
  onAcceptAsPlaceholder: (tempId: string) => void;
  onOpenAddContactModal: (tempId: string, ownerName: string) => void;
}

export function RiskCard({
  item,
  hasLock,
  ownerOptions,
  onToggleAccept,
  onEdit,
  onReject,
  onUpdateOwner,
  onAcceptAsPlaceholder,
  onOpenAddContactModal,
}: RiskCardProps) {
  const needsResolution = [
    'unknown',
    'ambiguous',
    'conference_room',
    'needs_confirmation',
  ].includes(item.owner_resolution_status);

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        item.accepted
          ? 'border-surface-200 bg-white'
          : 'border-surface-200 bg-surface-50 opacity-60'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <OperationBadge operation={item.operation} />
            <h3 className="font-medium text-surface-900">{item.title}</h3>
            <Badge
              variant={
                item.probability === 'High' || item.impact === 'High'
                  ? 'danger'
                  : item.probability === 'Med' || item.impact === 'Med'
                    ? 'warning'
                    : 'default'
              }
            >
              {item.probability}/{item.impact}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-surface-600">{item.description}</p>
          <p className="mt-1 text-sm text-surface-600">
            <strong>Mitigation:</strong> {item.mitigation}
          </p>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-surface-500">
              <User className="h-4 w-4" />
              {item.owner.name}
              <ResolutionStatusBadge status={item.owner_resolution_status} />
            </span>
          </div>

          {hasLock && needsResolution && (
            <div className="mt-3 space-y-2">
              {item.owner_resolution_status === 'unknown' && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onAcceptAsPlaceholder(item.temp_id)}
                  >
                    Accept as Placeholder
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      onOpenAddContactModal(item.temp_id, item.owner.name)
                    }
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Add as Contact
                  </Button>
                  <span className="text-xs text-surface-500 self-center">
                    or select existing:
                  </span>
                </div>
              )}
              {['ambiguous', 'conference_room', 'needs_confirmation'].includes(
                item.owner_resolution_status
              ) && (
                <div className="flex gap-2 mb-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      onOpenAddContactModal(item.temp_id, item.owner.name)
                    }
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Add &quot;{item.owner.name}&quot; as Contact
                  </Button>
                </div>
              )}
              <Select
                value={
                  item.owner.resolved_user_id
                    ? `user:${item.owner.resolved_user_id}`
                    : item.owner.resolved_contact_id
                      ? `contact:${item.owner.resolved_contact_id}`
                      : ''
                }
                onChange={(e) => onUpdateOwner(item.temp_id, e.target.value)}
                options={ownerOptions}
                placeholder="Select existing member or contact"
                className="w-64"
              />
            </div>
          )}
        </div>

        {hasLock && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(item.temp_id)}
              className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"
              title="Edit risk"
              aria-label="Edit risk"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onReject(item.temp_id)}
              className="rounded-lg p-2 text-danger-500 hover:bg-danger-50"
              title="Reject item"
              aria-label="Reject risk"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onToggleAccept(item.temp_id)}
              className={cn(
                'rounded-lg p-2',
                item.accepted
                  ? 'text-success-500 hover:bg-success-50'
                  : 'text-surface-400 hover:bg-surface-100'
              )}
              title={item.accepted ? 'Accepted' : 'Not accepted'}
              aria-label={
                item.accepted ? 'Mark as not accepted' : 'Mark as accepted'
              }
            >
              {item.accepted ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
