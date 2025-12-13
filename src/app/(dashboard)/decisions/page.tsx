import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { formatDateReadable, getInitials } from '@/lib/utils';

export default async function DecisionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's projects
  const { data: memberships } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user?.id);

  const projectIds = memberships?.map((m) => m.project_id) || [];

  // Get decisions
  const { data: decisions } = await supabase
    .from('decisions')
    .select(
      `
      *,
      decision_maker:profiles!decisions_decision_maker_user_id_fkey(id, full_name, email, avatar_url),
      project:projects(id, name),
      source_meeting:meetings(id, title, date)
    `
    )
    .in('project_id', projectIds.length > 0 ? projectIds : ['none'])
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Decision Log</h1>
          <p className="mt-1 text-surface-500">
            Track key decisions across your projects
          </p>
        </div>
      </div>

      {decisions && decisions.length > 0 ? (
        <div className="space-y-4">
          {decisions.map((decision) => (
            <div key={decision.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-surface-500">
                    <span>
                      {(decision.project as any)?.name || 'Unknown Project'}
                    </span>
                    <span>·</span>
                    <span>
                      {(decision.source_meeting as any)?.date
                        ? formatDateReadable(
                            (decision.source_meeting as any).date
                          )
                        : formatDateReadable(decision.created_at)}
                    </span>
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-surface-900">
                    {decision.title}
                  </h3>
                </div>
              </div>

              {decision.rationale && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-surface-500">
                    Rationale
                  </p>
                  <p className="mt-1 text-surface-700">{decision.rationale}</p>
                </div>
              )}

              {decision.outcome && (
                <div className="mt-4 rounded-lg bg-success-50 p-3">
                  <p className="text-sm font-medium text-success-700">
                    Outcome
                  </p>
                  <p className="mt-1 text-success-600">{decision.outcome}</p>
                </div>
              )}

              {decision.impact && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-surface-500">Impact</p>
                  <p className="mt-1 text-surface-700">{decision.impact}</p>
                </div>
              )}

              <div className="mt-4 flex items-center gap-4 border-t border-surface-100 pt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                    {(decision.decision_maker as any)?.avatar_url ? (
                      <img
                        src={(decision.decision_maker as any).avatar_url}
                        alt=""
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      getInitials(
                        (decision.decision_maker as any)?.full_name ||
                          decision.decision_maker_name ||
                          'U'
                      )
                    )}
                  </div>
                  <span className="text-surface-600">
                    Decision by{' '}
                    {(decision.decision_maker as any)?.full_name ||
                      decision.decision_maker_name ||
                      'Unknown'}
                  </span>
                </div>
                {decision.source_meeting && (
                  <Link
                    href={`/meetings/${(decision.source_meeting as any).id}`}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    View meeting
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-4 h-12 w-12 text-surface-300" />
          <h3 className="text-lg font-medium text-surface-900">
            No decisions yet
          </h3>
          <p className="mt-1 text-surface-500">
            Decisions will appear here after processing meetings
          </p>
        </div>
      )}
    </div>
  );
}

