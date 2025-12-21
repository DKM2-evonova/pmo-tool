import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Calendar, User, ExternalLink } from 'lucide-react';
import { formatDateReadable, getInitials } from '@/lib/utils';

interface DecisionPageProps {
  params: Promise<{ id: string }>;
}

export default async function DecisionPage({ params }: DecisionPageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const supabase = await createClient();

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    notFound();
  }

  // Get decision with related data
  const { data: decision } = await supabase
    .from('decisions')
    .select(`
      *,
      decision_maker:profiles!decisions_decision_maker_user_id_fkey(id, full_name, email, avatar_url),
      project:projects(id, name),
      source_meeting:meetings(id, title, date)
    `)
    .eq('id', id)
    .single();

  if (!decision) {
    notFound();
  }

  // Check if user has access to this decision's project
  const { data: membership } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('project_id', decision.project_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/decisions"
          className="flex items-center gap-2 text-surface-600 hover:text-surface-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Decision Log
        </Link>
      </div>

      {/* Decision Details */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-surface-500 mb-2">
              <span>{(decision.project as any)?.name || 'Unknown Project'}</span>
              <span>·</span>
              <span>{formatDateReadable(decision.created_at)}</span>
            </div>
            <h1 className="text-2xl font-bold text-surface-900 mb-4">
              {decision.title}
            </h1>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            {decision.rationale && (
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-surface-900 mb-2">
                  <FileText className="h-5 w-5" />
                  Rationale
                </h3>
                <p className="text-surface-700">{decision.rationale}</p>
              </div>
            )}

            {decision.outcome && (
              <div>
                <h3 className="text-lg font-semibold text-success-700 mb-2">
                  Outcome
                </h3>
                <div className="rounded-lg bg-success-50 p-4">
                  <p className="text-success-600">{decision.outcome}</p>
                </div>
              </div>
            )}

            {decision.impact && (
              <div>
                <h3 className="text-lg font-semibold text-surface-900 mb-2">
                  Impact
                </h3>
                <p className="text-surface-700">{decision.impact}</p>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Decision Maker */}
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-surface-900 mb-2">
                <User className="h-5 w-5" />
                Decision Maker
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                  {(decision.decision_maker as any)?.avatar_url ? (
                    <img
                      src={(decision.decision_maker as any).avatar_url}
                      alt=""
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    getInitials(
                      (decision.decision_maker as any)?.full_name ||
                        decision.decision_maker_name ||
                        'U'
                    )
                  )}
                </div>
                <div>
                  <p className="font-medium text-surface-900">
                    {(decision.decision_maker as any)?.full_name ||
                      decision.decision_maker_name ||
                      'Unknown'}
                  </p>
                  {(decision.decision_maker as any)?.email && (
                    <p className="text-sm text-surface-500">
                      {(decision.decision_maker as any).email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Source Meeting */}
            {decision.source_meeting && (
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-surface-900 mb-2">
                  <Calendar className="h-5 w-5" />
                  Source Meeting
                </h3>
                <Link
                  href={`/meetings/${(decision.source_meeting as any).id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-surface-900">
                      {(decision.source_meeting as any).title}
                    </p>
                    {(decision.source_meeting as any).date && (
                      <p className="text-sm text-surface-500">
                        {formatDateReadable((decision.source_meeting as any).date)}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-surface-400" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}















