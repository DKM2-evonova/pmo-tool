import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';
import { isValidUUID } from '@/lib/utils';

const log = loggers.api;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const { meetingId } = await params;

    // Validate UUID format
    if (!isValidUUID(meetingId)) {
      return NextResponse.json({ error: 'Invalid meeting ID format' }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    if (profile?.global_role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get meeting to verify it exists and get project_id
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Get all action items created from this meeting
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('id')
      .eq('source_meeting_id', meetingId);

    // Get all decisions created from this meeting
    const { data: decisions } = await supabase
      .from('decisions')
      .select('id')
      .eq('source_meeting_id', meetingId);

    // Get all risks created from this meeting
    const { data: risks } = await supabase
      .from('risks')
      .select('id')
      .eq('source_meeting_id', meetingId);

    // Collect all entity IDs for audit log cleanup
    const entityIds = [
      ...(actionItems?.map(ai => ai.id) || []),
      ...(decisions?.map(d => d.id) || []),
      ...(risks?.map(r => r.id) || []),
      meetingId, // Include the meeting itself
    ];

    // Delete action items (this will cascade delete evidence records)
    if (actionItems && actionItems.length > 0) {
      const { error: deleteActionItemsError } = await supabase
        .from('action_items')
        .delete()
        .eq('source_meeting_id', meetingId);

      if (deleteActionItemsError) {
        throw deleteActionItemsError;
      }
    }

    // Delete decisions (this will cascade delete evidence records)
    if (decisions && decisions.length > 0) {
      const { error: deleteDecisionsError } = await supabase
        .from('decisions')
        .delete()
        .eq('source_meeting_id', meetingId);

      if (deleteDecisionsError) {
        throw deleteDecisionsError;
      }
    }

    // Delete risks (this will cascade delete evidence records)
    if (risks && risks.length > 0) {
      const { error: deleteRisksError } = await supabase
        .from('risks')
        .delete()
        .eq('source_meeting_id', meetingId);

      if (deleteRisksError) {
        throw deleteRisksError;
      }
    }

    // Delete LLM metrics for this meeting
    const { error: deleteLlmMetricsError } = await supabase
      .from('llm_metrics')
      .delete()
      .eq('meeting_id', meetingId);

    if (deleteLlmMetricsError) {
      throw deleteLlmMetricsError;
    }

    // Delete audit logs for all the entities we're deleting
    if (entityIds.length > 0) {
      const { error: deleteAuditLogsError } = await supabase
        .from('audit_logs')
        .delete()
        .in('entity_id', entityIds);

      if (deleteAuditLogsError) {
        // Don't fail the whole operation if audit log deletion fails
        log.warn('Failed to delete audit logs', { meetingId, error: deleteAuditLogsError.message });
      }
    }

    // Mark the meeting as deleted (don't actually delete the record)
    const { data: updatedMeeting, error: updateMeetingError } = await supabase
      .from('meetings')
      .update({ status: 'Deleted' })
      .eq('id', meetingId)
      .select()
      .single();

    if (updateMeetingError) {
      log.error('Failed to update meeting status', { meetingId, error: updateMeetingError.message });
      // Check if it's an enum value error - log details but return generic message
      if (updateMeetingError.message?.includes('enum') || updateMeetingError.message?.includes('Deleted')) {
        log.error('Database migration may be required', {
          meetingId,
          hint: 'Run migration 00017_add_deleted_meeting_status.sql'
        });
      }
      throw new Error('Failed to update meeting status');
    }

    if (!updatedMeeting) {
      throw new Error('Meeting was not updated - no data returned');
    }

    // Verify the status was actually updated
    if (updatedMeeting.status !== 'Deleted') {
      log.error('Meeting status update verification failed', {
        meetingId,
        expectedStatus: 'Deleted',
        actualStatus: updatedMeeting.status
      });
      throw new Error('Failed to update meeting status');
    }

    // Create audit log for the meeting deletion
    await serviceClient.rpc('create_audit_log', {
      p_user_id: user.id,
      p_action_type: 'delete',
      p_entity_type: 'meeting',
      p_entity_id: meetingId,
      p_project_id: meeting.project_id,
      p_before: meeting,
      p_after: { ...meeting, status: 'Deleted' },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        action_items: actionItems?.length || 0,
        decisions: decisions?.length || 0,
        risks: risks?.length || 0,
      }
    });
  } catch (error) {
    log.error('Meeting deletion error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to delete meeting. Please try again.' },
      { status: 500 }
    );
  }
}
























