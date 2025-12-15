'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import type { DecisionWithMaker } from '@/types/database';
import { cn } from '@/lib/utils';

interface DecisionsLogProps {
  items: DecisionWithMaker[];
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDecisionMakerDisplay(item: DecisionWithMaker): string {
  if (item.decision_maker?.full_name) return item.decision_maker.full_name;
  if (item.decision_maker_name) return item.decision_maker_name;
  return '—';
}

function getProjectName(item: DecisionWithMaker): string {
  return (item as any).project?.name || '—';
}

function getMeetingTitle(item: DecisionWithMaker): string {
  return item.source_meeting?.title || '—';
}

export function DecisionsLog({ items }: DecisionsLogProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="mb-4 h-12 w-12 text-surface-300" />
        <h3 className="text-lg font-medium text-surface-900">No Decisions Yet</h3>
        <p className="mt-1 text-surface-500">
          No key decisions have been recorded for this project
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
              Decision
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Rationale
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Impact
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Decision Maker
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Outcome
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Project
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Date Made
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-600">
              Source Meeting
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
                  href={`/decisions/${item.id}`}
                  className="font-medium text-surface-900 hover:text-primary-600"
                >
                  {item.title}
                </Link>
              </td>
              <td className="max-w-[180px] px-4 py-3">
                <p className="line-clamp-3 text-sm text-surface-600">
                  {item.rationale || '—'}
                </p>
              </td>
              <td className="max-w-[150px] px-4 py-3">
                <p className="line-clamp-3 text-sm text-surface-600">
                  {item.impact || '—'}
                </p>
              </td>
              <td className="px-4 py-3 text-sm text-surface-600">
                {getDecisionMakerDisplay(item)}
              </td>
              <td className="max-w-[150px] px-4 py-3">
                <p className="line-clamp-3 text-sm text-surface-600">
                  {item.outcome || '—'}
                </p>
              </td>
              <td className="px-4 py-3 text-sm text-surface-600">
                {getProjectName(item)}
              </td>
              <td className="px-4 py-3 text-sm text-surface-500">
                {formatDate(item.created_at)}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
