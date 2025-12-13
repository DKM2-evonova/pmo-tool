import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { AlertTriangle, Plus } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatDateReadable, getInitials, calculateRiskSeverity } from '@/lib/utils';

export default async function RisksPage() {
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

  // Get risks
  const { data: risks } = await supabase
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
      {risks && risks.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-danger-600">
              {
                risks.filter(
                  (r) =>
                    r.status !== 'Closed' &&
                    calculateRiskSeverity(r.probability as any, r.impact as any) ===
                      'High'
                ).length
              }
            </p>
            <p className="mt-1 text-sm text-surface-500">High Severity</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-warning-600">
              {
                risks.filter(
                  (r) =>
                    r.status !== 'Closed' &&
                    calculateRiskSeverity(r.probability as any, r.impact as any) ===
                      'Med'
                ).length
              }
            </p>
            <p className="mt-1 text-sm text-surface-500">Medium Severity</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-surface-600">
              {
                risks.filter(
                  (r) =>
                    r.status !== 'Closed' &&
                    calculateRiskSeverity(r.probability as any, r.impact as any) ===
                      'Low'
                ).length
              }
            </p>
            <p className="mt-1 text-sm text-surface-500">Low Severity</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-success-600">
              {risks.filter((r) => r.status === 'Closed').length}
            </p>
            <p className="mt-1 text-sm text-surface-500">Closed</p>
          </div>
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
                  <tr key={risk.id} className="hover:bg-surface-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-surface-900">
                        {risk.title}
                      </p>
                      {risk.description && (
                        <p className="mt-1 line-clamp-1 text-sm text-surface-500">
                          {risk.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-500">
                      {(risk.project as any)?.name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={severityVariant[severity]}>
                        {severity} ({risk.probability}/{risk.impact})
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
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
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={statusVariant[risk.status]}>
                        {risk.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

