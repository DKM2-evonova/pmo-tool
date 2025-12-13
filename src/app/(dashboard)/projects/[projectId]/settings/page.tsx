import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { ProjectForm } from '@/components/projects/project-form';
import { MemberManagement } from '@/components/projects/member-management';

interface ProjectSettingsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectSettingsPage({
  params,
}: ProjectSettingsPageProps) {
  const supabase = await createClient();
  const { projectId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', user?.id)
    .single();

  const isAdmin = profile?.global_role === 'admin';

  // Get project details
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  // Get project members
  const { data: members } = await supabase
    .from('project_members')
    .select(
      `
      user_id,
      project_role,
      profile:profiles(id, full_name, email, avatar_url)
    `
    )
    .eq('project_id', projectId);

  // Get all users for adding new members (admin only)
  const { data: allUsers } = isAdmin
    ? await supabase.from('profiles').select('id, full_name, email, avatar_url')
    : { data: null };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Project Settings</h1>
        <p className="mt-1 text-surface-500">{project.name}</p>
      </div>

      {/* Project Details */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-surface-900">
          Project Details
        </h2>
        {isAdmin ? (
          <ProjectForm project={project} />
        ) : (
          <div className="card">
            <div className="space-y-4">
              <div>
                <label className="label">Project Name</label>
                <p className="text-surface-900">{project.name}</p>
              </div>
              {project.description && (
                <div>
                  <label className="label">Description</label>
                  <p className="text-surface-900">{project.description}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-surface-900">
          Team Members
        </h2>
        <MemberManagement
          projectId={projectId}
          members={members || []}
          allUsers={allUsers || []}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}

