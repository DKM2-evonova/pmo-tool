'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatDateReadable, getInitials, cn } from '@/lib/utils';
import { FileText, ChevronRight, Calendar, ExternalLink } from 'lucide-react';

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
      <div className="glass-panel flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100/80 mb-4">
          <FileText className="h-8 w-8 text-surface-400" />
        </div>
        <h3 className="text-lg font-semibold text-surface-900">
          No decisions yet
        </h3>
        <p className="mt-1.5 text-surface-500 max-w-sm">
          Decisions will appear here after processing meetings
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
                Decision
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Project
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Decision Date
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Decision Maker
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Source Meeting
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Status
              </th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100/60">
            {decisions.map((decision, index) => (
              <tr
                key={decision.id}
                className={cn(
                  'group transition-colors duration-150',
                  'hover:bg-white/60',
                  'animate-fade-in'
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <td className="px-6 py-4">
                  <div>
                    <Link
                      href={`/decisions/${decision.id}`}
                      className="font-medium text-surface-900 hover:text-primary-600 transition-colors"
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
                <td className="px-6 py-4">
                  <span className="text-sm text-surface-600">
                    {decision.project?.name || (
                      <span className="text-surface-400">Unknown Project</span>
                    )}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-100/80 border border-surface-200/50 px-2.5 py-1 text-xs font-medium text-surface-600">
                    <Calendar className="h-3 w-3 opacity-60" />
                    {formatDateReadable(decision.created_at)}
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
                      {decision.decision_maker?.avatar_url ? (
                        <img
                          src={decision.decision_maker.avatar_url}
                          alt=""
                          className="h-8 w-8 rounded-lg object-cover"
                        />
                      ) : (
                        getInitials(
                          decision.decision_maker?.full_name ||
                            decision.decision_maker_name ||
                            'U'
                        )
                      )}
                    </div>
                    <span className="text-sm font-medium text-surface-700">
                      {decision.decision_maker?.full_name ||
                        decision.decision_maker_name || (
                          <span className="text-surface-400 font-normal">Unknown</span>
                        )}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {decision.source_meeting ? (
                    <Link
                      href={`/meetings/${decision.source_meeting.id}`}
                      className="group/meeting inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      <div className="text-sm">
                        <div className="font-medium flex items-center gap-1">
                          {decision.source_meeting.title}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover/meeting:opacity-100 transition-opacity" />
                        </div>
                        {decision.source_meeting.date && (
                          <div className="text-surface-500 text-xs">
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
                  <Badge variant={decision.outcome ? 'success' : 'default'} dot>
                    {decision.outcome ? 'Implemented' : 'Pending'}
                  </Badge>
                </td>
                <td className="px-4 py-4">
                  <Link
                    href={`/decisions/${decision.id}`}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}




