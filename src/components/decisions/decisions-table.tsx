'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatDateReadable, getInitials } from '@/lib/utils';
import { FileText } from 'lucide-react';

interface DecisionsTableProps {
  decisions: Array<{
    id: string;
    title: string;
    rationale: string | null;
    outcome: string | null;
    created_at: string;
    project?: { name: string } | null;
    decision_maker?: { full_name: string | null; avatar_url: string | null } | null;
    decision_maker_name: string | null;
    source_meeting?: { id: string; title: string; date: string | null } | null;
  }>;
}

export function DecisionsTable({ decisions }: DecisionsTableProps) {
  if (decisions.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-12 text-center">
        <FileText className="mb-4 h-12 w-12 text-surface-300" />
        <h3 className="text-lg font-medium text-surface-900">
          No decisions yet
        </h3>
        <p className="mt-1 text-surface-500">
          Decisions will appear here after processing meetings
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
              Decision
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
              Project
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
              Decision Date
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
              Decision Maker
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
              Source Meeting
            </th>
            <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100">
          {decisions.map((decision) => (
            <tr key={decision.id} className="hover:bg-surface-50">
              <td className="px-6 py-4">
                <div>
                  <Link
                    href={`/decisions/${decision.id}`}
                    className="font-medium text-surface-900 hover:text-primary-600"
                  >
                    {decision.title}
                  </Link>
                  {decision.rationale && (
                    <p className="mt-1 text-sm text-surface-500 line-clamp-2">
                      {decision.rationale}
                    </p>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-surface-500">
                {decision.project?.name || 'Unknown Project'}
              </td>
              <td className="px-6 py-4 text-sm text-surface-500">
                {formatDateReadable(decision.created_at)}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                    {decision.decision_maker?.avatar_url ? (
                      <img
                        src={decision.decision_maker.avatar_url}
                        alt=""
                        className="h-7 w-7 rounded-full"
                      />
                    ) : (
                      getInitials(
                        decision.decision_maker?.full_name ||
                          decision.decision_maker_name ||
                          'Unknown'
                      )
                    )}
                  </div>
                  <span className="text-sm text-surface-700">
                    {decision.decision_maker?.full_name ||
                      decision.decision_maker_name ||
                      'Unknown'}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                {decision.source_meeting ? (
                  <Link
                    href={`/meetings/${decision.source_meeting.id}`}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    <div className="text-sm">
                      <div className="font-medium">{decision.source_meeting.title}</div>
                      {decision.source_meeting.date && (
                        <div className="text-surface-500">
                          {formatDateReadable(decision.source_meeting.date)}
                        </div>
                      )}
                    </div>
                  </Link>
                ) : (
                  <span className="text-sm text-surface-400">No meeting</span>
                )}
              </td>
              <td className="px-6 py-4">
                <Badge variant={decision.outcome ? 'success' : 'default'}>
                  {decision.outcome ? 'Implemented' : 'Pending'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}