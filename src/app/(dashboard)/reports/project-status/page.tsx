import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProjectStatusClient } from './project-status-client';

export default async function ProjectStatusReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get user's profile to check if admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.global_role === 'admin';

  // Get projects - either all (for admin) or just the user's projects
  let projectsQuery = supabase
    .from('projects')
    .select('id, name')
    .order('name', { ascending: true });

  if (!isAdmin) {
    // Get user's project memberships first
    const { data: memberships } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id);

    const projectIds = memberships?.map((m) => m.project_id) || [];

    if (projectIds.length === 0) {
      // User has no projects
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Project Status Report</h1>
            <p className="mt-1 text-surface-500">
              Generate consolidated status reports for your projects
            </p>
          </div>
          <div className="card flex flex-col items-center justify-center py-12 text-center">
            <p className="text-surface-500">You don&apos;t have access to any projects yet.</p>
            <p className="mt-1 text-sm text-surface-400">Contact your administrator to get project access.</p>
          </div>
        </div>
      );
    }

    projectsQuery = projectsQuery.in('id', projectIds);
  }

  const { data: projects } = await projectsQuery;

  return (
    <ProjectStatusClient projects={projects || []} />
  );
}
