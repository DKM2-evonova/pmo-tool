'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatDateReadable, isOverdue, getInitials } from '@/lib/utils';
import { CheckSquare, Clock, AlertCircle } from 'lucide-react';
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
      <div className="card flex flex-col items-center justify-center py-12 text-center">
        <CheckSquare className="mb-4 h-12 w-12 text-surface-300" />
        <h3 className="text-lg font-medium text-surface-900">
          No action items yet
        </h3>
        <p className="mt-1 text-surface-500">
          Action items will appear here after processing meetings
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full">
        <thead className="bg-surface-50">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
              Title
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
              Project
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
              Owner
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
              Due Date
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100">
          {actionItems.map((item) => (
            <tr key={item.id} className="hover:bg-surface-50">
              <td className="px-6 py-4">
                <Link
                  href={`/action-items/${item.id}`}
                  className="font-medium text-surface-900 hover:text-primary-600"
                >
                  {item.title}
                </Link>
                {item.source_meeting && (
                  <p className="mt-1 text-sm text-surface-400">
                    From: {(item.source_meeting as unknown as { title: string }).title}
                  </p>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-surface-500">
                {(item.project as unknown as { name: string } | null)?.name || '-'}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                    {item.owner?.avatar_url ? (
                      <img
                        src={item.owner.avatar_url}
                        alt=""
                        className="h-7 w-7 rounded-full"
                      />
                    ) : (
                      getInitials(
                        item.owner?.full_name ||
                          item.owner_name ||
                          'Unassigned'
                      )
                    )}
                  </div>
                  <span className="text-sm text-surface-700">
                    {item.owner?.full_name || item.owner_name || 'Unassigned'}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                {item.due_date ? (
                  <span
                    className={`flex items-center gap-1 text-sm ${
                      isOverdue(item.due_date) && item.status !== 'Closed'
                        ? 'text-danger-600'
                        : 'text-surface-500'
                    }`}
                  >
                    {isOverdue(item.due_date) && item.status !== 'Closed' && (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    {formatDateReadable(item.due_date)}
                  </span>
                ) : (
                  <span className="text-sm text-surface-400">No date</span>
                )}
              </td>
              <td className="px-6 py-4">
                <Badge variant={statusVariant[item.status]}>
                  {item.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

