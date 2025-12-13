import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { ProcessingStatus } from '@/components/meetings/processing-status';

interface ProcessMeetingPageProps {
  params: Promise<{ meetingId: string }>;
}

export default async function ProcessMeetingPage({
  params,
}: ProcessMeetingPageProps) {
  const supabase = await createClient();
  const { meetingId } = await params;

  // Get meeting
  const { data: meeting, error } = await supabase
    .from('meetings')
    .select(
      `
      *,
      project:projects(id, name)
    `
    )
    .eq('id', meetingId)
    .single();

  if (error || !meeting) {
    notFound();
  }

  // If already processed, redirect to review
  if (meeting.status === 'Review' || meeting.status === 'Published') {
    redirect(`/meetings/${meetingId}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-surface-900">
          Processing Meeting
        </h1>
        <p className="mt-1 text-surface-500">
          {meeting.title || 'Untitled Meeting'}
        </p>
      </div>

      <ProcessingStatus
        meetingId={meeting.id}
        projectId={meeting.project_id}
        initialStatus={meeting.status}
      />
    </div>
  );
}

