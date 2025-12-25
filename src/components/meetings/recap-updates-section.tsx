'use client';

import { RefreshCw, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { ActionItemUpdateRecap } from '@/types/database';

interface ActionItemUpdatesSectionProps {
  updates: ActionItemUpdateRecap[];
}

export function ActionItemUpdatesSection({ updates }: ActionItemUpdatesSectionProps) {
  if (!updates || updates.length === 0) return null;

  return (
    <div className="card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-900">
        <RefreshCw className="h-5 w-5 text-warning-500" />
        Action Item Updates
      </h2>
      <p className="mb-4 text-sm text-surface-600">
        The following existing action items were discussed and updated in this meeting.
      </p>
      <div className="space-y-4">
        {updates.map((update, index) => (
          <div key={index} className="rounded-lg border border-warning-200 bg-warning-50/50 p-4">
            <div className="flex items-center gap-2">
              <Badge
                variant={update.operation === 'close' ? 'success' : 'warning'}
                className="flex items-center gap-1"
              >
                {update.operation === 'close' ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {update.operation === 'close' ? 'CLOSED' : 'UPDATED'}
              </Badge>
              <h3 className="font-medium text-surface-900">{update.title}</h3>
            </div>

            <p className="mt-2 text-sm text-surface-700">{update.change_summary}</p>

            {update.previous_status && update.new_status && update.previous_status !== update.new_status && (
              <div className="mt-2 text-sm">
                <span className="text-surface-500">Status: </span>
                <span className="line-through text-surface-400">{update.previous_status}</span>
                <span className="mx-1 text-surface-400">&rarr;</span>
                <span className="font-medium text-surface-900">{update.new_status}</span>
              </div>
            )}

            {update.evidence_quote && (
              <div className="mt-3 rounded bg-surface-100 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-surface-500">
                  Evidence from discussion
                </p>
                <p className="mt-1 text-sm italic text-surface-600">
                  &ldquo;{update.evidence_quote}&rdquo;
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
