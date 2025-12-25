import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { ProcessingStatus } from '@/components/meetings/processing-status';
import { CategorySelectionStep } from '@/components/meetings/category-selection-step';

interface ProcessMeetingPageProps {
  params: Promise<{ meetingId: string }>;
}

export default async function ProcessMeetingPage({
  params,
}: ProcessMeetingPageProps) {
  const supabase = await createClient();
  const { meetingId } = await params;

  // Get meeting and average processing time in parallel
  const [meetingResult, avgTimeResult] = await Promise.all([
    supabase
      .from('meetings')
      .select(
        `
        *,
        project:projects(id, name)
      `
      )
      .eq('id', meetingId)
      .single(),
    supabase.rpc('get_avg_processing_time_ms'),
  ]);

  const { data: meeting, error } = meetingResult;

  if (error || !meeting) {
    notFound();
  }

  // If already processed, redirect to review
  if (meeting.status === 'Review' || meeting.status === 'Published') {
    redirect(`/meetings/${meetingId}`);
  }

  // Get estimated processing time (default to 30 seconds if no data)
  const estimatedMs = avgTimeResult.data?.[0]?.avg_latency_ms ?? 30000;

  // If meeting doesn't have a category (e.g., auto-ingested from Drive), show category selection first
  const needsCategorySelection = !meeting.category;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-surface-900">
          {needsCategorySelection ? 'Select Meeting Category' : 'Processing Meeting'}
        </h1>
        <p className="mt-1 text-surface-500">
          {meeting.title || 'Untitled Meeting'}
        </p>
        {meeting.is_auto_ingested && needsCategorySelection && (
          <p className="mt-2 text-sm text-primary-600">
            This meeting was auto-imported from Google Drive
          </p>
        )}
      </div>

      {needsCategorySelection ? (
        <CategorySelectionStep
          meetingId={meeting.id}
          projectId={meeting.project_id}
        />
      ) : (
        <ProcessingStatus
          meetingId={meeting.id}
          projectId={meeting.project_id}
          initialStatus={meeting.status}
          estimatedProcessingMs={estimatedMs}
        />
      )}
    </div>
  );
}

