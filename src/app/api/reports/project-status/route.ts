/**
 * API Route: Project Status Report Data
 * GET /api/reports/project-status?projectId=xxx
 * Returns action items, risks, and decisions for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';

const log = loggers.api;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Check if user has access to this project
    const { data: membership } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    // Also check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    if (!membership && profile?.global_role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - no access to this project' }, { status: 403 });
    }

    // Fetch project info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch all data in parallel
    const [actionItemsResult, risksResult, decisionsResult] = await Promise.all([
      // Action Items: Open + In Progress, sorted by due_date ascending (past due first, nulls last)
      supabase
        .from('action_items')
        .select(`
          id,
          title,
          description,
          status,
          due_date,
          owner_user_id,
          owner_name,
          owner_email,
          source_meeting_id,
          created_at,
          owner:profiles!action_items_owner_user_id_fkey(id, full_name, email),
          project:projects(id, name),
          source_meeting:meetings(id, title)
        `)
        .eq('project_id', projectId)
        .in('status', ['Open', 'In Progress'])
        .order('due_date', { ascending: true, nullsFirst: false }),

      // Risks: Open only, sorted by created_at descending (newest first)
      supabase
        .from('risks')
        .select(`
          id,
          title,
          description,
          probability,
          impact,
          mitigation,
          status,
          owner_user_id,
          owner_name,
          owner_email,
          source_meeting_id,
          created_at,
          owner:profiles!risks_owner_user_id_fkey(id, full_name, email),
          project:projects(id, name),
          source_meeting:meetings(id, title)
        `)
        .eq('project_id', projectId)
        .eq('status', 'Open')
        .order('created_at', { ascending: false }),

      // Decisions: All, sorted by created_at descending (newest first)
      supabase
        .from('decisions')
        .select(`
          id,
          title,
          rationale,
          impact,
          outcome,
          decision_maker_user_id,
          decision_maker_name,
          decision_maker_email,
          source_meeting_id,
          created_at,
          decision_maker:profiles!decisions_decision_maker_user_id_fkey(id, full_name, email),
          project:projects(id, name),
          source_meeting:meetings(id, title)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
    ]);

    if (actionItemsResult.error) {
      log.error('Error fetching action items', { error: actionItemsResult.error.message });
      return NextResponse.json({ error: 'Failed to fetch action items' }, { status: 500 });
    }

    if (risksResult.error) {
      log.error('Error fetching risks', { error: risksResult.error.message });
      return NextResponse.json({ error: 'Failed to fetch risks' }, { status: 500 });
    }

    if (decisionsResult.error) {
      log.error('Error fetching decisions', { error: decisionsResult.error.message });
      return NextResponse.json({ error: 'Failed to fetch decisions' }, { status: 500 });
    }

    log.info('Project status report data fetched', {
      projectId,
      actionItemsCount: actionItemsResult.data?.length || 0,
      risksCount: risksResult.data?.length || 0,
      decisionsCount: decisionsResult.data?.length || 0,
    });

    return NextResponse.json({
      project,
      actionItems: actionItemsResult.data || [],
      risks: risksResult.data || [],
      decisions: decisionsResult.data || [],
    });
  } catch (error) {
    log.error('Unexpected error in project status report', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
