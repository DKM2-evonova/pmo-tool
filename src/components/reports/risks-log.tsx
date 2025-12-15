'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { RiskWithOwner } from '@/types/database';
import { cn } from '@/lib/utils';

interface RisksLogProps {
  items: RiskWithOwner[];
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getOwnerDisplay(item: RiskWithOwner): string {
  if (item.owner?.full_name) return item.owner.full_name;
  if (item.owner_name) return item.owner_name;
  return 'Unassigned';
}

function getProjectName(item: RiskWithOwner): string {
  return (item as any).project?.name || '—';
}

function getMeetingTitle(item: RiskWithOwner): string {
  return item.source_meeting?.title || '—';
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'High':
      return 'bg-danger-50 text-danger-700';
    case 'Med':
      return 'bg-warning-50 text-warning-700';
    case 'Low':
      return 'bg-success-50 text-success-700';
    default:
      return 'bg-surface-100 text-surface-600';
  }
}

export function RisksLog({ items }: RisksLogProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-surface-300" />
        <h3 className="text-lg font-medium text-surface-900">No Open Risks</h3>
        <p className="mt-1 text-surface-500">
          All risks for this project have been resolved
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px]">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Risk/Issue
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Probability
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Impact
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Mitigation
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Owner
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Project
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100">
          {items.map((item, index) => (
            <tr
              key={item.id}
              className={cn(
                'transition-colors hover:bg-surface-50',
                index % 2 === 1 && 'bg-surface-25'
              )}
            >
              <td className="px-4 py-3">
                <Link
                  href={`/risks/${item.id}`}
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
                    getSeverityColor(item.probability)
                  )}
                >
                  {item.probability}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                    getSeverityColor(item.impact)
                  )}
                >
                  {item.impact}
                </span>
              </td>
              <td className="max-w-[200px] px-4 py-3">
                <p className="line-clamp-3 text-sm text-surface-600">
                  {item.mitigation || '—'}
                </p>
              </td>
              <td className="px-4 py-3 text-sm text-surface-600">
                {getOwnerDisplay(item)}
              </td>
              <td className="px-4 py-3 text-sm text-surface-600">
                {getProjectName(item)}
              </td>
              <td className="px-4 py-3 text-sm text-surface-500">
                {formatDate(item.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
