import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processMeeting } from '@/lib/llm/processor';
import { getRelevantContext } from '@/lib/llm/relevant-context';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const supabase = await createClient();
    const { meetingId } = await params;

    // Get meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (meeting.status === 'Deleted') {
      return NextResponse.json({ error: 'Cannot process a deleted meeting' }, { status: 400 });
    }

    // Update status to Processing
    const { error: statusError } = await supabase
      .from('meetings')
      .update({ status: 'Processing' })
      .eq('id', meetingId);

    if (statusError) {
      console.error('Failed to update meeting status to Processing:', statusError);
      return NextResponse.json({ error: 'Failed to update meeting status' }, { status: 500 });
    }

    // Get project members for owner resolution
    const { data: members } = await supabase
      .from('project_members')
      .select('user_id, profile:profiles(*)')
      .eq('project_id', meeting.project_id);

    const projectMembers =
      members?.map((m) => m.profile as any).filter(Boolean) || [];

    // Get relevant open items for context injection (filtered by semantic similarity)
    const relevantContext = await getRelevantContext(
      meeting.project_id,
      meeting.transcript_text || ''
    );

    // Process the meeting
    const result = await processMeeting({
      meeting,
      projectMembers,
      openActionItems: relevantContext.actionItems,
      openDecisions: relevantContext.decisions,
      openRisks: relevantContext.risks,
    });

    // Log LLM metrics
    await supabase.from('llm_metrics').insert({
      model: result.model,
      is_fallback: result.isFallback,
      success: result.success,
      latency_ms: result.latencyMs,
      meeting_id: meetingId,
      error_message: result.error || null,
    });

    if (!result.success) {
      // Update meeting to Failed
      await supabase
        .from('meetings')
        .update({
          status: 'Failed',
          error_message: result.error,
        })
        .eq('id', meetingId);

      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Store the output and proposed items
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        status: 'Review',
        recap: result.output?.recap,
        tone: result.output?.tone,
        fishbone: result.output?.fishbone,
        processed_at: new Date().toISOString(),
      })
      .eq('id', meetingId);

    if (updateError) {
      throw updateError;
    }

    // Create or update proposed change set
    const { error: changeSetError } = await supabase
      .from('proposed_change_sets')
      .upsert(
        {
          meeting_id: meetingId,
          proposed_items: result.proposedItems,
          lock_version: 1,
        },
        {
          onConflict: 'meeting_id',
        }
      );

    if (changeSetError) {
      throw changeSetError;
    }

    return NextResponse.json({
      success: true,
      model: result.model,
      isFallback: result.isFallback,
    });
  } catch (error) {
    console.error('Processing API error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Processing failed';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

