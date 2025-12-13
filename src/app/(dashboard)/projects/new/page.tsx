import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProjectForm } from '@/components/projects/project-form';

export default async function NewProjectPage() {
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
    redirect('/projects');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">
          Create New Project
        </h1>
        <p className="mt-1 text-surface-500">
          Set up a new project and add team members
        </p>
      </div>

      <ProjectForm />
    </div>
  );
}

