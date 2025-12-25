'use client';

import { Flag } from 'lucide-react';
import type { MilestoneWithPredecessor } from '@/types/database';
import { cn } from '@/lib/utils';

interface MilestonesLogProps {
  items: MilestoneWithPredecessor[];
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isOverdue(dateString: string | null, status: string): boolean {
  if (!dateString || status === 'Complete') return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

const statusStyles: Record<string, string> = {
  'Not Started': 'bg-surface-100 text-surface-600',
  'In Progress': 'bg-primary-50 text-primary-700',
  'Behind Schedule': 'bg-warning-50 text-warning-700',
  'Complete': 'bg-success-50 text-success-700',
};

export function MilestonesLog({ items }: MilestonesLogProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Flag className="mb-4 h-12 w-12 text-surface-300" />
        <h3 className="text-lg font-medium text-surface-900">No Milestones</h3>
        <p className="mt-1 text-surface-500">
          No milestones have been added for this project
        </p>
      </div>
    );
  }

  // Sort milestones: by sort_order (preserves user-defined order)
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Milestone
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Target Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Depends On
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100">
          {sortedItems.map((item, index) => {
            const overdue = isOverdue(item.target_date, item.status);
            return (
              <tr
                key={item.id}
                className={cn(
                  'transition-colors hover:bg-surface-50',
                  index % 2 === 1 && 'bg-surface-25'
                )}
              >
                <td className="px-4 py-3">
                  <div>
                    <span
                      className={cn(
                        'font-medium',
                        item.status === 'Complete'
                          ? 'text-surface-400 line-through'
                          : 'text-surface-900'
                      )}
                    >
                      {item.name}
                    </span>
                    {item.description && (
                      <p className="mt-1 text-xs text-surface-500 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                      statusStyles[item.status] || statusStyles['Not Started']
                    )}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'text-sm',
                      overdue ? 'font-semibold text-danger-600' : 'text-surface-600'
                    )}
                  >
                    {formatDate(item.target_date)}
                  </span>
                  {overdue && (
                    <span className="ml-2 text-xs text-danger-500">Overdue</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.predecessor ? (
                    <span className="text-sm text-surface-600">
                      {item.predecessor.name}
                    </span>
                  ) : (
                    <span className="text-sm text-surface-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
