import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';

const log = loggers.api;

// DELETE - Delete a project (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId } = resolvedParams;

    log.info('DELETE /api/projects/[projectId] - Starting project deletion', { projectId });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user's role - only admins can delete projects
    const { data: profile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    if (profile?.global_role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required to delete projects' },
        { status: 403 }
      );
    }

    const serviceSupabase = createServiceClient();

    // Check project exists
    const { data: existingProject, error: existingError } = await serviceSupabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (existingError || !existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get counts of related items before deletion for the response
    log.info('Counting related items before deletion', { projectId });
    const [
      { count: meetingsCount },
      { count: actionItemsCount },
      { count: decisionsCount },
      { count: risksCount },
      { count: membersCount },
      { count: contactsCount }
    ] = await Promise.all([
      serviceSupabase.from('meetings').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
      serviceSupabase.from('action_items').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
      serviceSupabase.from('decisions').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
      serviceSupabase.from('risks').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
      serviceSupabase.from('project_members').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
      serviceSupabase.from('project_contacts').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
    ]);

    log.info('Related items counted', {
      projectId,
      meetingsCount,
      actionItemsCount,
      decisionsCount,
      risksCount,
      membersCount,
      contactsCount
    });

    // Delete the project - cascade will handle related records
    log.info('Executing project delete', { projectId });
    const { error: deleteError } = await serviceSupabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (deleteError) {
      log.error('Failed to delete project', { projectId, error: deleteError.message, code: deleteError.code, details: deleteError.details });
      return NextResponse.json({ error: 'Failed to delete project: ' + deleteError.message }, { status: 500 });
    }

    log.info('Project deleted successfully', {
      projectId,
      projectName: existingProject.name,
      deletedBy: user.id
    });

    return NextResponse.json({
      success: true,
      deleted: {
        project: existingProject.name,
        meetings: meetingsCount || 0,
        action_items: actionItemsCount || 0,
        decisions: decisionsCount || 0,
        risks: risksCount || 0,
        members: membersCount || 0,
        contacts: contactsCount || 0
      }
    });
  } catch (error) {
    log.error('Unexpected error deleting project', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
