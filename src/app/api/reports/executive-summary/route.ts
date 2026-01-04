/**
 * API Route: Executive Summary Generation
 * POST /api/reports/executive-summary
 * Generates an AI-powered executive summary for project status reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';
import { generateExecutiveSummary, ExecutiveSummaryContext } from '@/lib/llm/executive-summary';

const log = loggers.api;

// 7 days in milliseconds
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check if a date string is within the last 7 days
 */
function isWithinLastWeek(dateString: string | null): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  return (now.getTime() - date.getTime()) <= SEVEN_DAYS_MS;
}

/**
 * Check if an action item is overdue
 */
function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'Closed') return false;
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Get owner name from various possible fields
 * Note: Supabase relationship joins can return an array or single object
 */
function getOwnerName(item: {
  owner?: { full_name?: string } | { full_name?: string }[] | null;
  owner_name?: string | null;
}): string {
  // Handle array case from Supabase join
  if (Array.isArray(item.owner) && item.owner[0]?.full_name) {
    return item.owner[0].full_name;
  }
  // Handle single object case
  if (item.owner && !Array.isArray(item.owner) && item.owner.full_name) {
    return item.owner.full_name;
  }
  if (item.owner_name) return item.owner_name;
  return 'Unassigned';
}

/**
 * Get decision maker name from various possible fields
 * Note: Supabase relationship joins can return an array or single object
 */
