import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ActionItemForm } from '@/components/action-items/action-item-form';

export default async function NewActionItemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's projects
  const { data: memberships } = await supabase
    .from('project_members')
    .select('project_id, project:projects(id, name)')
    .eq('user_id', user?.id);

  const projects: Array<{ id: string; name: string }> = [];
  
  if (memberships) {
    for (const m of memberships) {
      // Supabase returns joined relations as arrays or objects depending on the relation type
      const proj = m.project as unknown as { id: string; name: string } | { id: string; name: string }[] | null;
      if (proj) {
        if (Array.isArray(proj)) {
          if (proj[0]) projects.push(proj[0]);
        } else {
          projects.push(proj);
        }
      }
    }
  }

  if (projects.length === 0) {
    redirect('/projects');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">
          Create Action Item
        </h1>
        <p className="mt-1 text-surface-500">
          Manually add a new task to your project
        </p>
      </div>

      <ActionItemForm projects={projects} />
    </div>
  );
}
