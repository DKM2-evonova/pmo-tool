'use client';

import { Edit2, Trash2, CheckCircle, XCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OperationBadge } from './status-badges';
import type { ProposedDecision } from '@/types/database';

interface DecisionCardProps {
  item: ProposedDecision;
  hasLock: boolean;
  onToggleAccept: (tempId: string) => void;
  onEdit: (tempId: string) => void;
  onReject: (tempId: string) => void;
}

export function DecisionCard({
  item,
  hasLock,
  onToggleAccept,
  onEdit,
  onReject,
}: DecisionCardProps) {
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
          </div>
          <p className="mt-1 text-sm text-surface-600">
            <strong>Rationale:</strong> {item.rationale}
          </p>
          <p className="mt-1 text-sm text-surface-600">
            <strong>Outcome:</strong> {item.outcome}
          </p>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-surface-500">
              <User className="h-4 w-4" />
              Decision maker: {item.decision_maker.name}
            </span>
          </div>
        </div>

        {hasLock && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(item.temp_id)}
              className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"
              title="Edit decision"
              aria-label="Edit decision"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onReject(item.temp_id)}
              className="rounded-lg p-2 text-danger-500 hover:bg-danger-50"
              title="Reject item"
              aria-label="Reject decision"
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
