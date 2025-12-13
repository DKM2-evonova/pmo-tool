import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MeetingIngestion } from '@/components/meetings/meeting-ingestion';

export default async function NewMeetingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's projects
  const { data: memberships } = await supabase
    .from('project_members')
    .select(
      `
      project_id,
      project:projects(id, name)
    `
    )
    .eq('user_id', user?.id);

  const projects: Array<{ id: string; name: string }> = [];
  if (memberships) {
    for (const m of memberships) {
      const proj = m.project as unknown as { id: string; name: string } | null;
      if (proj) {
        projects.push({ id: proj.id, name: proj.name });
      }
    }
  }

  if (projects.length === 0) {
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
          decisions, and risks
        </p>
      </div>

      <MeetingIngestion projects={projects} />
    </div>
  );
}