function getDecisionMakerName(item: {
  decision_maker?: { full_name?: string } | { full_name?: string }[] | null;
  decision_maker_name?: string | null;
}): string {
  // Handle array case from Supabase join
  if (Array.isArray(item.decision_maker) && item.decision_maker[0]?.full_name) {
    return item.decision_maker[0].full_name;
  }
  // Handle single object case
  if (item.decision_maker && !Array.isArray(item.decision_maker) && item.decision_maker.full_name) {
    return item.decision_maker.full_name;
  }
  if (item.decision_maker_name) return item.decision_maker_name;
  return 'Unknown';
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { projectId } = body;

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

    log.info('Fetching data for executive summary', { projectId, projectName: project.name });

    // Calculate date threshold for "recently" (7 days ago)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // Fetch all data in parallel
    const [
      openActionItemsResult,
      recentlyClosedActionItemsResult,
      risksResult,
      decisionsResult,
      milestonesResult,
    ] = await Promise.all([
      // Action Items: Open + In Progress
      supabase
        .from('action_items')
        .select(`
          id,
          title,
          status,
          due_date,
          owner_name,
          owner:profiles!action_items_owner_user_id_fkey(full_name)
        `)
        .eq('project_id', projectId)
        .in('status', ['Open', 'In Progress'])
        .order('due_date', { ascending: true, nullsFirst: false }),

      // Action Items: Recently closed (last 7 days)
      supabase
        .from('action_items')
        .select(`
          id,
          title,
          status,
          due_date,
          updated_at,
          owner_name,
          owner:profiles!action_items_owner_user_id_fkey(full_name)
        `)
        .eq('project_id', projectId)
        .eq('status', 'Closed')
        .gte('updated_at', sevenDaysAgoISO),

      // Risks: Open only
      supabase
        .from('risks')
        .select(`
          id,
          title,
          probability,
          impact,
          mitigation,
          owner_name,
          owner:profiles!risks_owner_user_id_fkey(full_name)
        `)
        .eq('project_id', projectId)
        .eq('status', 'Open')
        .order('created_at', { ascending: false }),

      // Decisions: All, including recent status
      supabase
        .from('decisions')
        .select(`
          id,
          title,
          outcome,
          impact,
          status,
          decision_date,
          created_at,
          decision_maker_name,
          decision_maker:profiles!decisions_decision_maker_user_id_fkey(full_name)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),

      // Milestones: All
      supabase
        .from('milestones')
        .select(`
          id,
          name,
          target_date,
          status,
          sort_order
        `)
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true }),
    ]);

    // Check for errors
    if (openActionItemsResult.error) {
      log.error('Error fetching open action items', { error: openActionItemsResult.error.message });
      return NextResponse.json({ error: 'Failed to fetch action items' }, { status: 500 });
    }
    if (recentlyClosedActionItemsResult.error) {
      log.error('Error fetching closed action items', { error: recentlyClosedActionItemsResult.error.message });
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
    if (milestonesResult.error) {
      log.error('Error fetching milestones', { error: milestonesResult.error.message });
      return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
    }

    const openActionItems = openActionItemsResult.data || [];
    const recentlyClosedActionItems = recentlyClosedActionItemsResult.data || [];
    const risks = risksResult.data || [];
    const decisions = decisionsResult.data || [];
    const milestones = milestonesResult.data || [];

    // Calculate action item metrics
    const openCount = openActionItems.filter(ai => ai.status === 'Open').length;
    const inProgressCount = openActionItems.filter(ai => ai.status === 'In Progress').length;
    const overdueCount = openActionItems.filter(ai => isOverdue(ai.due_date, ai.status)).length;
    const recentlyCompletedCount = recentlyClosedActionItems.length;

    // Calculate risk metrics
    const highSeverityCount = risks.filter(r =>
      r.probability === 'High' || r.impact === 'High'
    ).length;

    // Calculate decision metrics
    const recentDecisionCount = decisions.filter(d =>
      isWithinLastWeek(d.decision_date) || isWithinLastWeek(d.created_at)
    ).length;

    // Calculate milestone metrics
    const completedMilestones = milestones.filter(m => m.status === 'Complete').length;
    const inProgressMilestones = milestones.filter(m => m.status === 'In Progress').length;
    const behindScheduleMilestones = milestones.filter(m => m.status === 'Behind Schedule').length;
    const notStartedMilestones = milestones.filter(m => m.status === 'Not Started').length;

    // Build context for LLM
    const context: ExecutiveSummaryContext = {
      projectName: project.name,
      reportDate: new Date(),
      actionItems: {
        total: openActionItems.length + recentlyClosedActionItems.length,
        open: openCount,
        inProgress: inProgressCount,
        overdue: overdueCount,
        recentlyCompleted: recentlyCompletedCount,
        items: [
          // Open/In Progress items
          ...openActionItems.map(ai => ({
            title: ai.title,
            status: ai.status,
            owner: getOwnerName(ai),
            dueDate: ai.due_date,
            isOverdue: isOverdue(ai.due_date, ai.status),
          })),
          // Recently completed items
          ...recentlyClosedActionItems.map(ai => ({
            title: ai.title,
            status: ai.status,
            owner: getOwnerName(ai),
            dueDate: ai.due_date,
            isOverdue: false,
            isRecentlyCompleted: true,
          })),
        ],
      },
      risks: {
        total: risks.length,
        highSeverity: highSeverityCount,
        items: risks.map(r => ({
          title: r.title,
          probability: r.probability,
          impact: r.impact,
          mitigation: r.mitigation || '',
          owner: getOwnerName(r),
        })),
      },
      decisions: {
        total: decisions.length,
        recentCount: recentDecisionCount,
        items: decisions.map(d => ({
          title: d.title,
          outcome: d.outcome,
          impact: d.impact,
          status: d.status || 'PROPOSED',
          decisionDate: d.decision_date || d.created_at,
        })),
      },
      milestones: {
        total: milestones.length,
        completed: completedMilestones,
        inProgress: inProgressMilestones,
        behindSchedule: behindScheduleMilestones,
        notStarted: notStartedMilestones,
        upcoming: milestones
          .filter(m => m.status !== 'Complete')
          .map(m => ({
            name: m.name,
            targetDate: m.target_date,
            status: m.status,
          })),
      },
    };

    log.info('Context prepared for executive summary', {
      projectId,
      actionItemsTotal: context.actionItems.total,
      overdueCount: context.actionItems.overdue,
      recentlyCompletedCount: context.actionItems.recentlyCompleted,
      risksTotal: context.risks.total,
      highSeverityRisks: context.risks.highSeverity,
      decisionsTotal: context.decisions.total,
      recentDecisions: context.decisions.recentCount,
      milestonesTotal: context.milestones.total,
    });

    // Generate the summary
    const result = await generateExecutiveSummary(context);

    const totalLatencyMs = Date.now() - startTime;

    if (!result.success) {
      log.error('Executive summary generation failed', {
        projectId,
        error: result.error,
        latencyMs: totalLatencyMs,
      });
      return NextResponse.json(
        { error: 'Failed to generate executive summary', details: result.error },
        { status: 500 }
      );
    }

    log.info('Executive summary generated successfully', {
      projectId,
      model: result.model,
      llmLatencyMs: result.latencyMs,
      totalLatencyMs,
      summaryLength: result.summary?.length || 0,
    });

    return NextResponse.json({
      summary: result.summary,
      model: result.model,
      latencyMs: totalLatencyMs,
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    log.error('Unexpected error in executive summary generation', {
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
