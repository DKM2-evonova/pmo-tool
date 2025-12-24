import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { isValidUUID } from '@/lib/utils';

const log = loggers.api;

interface SupersedeRequest {
  superseded_by_id: string;
}

export async function POST(
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

    log.info('Superseding decision', { decisionId: id });

    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body: SupersedeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { superseded_by_id } = body;

    // Validate superseded_by_id
    if (!superseded_by_id) {
      return NextResponse.json(
        { error: 'superseded_by_id is required' },
        { status: 400 }
      );
    }

    if (!isValidUUID(superseded_by_id)) {
      return NextResponse.json(
        { error: 'Invalid superseded_by_id format' },
        { status: 400 }
      );
    }

    // Cannot supersede by itself
    if (id === superseded_by_id) {
      return NextResponse.json(
        { error: 'A decision cannot supersede itself' },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceClient();

    // Get the decision to be superseded
    const { data: oldDecision, error: oldError } = await serviceSupabase
      .from('decisions')
      .select('project_id, status, smart_id')
      .eq('id', id)
      .single();

    if (oldError || !oldDecision) {
      log.warn('Decision not found', { decisionId: id, error: oldError?.message });
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    // Cannot supersede an already superseded decision
    if (oldDecision.status === 'SUPERSEDED') {
      return NextResponse.json(
        { error: 'This decision is already superseded' },
        { status: 400 }
      );
    }

    // Get the new decision that will supersede
    const { data: newDecision, error: newError } = await serviceSupabase
      .from('decisions')
      .select('project_id, status, smart_id')
      .eq('id', superseded_by_id)
      .single();

    if (newError || !newDecision) {
      log.warn('Superseding decision not found', {
        supersededById: superseded_by_id,
        error: newError?.message,
      });
      return NextResponse.json(
        { error: 'Superseding decision not found' },
        { status: 404 }
      );
    }

    // Both decisions must be in the same project
    if (oldDecision.project_id !== newDecision.project_id) {
      return NextResponse.json(
        { error: 'Both decisions must belong to the same project' },
        { status: 400 }
      );
    }

    // New decision must be APPROVED (makes logical sense)
    if (newDecision.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'The superseding decision must have APPROVED status' },
        { status: 400 }
      );
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
      .eq('project_id', oldDecision.project_id)
      .eq('user_id', user.id)
      .single();

    if (!membership && userProfile?.global_role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the old decision to SUPERSEDED
    const { data: updatedDecision, error: updateError } = await serviceSupabase
      .from('decisions')
      .update({
        status: 'SUPERSEDED',
        superseded_by_id: superseded_by_id,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      log.error('Failed to supersede decision', { decisionId: id, error: updateError.message });
      return NextResponse.json({ error: 'Failed to supersede decision' }, { status: 500 });
    }

    log.info('Decision superseded successfully', {
      decisionId: id,
      oldSmartId: oldDecision.smart_id,
      supersededById: superseded_by_id,
      newSmartId: newDecision.smart_id,
    });

    return NextResponse.json({
      success: true,
      decision: updatedDecision,
      superseded_by_smart_id: newDecision.smart_id,
    });
  } catch (error) {
    log.error('Unexpected error in decision supersede', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
