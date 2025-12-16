import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { AlertTriangle, Sparkles, ChevronRight, X } from 'lucide-react';
import { Badge } from '@/components/ui';
import { getInitials, calculateRiskSeverity, cn } from '@/lib/utils';

interface RisksPageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function RisksPage({ searchParams }: RisksPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const currentFilter = params.filter;

  // Get user's projects
  const { data: memberships } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user?.id);

  const projectIds = memberships?.map((m) => m.project_id) || [];

  // Get risks
  const { data: allRisks } = await supabase
    .from('risks')
    .select(
      `
      *,
      owner:profiles!risks_owner_user_id_fkey(id, full_name, email, avatar_url),
      project:projects(id, name),
      source_meeting:meetings(id, title)
    `
    )
    .in('project_id', projectIds.length > 0 ? projectIds : ['none'])
    .order('created_at', { ascending: false });

  // Filter risks based on current filter
  let risks = allRisks;
  if (currentFilter && allRisks) {
    switch (currentFilter) {
      case 'high':
        risks = allRisks.filter(
          (r) =>
            r.status !== 'Closed' &&
            calculateRiskSeverity(r.probability as any, r.impact as any) === 'High'
        );
        break;
      case 'med':
        risks = allRisks.filter(
          (r) =>
            r.status !== 'Closed' &&
            calculateRiskSeverity(r.probability as any, r.impact as any) === 'Med'
        );
        break;
      case 'low':
        risks = allRisks.filter(
          (r) =>
            r.status !== 'Closed' &&
            calculateRiskSeverity(r.probability as any, r.impact as any) === 'Low'
        );
        break;
      case 'closed':
        risks = allRisks.filter((r) => r.status === 'Closed');
        break;
      default:
        risks = allRisks;
    }
  }

  const statusVariant: Record<string, 'default' | 'warning' | 'success'> = {
    Open: 'default',
    'In Progress': 'warning',
    Closed: 'success',
  };

  const severityVariant: Record<string, 'default' | 'warning' | 'danger'> = {
    Low: 'default',
    Med: 'warning',
    High: 'danger',
  };

  // Calculate counts
  const highCount = allRisks?.filter(
    (r) => r.status !== 'Closed' && calculateRiskSeverity(r.probability as any, r.impact as any) === 'High'
  ).length || 0;
  const medCount = allRisks?.filter(
    (r) => r.status !== 'Closed' && calculateRiskSeverity(r.probability as any, r.impact as any) === 'Med'
  ).length || 0;
  const lowCount = allRisks?.filter(
    (r) => r.status !== 'Closed' && calculateRiskSeverity(r.probability as any, r.impact as any) === 'Low'
  ).length || 0;
  const closedCount = allRisks?.filter((r) => r.status === 'Closed').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-900">Risks & Issues</h1>
            <span className="glass-badge text-primary-600">
              <Sparkles className="mr-1 h-3 w-3" />
              {allRisks?.length || 0} total
            </span>
          </div>
          <p className="mt-1.5 text-surface-500">
            Track and mitigate risks across your projects
          </p>
        </div>
      </div>

      {/* Risk Matrix Summary */}
      {allRisks && allRisks.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { filter: 'high', count: highCount, label: 'High Severity', color: 'danger', gradient: 'from-danger-50 to-danger-100/50' },
            { filter: 'med', count: medCount, label: 'Medium Severity', color: 'warning', gradient: 'from-warning-50 to-warning-100/50' },
            { filter: 'low', count: lowCount, label: 'Low Severity', color: 'surface', gradient: 'from-surface-100 to-surface-200/50' },
            { filter: 'closed', count: closedCount, label: 'Closed', color: 'success', gradient: 'from-success-50 to-success-100/50' },
          ].map((item) => (
            <Link
              key={item.filter}
              href={`?filter=${item.filter}`}
              className={cn(
                'group relative overflow-hidden rounded-2xl p-5 text-center',
                'bg-gradient-to-br border border-white/60',
                item.gradient,
                'shadow-lg transition-all duration-300',
                'hover:scale-[1.02] hover:shadow-xl',
                currentFilter === item.filter && `ring-2 ring-${item.color}-500`
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <p className={cn('relative text-3xl font-bold', `text-${item.color}-600`)}>
                {item.count}
              </p>
              <p className="relative mt-1 text-sm font-medium text-surface-600">{item.label}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Clear Filter Button */}
      {currentFilter && (
        <div className="flex justify-center">
          <Link
            href="/risks"
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2',
              'bg-white/80 backdrop-blur-sm',
              'border border-surface-200/80',
              'text-sm font-medium text-surface-600',
              'shadow-soft hover:shadow-md',
              'transition-all duration-200',
              'hover:bg-white hover:text-surface-900'
            )}
          >
            <X className="h-4 w-4" />
            Clear Filter
          </Link>
        </div>
      )}

      {risks && risks.length > 0 ? (
        <div className="glass-panel overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200/60 bg-surface-50/50">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Risk
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Project
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Severity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Owner
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Status
                  </th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100/60">
                {risks.map((risk, index) => {
                  const severity = calculateRiskSeverity(
                    risk.probability as any,
                    risk.impact as any
                  );
                  return (
                    <tr
                      key={risk.id}
                      className={cn(
                        'group transition-colors duration-150',
                        'hover:bg-white/60',
                        'animate-fade-in'
                      )}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="px-6 py-4">
                        <Link href={`/risks/${risk.id}`} className="block">
                          <p className="font-medium text-surface-900 group-hover:text-primary-600 transition-colors">
                            {risk.title}
                          </p>
                          {risk.description && (
                            <p className="mt-1 line-clamp-1 text-sm text-surface-500">
                              {risk.description}
                            </p>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-surface-600">
                          {(risk.project as any)?.name || (
                            <span className="text-surface-400">-</span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={severityVariant[severity]} dot>
                          {severity} ({risk.probability}/{risk.impact})
                        </Badge>
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
                            {(risk.owner as any)?.avatar_url ? (
                              <img
                                src={(risk.owner as any).avatar_url}
                                alt=""
                                className="h-8 w-8 rounded-lg object-cover"
                              />
                            ) : (
                              getInitials(
                                (risk.owner as any)?.full_name ||
                                  risk.owner_name ||
                                  'U'
                              )
                            )}
                          </div>
                          <span className="text-sm font-medium text-surface-700">
                            {(risk.owner as any)?.full_name ||
                              risk.owner_name || (
                                <span className="text-surface-400 font-normal">Unassigned</span>
                              )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={statusVariant[risk.status]} dot>
                          {risk.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/risks/${risk.id}`}
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
      ) : allRisks && allRisks.length > 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100/80 mb-4">
            <AlertTriangle className="h-8 w-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900">
            No risks match the current filter
          </h3>
          <p className="mt-1.5 text-surface-500 max-w-sm">
            Try clearing the filter or selecting a different category
          </p>
          <Link
            href="/risks"
            className={cn(
              'mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2',
              'bg-white/80 backdrop-blur-sm',
              'border border-surface-200/80',
              'text-sm font-medium text-surface-600',
              'shadow-soft hover:shadow-md',
              'transition-all duration-200',
              'hover:bg-white hover:text-surface-900'
            )}
          >
            Clear Filter
          </Link>
        </div>
      ) : (
        <div className="glass-panel flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100/80 mb-4">
            <AlertTriangle className="h-8 w-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900">
            No risks yet
          </h3>
          <p className="mt-1.5 text-surface-500 max-w-sm">
            Risks will appear here after processing meetings
          </p>
        </div>
      )}
    </div>
  );
}
