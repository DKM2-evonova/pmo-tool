import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get user's projects
  const { data: projectMemberships } = await supabase
    .from('project_members')
    .select(
      `
      project_id,
      project_role,
      project:projects(id, name)
    `
    )
    .eq('user_id', user.id);

  const projects: Array<{ id: string; name: string; role: string }> = [];
  if (projectMemberships) {
    for (const m of projectMemberships) {
      const proj = m.project as unknown as { id: string; name: string } | null;
      if (proj) {
        projects.push({ id: proj.id, name: proj.name, role: m.project_role });
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      <Sidebar
        projects={projects}
        userRole={profile?.global_role || 'consultant'}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={profile} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

