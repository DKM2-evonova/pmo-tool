import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { ReviewUI } from '@/components/meetings/review-ui';
import { MeetingDetails } from '@/components/meetings/meeting-details';
import { RecapDisplay } from '@/components/meetings/recap-display';
import { MeetingSummaryExport } from '@/components/export/meeting-summary-export';

interface MeetingPageProps {
  params: Promise<{ meetingId: string }>;
}

export default async function MeetingPage({ params }: MeetingPageProps) {
  const supabase = await createClient();
  const { meetingId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get meeting with project info
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

  // If still draft, redirect to new meeting flow
  if (meeting.status === 'Draft') {
    redirect(`/meetings/${meetingId}/process`);
  }

  // If processing, redirect to processing status
  if (meeting.status === 'Processing') {
    redirect(`/meetings/${meetingId}/process`);
  }

  // Get proposed change set for Review status
  let proposedChangeSet = null;
  let lockHolder = null;

  if (meeting.status === 'Review') {
    const { data: changeSet } = await supabase
      .from('proposed_change_sets')
      .select(
        `
        *,
        locked_by:profiles!proposed_change_sets_locked_by_user_id_fkey(id, full_name, email)
      `
      )
      .eq('meeting_id', meetingId)
      .single();

    proposedChangeSet = changeSet;

    // Check if locked by someone else
    if (changeSet?.locked_by_user_id && changeSet.locked_by_user_id !== user?.id) {
      // Check if lock is expired (30 minutes)
      const lockTime = new Date(changeSet.locked_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - lockTime.getTime()) / 1000 / 60;

      if (diffMinutes < 30) {
        lockHolder = changeSet.locked_by;
      }
    }
  }

  // Get project members for owner resolution
  const { data: members } = await supabase
    .from('project_members')
    .select('user_id, profile:profiles(id, full_name, email)')
    .eq('project_id', meeting.project_id);

  const projectMembers =
    members?.map((m) => m.profile as any).filter(Boolean) || [];

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', user?.id)
    .single();

  const isAdmin = profile?.global_role === 'admin';

  return (
    <div className="space-y-6">
      {/* Meeting header */}
      <MeetingDetails meeting={meeting} />

      {/* Review UI for Review status */}
      {meeting.status === 'Review' && proposedChangeSet && (
        <ReviewUI
          meetingId={meetingId}
          proposedChangeSet={proposedChangeSet}
          projectMembers={projectMembers}
          lockHolder={lockHolder}
          isAdmin={isAdmin}
          currentUserId={user?.id || ''}
        />
      )}

      {/* Published view */}
      {meeting.status === 'Published' && (
        <>
          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="badge-success">Published</span>
                <span className="text-sm text-surface-500">
                  Processed on{' '}
                  {new Date(meeting.processed_at).toLocaleDateString()}
                </span>
              </div>
              {/* Export button */}
              {meeting.recap && (
                <MeetingSummaryExport
                  meeting={meeting as any}
                  recap={meeting.recap as any}
                  tone={meeting.tone as any}
                  showTone={meeting.category === 'Alignment'}
                />
              )}
            </div>
          </div>

          {/* Recap with all sections */}
          {meeting.recap && (
            <RecapDisplay
              recap={meeting.recap as any}
              tone={meeting.tone as any}
              showTone={meeting.category === 'Alignment'}
            />
          )}
        </>
      )}

      {/* Failed view */}
      {meeting.status === 'Failed' && (
        <div className="card border-danger-200 bg-danger-50">
          <h2 className="mb-2 text-lg font-semibold text-danger-700">
            Processing Failed
          </h2>
          <p className="text-danger-600">
            {meeting.error_message || 'An unknown error occurred'}
          </p>
          <a
            href={`/meetings/${meetingId}/process`}
            className="btn-danger mt-4 inline-flex"
          >
            Retry Processing
          </a>
        </div>
      )}
    </div>
  );
}

