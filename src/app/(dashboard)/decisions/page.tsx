import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { formatDateReadable, getInitials } from '@/lib/utils';
import { DecisionsTable } from '@/components/decisions/decisions-table';
import { DecisionFilters } from '@/components/decisions/decision-filters';
import { DecisionSort } from '@/components/decisions/decision-sort';

interface DecisionsPageProps {
  searchParams: Promise<{ project?: string; decisionMaker?: string; status?: string; sort?: string }>;
}

export default async function DecisionsPage({
  searchParams,
}: DecisionsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const projectFilter = params.project;
  const decisionMakerFilter = params.decisionMaker;
  const statusFilter = params.status;
  const sortParam = params.sort;

  // Parse sort parameter
  let sortField: 'created_at' | 'title' | 'decision_maker_name' = 'created_at';
  let sortDirection: 'asc' | 'desc' = 'desc';

  if (sortParam) {
    const [field, direction] = sortParam.split(':');
    if (field === 'date') sortField = 'created_at';
    else if (field === 'title') sortField = 'title';
    else if (field === 'decisionMaker') sortField = 'decision_maker_name';

    if (direction === 'asc' || direction === 'desc') {
      sortDirection = direction;
    }
  }

  // Get user's projects
  const { data: memberships } = await supabase
    .from('project_members')
    .select('project_id, project:projects(id, name)')
    .eq('user_id', user?.id);

  const projectIds = memberships?.map((m) => m.project_id) || [];
  const projects: Array<{ id: string; name: string }> = [];
  if (memberships) {
    for (const m of memberships) {
      const proj = m.project as unknown as { id: string; name: string } | null;
      if (proj) projects.push(proj);
    }
  }

  // Get all decision makers for the filter
  const { data: decisionMakersData } = await supabase
    .from('decisions')
    .select(`
      decision_maker_user_id,
      decision_maker_name,
      decision_maker:profiles!decisions_decision_maker_user_id_fkey(id, full_name, email)
    `)
    .in('project_id', projectIds.length > 0 ? projectIds : ['none']);

  const decisionMakers: Array<{ id: string; name: string }> = [];
  const decisionMakerSet = new Set<string>();

  if (decisionMakersData) {
    for (const decision of decisionMakersData) {
      const maker = decision.decision_maker as any;
      const userId = decision.decision_maker_user_id;
      const name = maker?.full_name || decision.decision_maker_name || 'Unknown';

      if (userId && !decisionMakerSet.has(userId)) {
        decisionMakerSet.add(userId);
        decisionMakers.push({ id: userId, name });
      }
    }
  }

  // Build decisions query
  let query = supabase
    .from('decisions')
    .select(
      `
      *,
      decision_maker:profiles!decisions_decision_maker_user_id_fkey(id, full_name, email, avatar_url),
      project:projects(id, name),
      source_meeting:meetings(id, title, date)
    `
    )
    .in('project_id', projectIds.length > 0 ? projectIds : ['none']);

  // Apply filters
  if (projectFilter) {
    query = query.eq('project_id', projectFilter);
  }

  if (decisionMakerFilter) {
    query = query.eq('decision_maker_user_id', decisionMakerFilter);
  }

  if (statusFilter) {
    if (statusFilter === 'implemented') {
      query = query.not('outcome', 'is', null);
    } else if (statusFilter === 'pending') {
      query = query.is('outcome', null);
    }
  }

  // Apply sorting
  query = query.order(sortField, { ascending: sortDirection === 'asc' });

  const { data: decisions } = await query;

  // Prepare current sort for the component
  const currentSort = sortParam ? {
    field: sortParam.split(':')[0] as 'date' | 'title' | 'decisionMaker',
    direction: sortParam.split(':')[1] as 'asc' | 'desc'
  } : undefined;

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

      {/* Filters and Sorting */}
      <div className="flex flex-col gap-4">
        <DecisionFilters
          projects={projects}
          decisionMakers={decisionMakers}
        />
        <DecisionSort currentSort={currentSort} />
      </div>

      {decisions && decisions.length > 0 ? (
        <DecisionsTable decisions={decisions} />
      ) : (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-4 h-12 w-12 text-surface-300" />
          <h3 className="text-lg font-medium text-surface-900">
            No decisions found
          </h3>
          <p className="mt-1 text-surface-500">
            {projectFilter || decisionMakerFilter || statusFilter
              ? 'Try adjusting your filters to see more decisions'
              : 'Decisions will appear here after processing meetings'
            }
          </p>
        </div>
      )}
    </div>
  );
}

