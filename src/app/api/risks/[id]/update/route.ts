import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { isValidUUID } from '@/lib/utils';
import { EntityStatus, RiskSeverity } from '@/types/enums';

const log = loggers.api;

interface UpdateRequest {
  content?: string;
  title?: string;
  description?: string;
  probability?: string;
  impact?: string;
  mitigation?: string;
  status?: string;
  owner_user_id?: string;
}

interface StatusUpdate {
  id: string;
  content: string;
  created_at: string;
  created_by_user_id: string;
  created_by_name: string;
}

interface UpdateRiskData {
  title?: string;
  description?: string | null;
  probability?: string;
  impact?: string;
  mitigation?: string | null;
  status?: string;
  owner_user_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
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
      return NextResponse.json({ error: 'Invalid risk ID format' }, { status: 400 });
    }

    log.info('Updating risk', { riskId: id });

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createServiceClient();

    // Get the risk to check project access
    const { data: existingRisk, error: existingError } = await serviceSupabase
      .from('risks')
      .select('project_id')
      .eq('id', id)
      .single();

    if (existingError || !existingRisk) {
      log.warn('Risk not found', { riskId: id, error: existingError?.message });
      return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
    }

    // Fetch profile once with all needed fields (global_role for auth, full_name for updates)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('global_role, full_name')
      .eq('id', user.id)
      .single();

    // Verify user has access to the project (either as member or admin)
    const { data: membership } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('project_id', existingRisk.project_id)
      .eq('user_id', user.id)
      .single();

    if (!membership && userProfile?.global_role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the update data
    let body: UpdateRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { content, title, description, probability, impact, mitigation, status, owner_user_id } = body;

    // Handle status update (content provided)
    if (content) {
      log.debug('Adding status update for risk', { riskId: id });

      // Use already-fetched userProfile instead of making another query
      log.debug('User profile retrieved', { userId: user.id, hasProfile: !!userProfile });

      // Get current risk
      const { data: risk, error: fetchError } = await serviceSupabase
        .from('risks')
        .select('updates')
        .eq('id', id)
        .single();

      log.debug('Risk fetch result', { riskId: id, hasData: !!risk, hasError: !!fetchError });

      if (fetchError || !risk) {
        log.warn('Risk not found for status update', { riskId: id, error: fetchError?.message });
        return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
      }

      // Create the update
      const update = {
        id: crypto.randomUUID(),
        content: content.trim(),
        created_at: new Date().toISOString(),
        created_by_user_id: user.id,
        created_by_name: userProfile?.full_name || 'Unknown',
      };

      // Update the risk - handle both TEXT (JSON string) and JSONB formats
      let currentUpdates: StatusUpdate[] = [];
      if (risk.updates) {
        if (Array.isArray(risk.updates)) {
          // JSONB format - already parsed
          currentUpdates = risk.updates as StatusUpdate[];
        } else if (typeof risk.updates === 'string') {
          // TEXT format - needs parsing
          try {
            const parsedUpdates = JSON.parse(risk.updates);
            currentUpdates = Array.isArray(parsedUpdates) ? parsedUpdates : [];
          } catch (parseError) {
            log.warn('Failed to parse risk updates', { riskId: id, error: parseError instanceof Error ? parseError.message : 'Parse error' });
            currentUpdates = [];
          }
        }
      }
      const updatedUpdates = [...currentUpdates, update];

      const { error: updateError } = await serviceSupabase
        .from('risks')
        .update({ updates: JSON.stringify(updatedUpdates) })
        .eq('id', id);

      if (updateError) {
        log.error('Failed to add status update', { riskId: id, error: updateError.message });
        return NextResponse.json({ error: 'Failed to add status update' }, { status: 500 });
      }

      return NextResponse.json({ success: true, update });
    }

    // Handle general risk update
    else if (title !== undefined || description !== undefined || probability !== undefined || impact !== undefined || mitigation !== undefined || status !== undefined || owner_user_id !== undefined) {
      // Validate enum fields if provided
      const validStatuses = Object.values(EntityStatus);
      if (status !== undefined && !validStatuses.includes(status as typeof validStatuses[number])) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
      }

      const validSeverities = Object.values(RiskSeverity);
      if (probability !== undefined && !validSeverities.includes(probability as typeof validSeverities[number])) {
        return NextResponse.json({ error: `Invalid probability. Must be one of: ${validSeverities.join(', ')}` }, { status: 400 });
      }
      if (impact !== undefined && !validSeverities.includes(impact as typeof validSeverities[number])) {
        return NextResponse.json({ error: `Invalid impact. Must be one of: ${validSeverities.join(', ')}` }, { status: 400 });
      }

      // Prepare update data
      const updateData: UpdateRiskData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description || null;
      if (probability !== undefined) updateData.probability = probability;
      if (impact !== undefined) updateData.impact = impact;
      if (mitigation !== undefined) updateData.mitigation = mitigation || null;
      if (status !== undefined) updateData.status = status;

      // Handle owner update separately to ensure owner_name and owner_email are only set when owner is being changed
      if (owner_user_id !== undefined) {
        // Validate owner_user_id is a valid UUID if provided
        if (owner_user_id && !isValidUUID(owner_user_id)) {
          return NextResponse.json({ error: 'Invalid owner_user_id format' }, { status: 400 });
        }

        updateData.owner_user_id = owner_user_id || null;

        if (owner_user_id) {
          const { data: ownerProfile } = await serviceSupabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', owner_user_id)
            .single();

          if (ownerProfile) {
            updateData.owner_name = ownerProfile.full_name;
            updateData.owner_email = ownerProfile.email;
          }
        } else {
          // Clear owner info when removing owner
          updateData.owner_name = null;
          updateData.owner_email = null;
        }
      }

      const { error: updateError } = await serviceSupabase
        .from('risks')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        log.error('Failed to update risk', { riskId: id, error: updateError.message });
        return NextResponse.json({ error: 'Failed to update risk' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  } catch (error) {
    log.error('Unexpected error in risk update', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

