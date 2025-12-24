import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { isValidUUID } from '@/lib/utils';
import type { DecisionCategory, DecisionImpactArea, DecisionStatus } from '@/types/enums';

const log = loggers.api;

interface UpdateDecisionRequest {
  title?: string;
  rationale?: string;
  impact?: string;
  category?: DecisionCategory;
  impact_areas?: DecisionImpactArea[];
  status?: DecisionStatus;
  decision_maker_user_id?: string | null;
  decision_maker_name?: string | null;
  decision_maker_email?: string | null;
  outcome?: string;
  decision_date?: string;
}

const validCategories = [
  'PROCESS_OP_MODEL',
  'TECHNOLOGY_SYSTEMS',
  'DATA_REPORTING',
  'PEOPLE_CHANGE_MGMT',
  'GOVERNANCE_COMPLIANCE',
  'STRATEGY_COMMERCIAL',
];

const validImpactAreas = ['SCOPE', 'COST_BUDGET', 'TIME_SCHEDULE', 'RISK', 'CUSTOMER_EXP'];

const validStatuses = ['PROPOSED', 'APPROVED', 'REJECTED', 'SUPERSEDED'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid decision ID format' }, { status: 400 });
    }

    log.info('Updating decision', { decisionId: id });

    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createServiceClient();

    // Get the decision to check project access
    const { data: existingDecision, error: existingError } = await serviceSupabase
      .from('decisions')
      .select('project_id, status, superseded_by_id')
      .eq('id', id)
      .single();

    if (existingError || !existingDecision) {
      log.warn('Decision not found', { decisionId: id, error: existingError?.message });
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    // Check user has access to the project
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    const { data: membership } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('project_id', existingDecision.project_id)
      .eq('user_id', user.id)
      .single();

    if (!membership && userProfile?.global_role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    let body: UpdateDecisionRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const {
      title,
      rationale,
      impact,
      category,
      impact_areas,
      status,
      decision_maker_user_id,
      decision_maker_name,
      decision_maker_email,
      outcome,
      decision_date,
    } = body;

    // Validate category if provided
    if (category !== undefined && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate impact_areas if provided
    if (impact_areas !== undefined) {
      if (!Array.isArray(impact_areas) || impact_areas.length === 0) {
        return NextResponse.json(
          { error: 'impact_areas must be a non-empty array' },
          { status: 400 }
        );
      }
      for (const area of impact_areas) {
        if (!validImpactAreas.includes(area)) {
          return NextResponse.json(
            {
              error: `Invalid impact area: ${area}. Must be one of: ${validImpactAreas.join(', ')}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Validate status if provided
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Cannot set status to SUPERSEDED via regular update (use supersede endpoint)
    if (status === 'SUPERSEDED') {
      return NextResponse.json(
        { error: 'Use the /supersede endpoint to mark a decision as superseded' },
        { status: 400 }
      );
    }

    // Cannot update a superseded decision's status (except through specific override)
    if (existingDecision.status === 'SUPERSEDED' && status !== undefined) {
      return NextResponse.json(
        { error: 'Cannot change status of a superseded decision' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title;
    if (rationale !== undefined) updateData.rationale = rationale || null;
    if (impact !== undefined) updateData.impact = impact || null;
    if (category !== undefined) updateData.category = category;
    if (impact_areas !== undefined) updateData.impact_areas = impact_areas;
    if (status !== undefined) updateData.status = status;
    if (outcome !== undefined) updateData.outcome = outcome || null;
    if (decision_date !== undefined) updateData.decision_date = decision_date || null;

    // Handle decision maker update
    if (decision_maker_user_id !== undefined) {
      updateData.decision_maker_user_id = decision_maker_user_id || null;

      if (decision_maker_user_id) {
        const { data: makerProfile } = await serviceSupabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', decision_maker_user_id)
          .single();

        if (makerProfile) {
          updateData.decision_maker_name = makerProfile.full_name;
          updateData.decision_maker_email = makerProfile.email;
        }
      } else {
        updateData.decision_maker_name = decision_maker_name ?? null;
        updateData.decision_maker_email = decision_maker_email ?? null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updatedDecision, error: updateError } = await serviceSupabase
      .from('decisions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      log.error('Failed to update decision', { decisionId: id, error: updateError.message });
      return NextResponse.json({ error: 'Failed to update decision' }, { status: 500 });
    }

    log.info('Decision updated successfully', { decisionId: id });

    return NextResponse.json({ success: true, decision: updatedDecision });
  } catch (error) {
    log.error('Unexpected error in decision update', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid decision ID format' }, { status: 400 });
    }

    log.info('Deleting decision', { decisionId: id });

    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createServiceClient();

    // Get the decision to check project access
    const { data: existingDecision, error: existingError } = await serviceSupabase
      .from('decisions')
      .select('project_id')
      .eq('id', id)
      .single();

    if (existingError || !existingDecision) {
      log.warn('Decision not found', { decisionId: id, error: existingError?.message });
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    // Check user has access to the project (must be admin or project owner)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    const { data: membership } = await supabase
      .from('project_members')
      .select('project_role')
      .eq('project_id', existingDecision.project_id)
      .eq('user_id', user.id)
      .single();

    // Only admin or project owner can delete
    if (userProfile?.global_role !== 'admin' && membership?.project_role !== 'owner') {
      return NextResponse.json(
        { error: 'Only admins or project owners can delete decisions' },
        { status: 403 }
      );
    }

    // Delete the decision
    const { error: deleteError } = await serviceSupabase.from('decisions').delete().eq('id', id);

    if (deleteError) {
      log.error('Failed to delete decision', { decisionId: id, error: deleteError.message });
      return NextResponse.json({ error: 'Failed to delete decision' }, { status: 500 });
    }

    log.info('Decision deleted successfully', { decisionId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Unexpected error in decision deletion', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
