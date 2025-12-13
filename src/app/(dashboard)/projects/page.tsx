import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { FolderOpen, Plus, Users, Calendar } from 'lucide-react';
import { formatDateReadable } from '@/lib/utils';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user profile to check if admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', user?.id)
    .single();

  const isAdmin = profile?.global_role === 'admin';

  // Get user's projects with member count
  const { data: projects } = await supabase.from('projects').select(`
      *,
      project_members(count),
      meetings(count)
    `);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Projects</h1>
          <p className="mt-1 text-surface-500">
            Manage your projects and team assignments
          </p>
        </div>
        {isAdmin && (
          <Link href="/projects/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        )}
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="card-hover"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50">
                  <FolderOpen className="h-6 w-6 text-primary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-surface-900">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-surface-500">
                      {project.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm text-surface-500">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>
                    {(project.project_members as { count: number }[])?.[0]
                      ?.count || 0}{' '}
                    members
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {(project.meetings as { count: number }[])?.[0]?.count ||
                      0}{' '}
                    meetings
                  </span>
                </div>
              </div>
              <div className="mt-3 text-xs text-surface-400">
                Created {formatDateReadable(project.created_at)}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="mb-4 h-12 w-12 text-surface-300" />
          <h3 className="text-lg font-medium text-surface-900">
            No projects yet
          </h3>
          <p className="mt-1 text-surface-500">
            {isAdmin
              ? 'Create your first project to get started'
              : 'Ask an administrator to add you to a project'}
          </p>
          {isAdmin && (
            <Link href="/projects/new" className="btn-primary mt-4">
              <Plus className="h-4 w-4" />
              Create Project
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

