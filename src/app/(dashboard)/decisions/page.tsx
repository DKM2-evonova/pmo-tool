import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { FileText, Sparkles, Plus, Search } from 'lucide-react';
import { DecisionsTable } from '@/components/decisions/decisions-table';
import { DecisionSavedViews } from '@/components/decisions/decision-saved-views';
import { DecisionFacetedFilters } from '@/components/decisions/decision-faceted-filters';
import { DecisionSort } from '@/components/decisions/decision-sort';
import {
  DecisionCategory,
  DecisionImpactArea,
  DecisionStatus,
} from '@/types/enums';

interface DecisionsPageProps {
  searchParams: Promise<{
    project?: string;
    decisionMaker?: string;
    categories?: string;
    impacts?: string;
    statuses?: string;
    view?: string;
    sort?: string;
    search?: string;
  }>;
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
  const categoriesFilter = params.categories?.split(',').filter(Boolean) || [];
  const impactsFilter = params.impacts?.split(',').filter(Boolean) || [];
  const statusesFilter = params.statuses?.split(',').filter(Boolean) || [];
  const searchQuery = params.search;
  const sortParam = params.sort;

  // Parse sort parameter
  let sortField: 'created_at' | 'title' | 'decision_maker_name' | 'smart_id' = 'created_at';
  let sortDirection: 'asc' | 'desc' = 'desc';

  if (sortParam) {
    const [field, direction] = sortParam.split(':');
    if (field === 'date') sortField = 'created_at';
    else if (field === 'title') sortField = 'title';
    else if (field === 'decisionMaker') sortField = 'decision_maker_name';
    else if (field === 'id') sortField = 'smart_id';

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

  // Fetch all decisions for the user's projects (for facet counts)
  const { data: allDecisions } = await supabase
    .from('decisions')
    .select('category, impact_areas, status')
    .in('project_id', projectIds.length > 0 ? projectIds : ['none']);

  // Calculate facet counts
  const facetCounts = {
    categories: {} as Record<DecisionCategory, number>,
    impactAreas: {} as Record<DecisionImpactArea, number>,
    statuses: {} as Record<DecisionStatus, number>,
  };

  // Initialize all counts to 0
  Object.values(DecisionCategory).forEach((cat) => {
    facetCounts.categories[cat] = 0;
  });
  Object.values(DecisionImpactArea).forEach((impact) => {
    facetCounts.impactAreas[impact] = 0;
  });
  Object.values(DecisionStatus).forEach((status) => {
    facetCounts.statuses[status] = 0;
  });

  // Count from actual data
  if (allDecisions) {
    for (const decision of allDecisions) {
      if (decision.category) {
        facetCounts.categories[decision.category as DecisionCategory] =
          (facetCounts.categories[decision.category as DecisionCategory] || 0) + 1;
      }
      if (decision.impact_areas && Array.isArray(decision.impact_areas)) {
        for (const impact of decision.impact_areas as DecisionImpactArea[]) {
          facetCounts.impactAreas[impact] = (facetCounts.impactAreas[impact] || 0) + 1;
        }
      }
      if (decision.status) {
        facetCounts.statuses[decision.status as DecisionStatus] =
          (facetCounts.statuses[decision.status as DecisionStatus] || 0) + 1;
      }
    }
  }

  // Build decisions query with new fields
  let query = supabase
    .from('decisions')
    .select(
      `
      *,
      project:projects(id, name),
      source_meeting:meetings(id, title, date)
    `
    )
    .in('project_id', projectIds.length > 0 ? projectIds : ['none']);

  // Apply project filter
  if (projectFilter) {
    query = query.eq('project_id', projectFilter);
  }

  // Apply decision maker filter
  if (decisionMakerFilter) {
    query = query.eq('decision_maker_user_id', decisionMakerFilter);
  }

  // Apply category filter
  if (categoriesFilter.length > 0) {
    query = query.in('category', categoriesFilter);
  }

  // Apply status filter
  if (statusesFilter.length > 0) {
    query = query.in('status', statusesFilter);
  }

  // Apply impact areas filter (contains any of the selected impacts)
  if (impactsFilter.length > 0) {
    query = query.overlaps('impact_areas', impactsFilter);
  }

  // Apply search filter
  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,rationale.ilike.%${searchQuery}%,smart_id.ilike.%${searchQuery}%`);
  }

  // Apply sorting
  query = query.order(sortField, { ascending: sortDirection === 'asc' });

  const { data: decisions } = await query;

  // Prepare current sort for the component
  const currentSort = sortParam
    ? {
        field: sortParam.split(':')[0] as 'date' | 'title' | 'decisionMaker' | 'id',
        direction: sortParam.split(':')[1] as 'asc' | 'desc',
      }
    : undefined;

  // Check if any filters are active
  const hasActiveFilters =
    projectFilter ||
    decisionMakerFilter ||
    categoriesFilter.length > 0 ||
    impactsFilter.length > 0 ||
    statusesFilter.length > 0 ||
    searchQuery;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-900">Decision Log</h1>
            <span className="glass-badge text-primary-600">
              <Sparkles className="mr-1 h-3 w-3" />
              {decisions?.length || 0} {hasActiveFilters ? 'filtered' : 'total'}
            </span>
          </div>
          <p className="mt-1.5 text-surface-500">
            Track key decisions across your projects
          </p>
        </div>
        <Link
          href="/decisions/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Decision
        </Link>
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="glass-panel p-4 space-y-6 sticky top-24">
            {/* Saved Views */}
            <DecisionSavedViews />

            {/* Faceted Filters */}
            <div className="border-t border-surface-200/60 pt-6">
              <DecisionFacetedFilters counts={facetCounts} />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search and Sort Bar */}
          <div className="glass-panel p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                <form>
                  <input
                    type="text"
                    name="search"
                    defaultValue={searchQuery || ''}
                    placeholder="Search decisions by title, rationale, or ID..."
                    className="input-field pl-10 w-full"
                  />
                </form>
              </div>
              {/* Sort */}
              <DecisionSort currentSort={currentSort} />
            </div>

            {/* Project Filter (simple dropdown for now) */}
            {projects.length > 1 && (
              <div className="mt-4 pt-4 border-t border-surface-200/60">
                <form className="flex items-center gap-2">
                  <label className="text-sm text-surface-500">Project:</label>
                  <select
                    name="project"
                    defaultValue={projectFilter || ''}
                    className="select-field text-sm"
                    onChange={(e) => {
                      const url = new URL(window.location.href);
                      if (e.target.value) {
                        url.searchParams.set('project', e.target.value);
                      } else {
                        url.searchParams.delete('project');
                      }
                      window.location.href = url.toString();
                    }}
                  >
                    <option value="">All Projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </form>
              </div>
            )}
          </div>

          {/* Decisions Table */}
          {decisions && decisions.length > 0 ? (
            <DecisionsTable decisions={decisions as any} />
          ) : (
            <div className="glass-panel flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100/80 mb-4">
                <FileText className="h-8 w-8 text-surface-400" />
              </div>
              <h3 className="text-lg font-semibold text-surface-900">
                No decisions found
              </h3>
              <p className="mt-1.5 text-surface-500 max-w-sm">
                {hasActiveFilters
                  ? 'Try adjusting your filters to see more decisions'
                  : 'Decisions will appear here after processing meetings or creating them manually'}
              </p>
              {!hasActiveFilters && (
                <Link
                  href="/decisions/new"
                  className="mt-4 btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Decision
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
