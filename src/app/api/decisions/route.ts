import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { generateEmbedding } from '@/lib/embeddings/client';
import type { DecisionCategory, DecisionImpactArea, DecisionStatus } from '@/types/enums';

const log = loggers.api;

interface CreateDecisionRequest {
  project_id: string;
  title: string;
  rationale?: string;
  impact?: string;
  category: DecisionCategory;
  impact_areas: DecisionImpactArea[];
  status: DecisionStatus;
  decision_maker_user_id?: string;
  decision_maker_name?: string;
  decision_maker_email?: string;
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

export async function POST(request: NextRequest) {
  try {
    log.info('Creating manual decision');

    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body: CreateDecisionRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const {
      project_id,
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

    // Validate required fields
    if (!project_id || !title || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: project_id, title, category' },
        { status: 400 }
      );
    }

    // Validate category
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate impact_areas
    if (!Array.isArray(impact_areas) || impact_areas.length === 0) {
      return NextResponse.json(
        { error: 'impact_areas must be a non-empty array' },
        { status: 400 }
      );
    }
    for (const area of impact_areas) {
      if (!validImpactAreas.includes(area)) {
        return NextResponse.json(
          { error: `Invalid impact area: ${area}. Must be one of: ${validImpactAreas.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate status
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Cannot create with SUPERSEDED status
    if (status === 'SUPERSEDED') {
      return NextResponse.json(
        { error: 'Cannot create a decision with SUPERSEDED status' },
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
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .single();

    if (!membership && userProfile?.global_role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate embedding
    const text = `${title}. ${rationale || ''}`;
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(text);
    } catch (e) {
      log.warn('Embedding generation failed for decision', {
        title,
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }

    // Get decision maker info if user_id provided
    let makerName = decision_maker_name;
    let makerEmail = decision_maker_email;
    if (decision_maker_user_id) {
      const serviceSupabase = createServiceClient();
      const { data: makerProfile } = await serviceSupabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', decision_maker_user_id)
        .single();

      if (makerProfile) {
        makerName = makerProfile.full_name;
        makerEmail = makerProfile.email;
      }
    }

    // Create the decision
    const serviceSupabase = createServiceClient();
    const { data: newDecision, error } = await serviceSupabase
      .from('decisions')
      .insert({
        project_id,
        title,
        rationale: rationale || null,
        impact: impact || null,
        category,
        impact_areas,
        status,
        decision_maker_user_id: decision_maker_user_id || null,
        decision_maker_name: makerName || null,
        decision_maker_email: makerEmail || null,
        outcome: outcome || null,
        decision_date: decision_date || new Date().toISOString().split('T')[0],
        source: 'manual',
        embedding,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create decision', { error: error.message });
      return NextResponse.json({ error: 'Failed to create decision' }, { status: 500 });
    }

    log.info('Decision created successfully', {
      decisionId: newDecision.id,
      smartId: newDecision.smart_id,
    });

    return NextResponse.json({ success: true, decision: newDecision }, { status: 201 });
  } catch (error) {
    log.error('Unexpected error in decision creation', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
