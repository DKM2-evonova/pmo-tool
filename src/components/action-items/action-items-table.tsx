'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatDateReadable, isOverdue, getInitials, cn } from '@/lib/utils';
import { CheckSquare, AlertCircle, ChevronRight, Calendar } from 'lucide-react';

interface ActionItemsTableProps {
  actionItems: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    due_date: string | null;
    owner_name: string | null;
    owner?: { full_name: string | null; avatar_url: string | null } | null;
    project?: { name: string } | null;
    source_meeting?: { title: string } | null;
  }>;
}

export function ActionItemsTable({ actionItems }: ActionItemsTableProps) {
  const statusVariant: Record<string, 'default' | 'warning' | 'success'> = {
    Open: 'default',
    'In Progress': 'warning',
    Closed: 'success',
  };

  if (actionItems.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100/80 mb-4">
          <CheckSquare className="h-8 w-8 text-surface-400" />
        </div>
        <h3 className="text-lg font-semibold text-surface-900">
          No action items yet
        </h3>
        <p className="mt-1.5 text-surface-500 max-w-sm">
          Action items will appear here after processing meetings or creating them manually
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-200/60 bg-surface-50/50">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Title
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Project
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Owner
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Due Date
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Status
              </th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100/60">
            {actionItems.map((item, index) => {
              const itemOverdue = item.due_date && isOverdue(item.due_date) && item.status !== 'Closed';

              return (
                <tr
                  key={item.id}
                  className={cn(
                    'group transition-colors duration-150',
                    'hover:bg-white/60',
                    'animate-fade-in'
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/action-items/${item.id}`}
                      className="block"
                    >
                      <span className="font-medium text-surface-900 group-hover:text-primary-600 transition-colors">
                        {item.title}
                      </span>
                      {item.source_meeting && (
                        <p className="mt-1 text-xs text-surface-400">
                          From: {(item.source_meeting as unknown as { title: string }).title}
                        </p>
                      )}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-surface-600">
                      {(item.project as unknown as { name: string } | null)?.name || (
                        <span className="text-surface-400">-</span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg',
                          'text-xs font-semibold',
                          'bg-gradient-to-br from-primary-500 to-primary-600 text-white',
                          'shadow-sm shadow-primary-500/20'
                        )}
                      >
                        {item.owner?.avatar_url ? (
                          <img
                            src={item.owner.avatar_url}
                            alt=""
                            className="h-8 w-8 rounded-lg object-cover"
                          />
                        ) : (
                          getInitials(
                            item.owner?.full_name ||
                              item.owner_name ||
                              'U'
                          )
                        )}
                      </div>
                      <span className="text-sm font-medium text-surface-700">
                        {item.owner?.full_name || item.owner_name || (
                          <span className="text-surface-400 font-normal">Unassigned</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.due_date ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium',
                          itemOverdue
                            ? 'bg-danger-50/80 text-danger-700 border border-danger-200/50'
                            : 'bg-surface-100/80 text-surface-600 border border-surface-200/50'
                        )}
                      >
                        {itemOverdue ? (
                          <AlertCircle className="h-3.5 w-3.5" />
                        ) : (
                          <Calendar className="h-3 w-3 opacity-60" />
                        )}
                        {formatDateReadable(item.due_date)}
                      </span>
                    ) : (
                      <span className="text-sm text-surface-400">No date</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant[item.status]} dot>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/action-items/${item.id}`}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        'text-surface-300 hover:text-primary-600',
                        'hover:bg-primary-50/80',
                        'transition-all duration-200',
                        'opacity-0 group-hover:opacity-100'
                      )}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
