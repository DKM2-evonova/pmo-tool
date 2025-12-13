import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, List, LayoutGrid } from 'lucide-react';
import { ActionItemsTable } from '@/components/action-items/action-items-table';
import { KanbanBoard } from '@/components/action-items/kanban-board';
import { ProjectFilter } from '@/components/action-items/project-filter';

interface ActionItemsPageProps {
  searchParams: Promise<{ view?: string; project?: string }>;
}

export default async function ActionItemsPage({
  searchParams,
}: ActionItemsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const view = params.view || 'list';
  const projectFilter = params.project;

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

  // Get action items
  let query = supabase
    .from('action_items')
    .select(
      `
      *,
      owner:profiles!action_items_owner_user_id_fkey(id, full_name, email, avatar_url),
      project:projects(id, name),
      source_meeting:meetings(id, title)
    `
    )
    .in('project_id', projectIds.length > 0 ? projectIds : ['none'])
    .order('updated_at', { ascending: false });

  if (projectFilter) {
    query = query.eq('project_id', projectFilter);
  }

  const { data: actionItems, error: actionItemsError } = await query;

  console.log('Action items query result:', {
    actionItems: actionItems?.length || 0,
    error: actionItemsError,
    projectIds
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Action Items</h1>
          <p className="mt-1 text-surface-500">
            Track and manage tasks across all projects
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/action-items/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New Task
          </Link>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <ProjectFilter projects={projects} currentProject={projectFilter} />
        </div>

        <div className="flex rounded-lg border border-surface-200 bg-white">
          <Link
            href="?view=list"
            className={`flex items-center gap-2 px-3 py-2 text-sm ${
              view === 'list'
                ? 'bg-surface-100 text-surface-900'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            <List className="h-4 w-4" />
            List
          </Link>
          <Link
            href="?view=kanban"
            className={`flex items-center gap-2 px-3 py-2 text-sm ${
              view === 'kanban'
                ? 'bg-surface-100 text-surface-900'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </Link>
        </div>
      </div>

      {/* Content */}
      {view === 'kanban' ? (
        <KanbanBoard actionItems={actionItems || []} />
      ) : (
        <ActionItemsTable actionItems={actionItems || []} />
      )}

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-medium text-yellow-800">Debug Info</h3>
          <p className="text-sm text-yellow-700 mt-1">
            Action Items Found: {actionItems?.length || 0}
          </p>
          <p className="text-sm text-yellow-700">
            Projects Found: {projects.length}
          </p>
          {actionItemsError && (
            <p className="text-sm text-red-600 mt-2">
              Error: {actionItemsError.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

