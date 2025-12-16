import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { isValidUUID } from '@/lib/utils';

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

    // Verify user has access to the project (either as member or admin)
    const { data: membership } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('project_id', existingRisk.project_id)
      .eq('user_id', user.id)
      .single();

    const { data: profile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    if (!membership && profile?.global_role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the update data
    const body: UpdateRequest = await request.json();
    const { content, title, description, probability, impact, mitigation, status, owner_user_id } = body;

    // Handle status update (content provided)
    if (content) {
      log.debug('Adding status update for risk', { riskId: id });

      // Get user profile for the update
      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      log.debug('User profile retrieved', { userId: user.id, hasProfile: !!profile });

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
        created_by_name: profile?.full_name || 'Unknown',
      };

      // Update the risk
      let currentUpdates: StatusUpdate[] = [];
      try {
        const parsedUpdates = risk.updates ? JSON.parse(risk.updates) : [];
        currentUpdates = Array.isArray(parsedUpdates) ? parsedUpdates : [];
      } catch (parseError) {
        log.warn('Failed to parse risk updates', { riskId: id, error: parseError instanceof Error ? parseError.message : 'Parse error' });
        currentUpdates = [];
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

