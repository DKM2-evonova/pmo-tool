import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TeamOverview } from '@/components/admin/team-overview';

export default async function AdminTeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', user?.id)
    .single();

  if (profile?.global_role !== 'admin') {
    redirect('/dashboard');
  }

  // Fetch all projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, description, created_at')
    .order('name', { ascending: true });

  // Fetch all project members with profiles
  const { data: members } = await supabase
    .from('project_members')
    .select(`
      project_id,
      user_id,
      project_role,
      created_at,
      profile:profiles (
        id,
        email,
        full_name,
        avatar_url,
        global_role
      )
    `);

  // Fetch all project contacts
  const { data: contacts } = await supabase
    .from('project_contacts')
    .select('*')
    .order('name', { ascending: true });

  // Group members and contacts by project
  const projectTeams = projects?.map((project) => {
    const projectMembers = members?.filter((m) => m.project_id === project.id) || [];
    const projectContacts = contacts?.filter((c) => c.project_id === project.id) || [];

    return {
      ...project,
      members: projectMembers.map((m) => ({
        id: m.user_id,
        project_role: m.project_role,
        created_at: m.created_at,
        profile: m.profile as any,
      })),
      contacts: projectContacts,
      member_count: projectMembers.length,
      contact_count: projectContacts.length,
    };
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Team Management</h1>
        <p className="mt-1 text-surface-500">
          View and manage team members and contacts across all projects
        </p>
      </div>

      <TeamOverview projects={projectTeams} />
    </div>
  );
}
