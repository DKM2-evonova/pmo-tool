import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MeetingIngestion } from '@/components/meetings/meeting-ingestion';

interface NewProjectMeetingPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function NewProjectMeetingPage({
  params,
}: NewProjectMeetingPageProps) {
  const supabase = await createClient();
  const { projectId } = await params;

  // Verify user has access to this project
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user?.id)
    .eq('project_id', projectId)
    .single();

  if (!membership) {
    redirect('/projects');
  }

  // Get project details
  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .single();

  if (!project) {
    redirect('/projects');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">
          Process New Meeting
        </h1>
        <p className="mt-1 text-surface-500">
          Upload a transcript or connect to Google Meet to extract action items,
          decisions, and risks for <strong>{project.name}</strong>
        </p>
      </div>

      <MeetingIngestion
        projects={[{ id: project.id, name: project.name }]}
        preselectedProjectId={projectId}
      />
    </div>
  );
}


