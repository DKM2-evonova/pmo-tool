import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { AlertTriangle, Plus } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatDateReadable, getInitials, calculateRiskSeverity } from '@/lib/utils';
import { cn } from '@/lib/utils';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">
            Risks & Issues
          </h1>
          <p className="mt-1 text-surface-500">
            Track and mitigate risks across your projects
          </p>
        </div>
      </div>

      {/* Risk Matrix Summary */}
      {allRisks && allRisks.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Link
            href="?filter=high"
            className={cn(
              "card text-center cursor-pointer transition-all hover:shadow-md",
              currentFilter === 'high'
                ? "ring-2 ring-danger-500 bg-danger-50"
                : "hover:bg-surface-50"
            )}
          >
            <p className="text-3xl font-bold text-danger-600">
              {
                allRisks.filter(
                  (r) =>
                    r.status !== 'Closed' &&
                    calculateRiskSeverity(r.probability as any, r.impact as any) ===
                      'High'
                ).length
              }
            </p>
            <p className="mt-1 text-sm text-surface-500">High Severity</p>
          </Link>
          <Link
            href="?filter=med"
            className={cn(
              "card text-center cursor-pointer transition-all hover:shadow-md",
              currentFilter === 'med'
                ? "ring-2 ring-warning-500 bg-warning-50"
                : "hover:bg-surface-50"
            )}
          >
            <p className="text-3xl font-bold text-warning-600">
              {
                allRisks.filter(
                  (r) =>
                    r.status !== 'Closed' &&
                    calculateRiskSeverity(r.probability as any, r.impact as any) ===
                      'Med'
                ).length
              }
            </p>
            <p className="mt-1 text-sm text-surface-500">Medium Severity</p>
          </Link>
          <Link
            href="?filter=low"
            className={cn(
              "card text-center cursor-pointer transition-all hover:shadow-md",
              currentFilter === 'low'
                ? "ring-2 ring-surface-500 bg-surface-50"
                : "hover:bg-surface-50"
            )}
          >
            <p className="text-3xl font-bold text-surface-600">
              {
                allRisks.filter(
                  (r) =>
                    r.status !== 'Closed' &&
                    calculateRiskSeverity(r.probability as any, r.impact as any) ===
                      'Low'
                ).length
              }
            </p>
            <p className="mt-1 text-sm text-surface-500">Low Severity</p>
          </Link>
          <Link
            href="?filter=closed"
            className={cn(
              "card text-center cursor-pointer transition-all hover:shadow-md",
              currentFilter === 'closed'
                ? "ring-2 ring-success-500 bg-success-50"
                : "hover:bg-surface-50"
            )}
          >
            <p className="text-3xl font-bold text-success-600">
              {allRisks.filter((r) => r.status === 'Closed').length}
            </p>
            <p className="mt-1 text-sm text-surface-500">Closed</p>
          </Link>
        </div>
      )}

      {/* Clear Filter Button */}
      {currentFilter && (
        <div className="flex justify-center">
          <Link
            href="/risks"
            className="btn-secondary"
          >
            Clear Filter
          </Link>
        </div>
      )}

      {risks && risks.length > 0 ? (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-surface-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
                  Risk
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {risks.map((risk) => {
                const severity = calculateRiskSeverity(
                  risk.probability as any,
                  risk.impact as any
                );
                return (
                  <tr key={risk.id} className="hover:bg-surface-50 cursor-pointer">
                    <td className="px-6 py-4">
                      <Link href={`/risks/${risk.id}`} className="block">
                        <p className="font-medium text-surface-900 hover:text-primary-700">
                          {risk.title}
                        </p>
                        {risk.description && (
                          <p className="mt-1 line-clamp-1 text-sm text-surface-500">
                            {risk.description}
                          </p>
                        )}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-500">
                      <Link href={`/risks/${risk.id}`} className="block hover:text-primary-700">
                        {(risk.project as any)?.name || '-'}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/risks/${risk.id}`}>
                        <Badge variant={severityVariant[severity]}>
                          {severity} ({risk.probability}/{risk.impact})
                        </Badge>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/risks/${risk.id}`} className="block hover:text-primary-700">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                            {(risk.owner as any)?.avatar_url ? (
                              <img
                                src={(risk.owner as any).avatar_url}
                                alt=""
                                className="h-7 w-7 rounded-full"
                              />
                            ) : (
                              getInitials(
                                (risk.owner as any)?.full_name ||
                                  risk.owner_name ||
                                  'U'
                              )
                            )}
                          </div>
                          <span className="text-sm text-surface-700">
                            {(risk.owner as any)?.full_name ||
                              risk.owner_name ||
                              'Unassigned'}
                          </span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/risks/${risk.id}`}>
                        <Badge variant={statusVariant[risk.status]}>
                          {risk.status}
                        </Badge>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : allRisks && allRisks.length > 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-surface-300" />
          <h3 className="text-lg font-medium text-surface-900">
            No risks match the current filter
          </h3>
          <p className="mt-1 text-surface-500">
            Try clearing the filter or selecting a different category
          </p>
          <div className="mt-4">
            <Link href="/risks" className="btn-secondary">
              Clear Filter
            </Link>
          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-surface-300" />
          <h3 className="text-lg font-medium text-surface-900">
            No risks yet
          </h3>
          <p className="mt-1 text-surface-500">
            Risks will appear here after processing meetings
          </p>
        </div>
      )}
    </div>
  );
}

