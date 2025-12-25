'use client';

import Link from 'next/link';
import { memo } from 'react';
import { formatDateReadable, getInitials, cn } from '@/lib/utils';
import { FileText, ChevronRight, Calendar, PenLine } from 'lucide-react';
import { DecisionSmartId } from './decision-smart-id';
import { DecisionCategoryBadge } from './decision-category-badge';
import { DecisionStatusBadge } from './decision-status-badge';
import { DecisionImpactChips } from './decision-impact-chips';
import { DecisionSupersededLink } from './decision-superseded-link';
import type { DecisionCategory, DecisionImpactArea, DecisionStatus, DecisionSource } from '@/types/enums';

interface DecisionRow {
  id: string;
  smart_id: string | null;
  title: string;
  rationale: string | null;
  category: DecisionCategory | null;
  impact_areas: DecisionImpactArea[];
  status: DecisionStatus;
  outcome: string | null;
  decision_date: string | null;
  source: DecisionSource;
  created_at: string;
  superseded_by_id: string | null;
  superseded_by?: { smart_id: string | null } | null;
  project?: { name: string } | null;
  decision_maker?: { full_name: string | null; avatar_url: string | null } | null;
  decision_maker_name: string | null;
  source_meeting?: { id: string; title: string; date: string | null } | null;
}

interface DecisionsTableProps {
  decisions: DecisionRow[];
}

// Memoized row component to prevent re-renders on parent state changes
interface DecisionRowComponentProps {
  decision: DecisionRow;
  index: number;
}

const DecisionRowComponent = memo(function DecisionRowComponent({
  decision,
  index
}: DecisionRowComponentProps) {
  const isSuperseded = decision.status === 'SUPERSEDED';
  const isManual = decision.source === 'manual';

  return (
    <tr
      className={cn(
        'group transition-colors duration-150',
        'hover:bg-white/60',
        'animate-fade-in',
        isSuperseded && 'opacity-60'
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Smart ID */}
      <td className="px-4 py-4">
        <DecisionSmartId smartId={decision.smart_id} size="sm" />
      </td>

      {/* Decision Title & Rationale */}
      <td className="px-4 py-4 max-w-md">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/decisions/${decision.id}`}
              className={cn(
                'font-medium text-surface-900 hover:text-primary-600 transition-colors',
                isSuperseded && 'line-through decoration-surface-400'
              )}
            >
              {decision.title}
            </Link>
            {isManual && (
              <span title="Manually created">
                <PenLine className="h-3.5 w-3.5 text-surface-400" />
              </span>
            )}
          </div>
          {decision.rationale && !isSuperseded && (
            <p className="mt-1 text-sm text-surface-500 line-clamp-1">
              {decision.rationale}
            </p>
          )}
          {isSuperseded && decision.superseded_by_id && (
            <DecisionSupersededLink
              supersededById={decision.superseded_by_id}
              supersededBySmartId={decision.superseded_by?.smart_id || null}
              className="mt-1"
            />
          )}
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-4">
        {decision.category ? (
          <DecisionCategoryBadge category={decision.category} size="sm" />
        ) : (
          <span className="text-sm text-surface-400 italic">—</span>
        )}
      </td>

      {/* Impact Areas */}
      <td className="px-4 py-4">
        {decision.impact_areas && decision.impact_areas.length > 0 ? (
          <DecisionImpactChips
            impactAreas={decision.impact_areas}
            size="sm"
            maxDisplay={3}
          />
        ) : (
          <span className="text-sm text-surface-400 italic">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <DecisionStatusBadge status={decision.status} size="sm" />
      </td>

      {/* Decision Maker */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg',
              'text-xs font-semibold',
              'bg-gradient-to-br from-primary-500 to-primary-600 text-white',
              'shadow-sm shadow-primary-500/20'
            )}
          >
            {decision.decision_maker?.avatar_url ? (
              <img
                src={decision.decision_maker.avatar_url}
                alt=""
                className="h-7 w-7 rounded-lg object-cover"
              />
            ) : (
              getInitials(
                decision.decision_maker?.full_name ||
                  decision.decision_maker_name ||
                  'U'
              )
            )}
          </div>
          <span className="text-sm text-surface-700">
            {decision.decision_maker?.full_name ||
              decision.decision_maker_name || (
                <span className="text-surface-400">Unknown</span>
              )}
          </span>
        </div>
      </td>

      {/* Date */}
      <td className="px-4 py-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-surface-600">
          <Calendar className="h-3 w-3 opacity-60" />
          {formatDateReadable(decision.decision_date || decision.created_at)}
        </span>
      </td>

      {/* Action */}
      <td className="px-4 py-4">
        <Link
          href={`/decisions/${decision.id}`}
          aria-label="View decision details"
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
});

export function DecisionsTable({ decisions }: DecisionsTableProps) {
  if (decisions.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100/80 mb-4">
          <FileText className="h-8 w-8 text-surface-400" />
        </div>
        <h3 className="text-lg font-semibold text-surface-900">
          No decisions found
        </h3>
        <p className="mt-1.5 text-surface-500 max-w-sm">
          Decisions will appear here after processing meetings or creating them manually
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
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                ID
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Decision
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Category
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Impact
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Status
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Decision Maker
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                Date
              </th>
              <th className="px-4 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100/60">
            {decisions.map((decision, index) => (
              <DecisionRowComponent key={decision.id} decision={decision} index={index} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}




