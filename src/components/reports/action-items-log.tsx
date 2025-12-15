'use client';

import { CheckSquare } from 'lucide-react';
import Link from 'next/link';
import type { ActionItemWithOwner } from '@/types/database';
import { cn } from '@/lib/utils';

interface ActionItemsLogProps {
  items: ActionItemWithOwner[];
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isOverdue(dateString: string | null): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function getOwnerDisplay(item: ActionItemWithOwner): string {
  if (item.owner?.full_name) return item.owner.full_name;
  if (item.owner_name) return item.owner_name;
  return 'Unassigned';
}

function getProjectName(item: ActionItemWithOwner): string {
  return item.project?.name || '—';
}

function getMeetingTitle(item: ActionItemWithOwner): string {
  return item.source_meeting?.title || '—';
}

export function ActionItemsLog({ items }: ActionItemsLogProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckSquare className="mb-4 h-12 w-12 text-surface-300" />
        <h3 className="text-lg font-medium text-surface-900">No Open Action Items</h3>
        <p className="mt-1 text-surface-500">
          All action items for this project are closed
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Title
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Due Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Assigned To
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Project
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Source Meeting
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100">
          {items.map((item, index) => {
            const overdue = isOverdue(item.due_date) && item.status !== 'Closed';
            return (
              <tr
                key={item.id}
                className={cn(
                  'transition-colors hover:bg-surface-50',
                  index % 2 === 1 && 'bg-surface-25'
                )}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/action-items/${item.id}`}
                    className="font-medium text-surface-900 hover:text-primary-600"
                  >
                    {item.title}
                  </Link>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-surface-500">
                      {item.description}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                      item.status === 'Open'
                        ? 'bg-primary-50 text-primary-700'
                        : item.status === 'In Progress'
                          ? 'bg-warning-50 text-warning-700'
                          : 'bg-success-50 text-success-700'
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
                    {formatDate(item.due_date)}
                  </span>
                  {overdue && (
                    <span className="ml-2 text-xs text-danger-500">Overdue</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-surface-600">
                  {getOwnerDisplay(item)}
                </td>
                <td className="px-4 py-3 text-sm text-surface-600">
                  {getProjectName(item)}
                </td>
                <td className="px-4 py-3 text-sm text-surface-500">
                  {item.source_meeting_id ? (
                    <Link
                      href={`/meetings/${item.source_meeting_id}`}
                      className="hover:text-primary-600 hover:underline"
                    >
                      {getMeetingTitle(item)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-surface-500">
                  {formatDate(item.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
