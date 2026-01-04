import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { isValidUUID } from '@/lib/utils';
import { EntityStatus } from '@/types/enums';
import type { ActionItemUpdate } from '@/types/database';

const log = loggers.api;

interface UpdateRequest {
  content?: string;
  title?: string;
  description?: string;
  status?: string;
  owner_user_id?: string;
  due_date?: string;
}

interface UpdateActionItemData {
  title?: string;
  description?: string | null;
  status?: string;
  due_date?: string | null;
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
      return NextResponse.json({ error: 'Invalid action item ID format' }, { status: 400 });
    }

    log.info('Updating action item', { actionItemId: id });

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createServiceClient();

    // Get the action item to check project access
    const { data: existingItem, error: existingError } = await serviceSupabase
      .from('action_items')
      .select('project_id')
      .eq('id', id)
      .single();

    if (existingError || !existingItem) {
      log.warn('Action item not found', { actionItemId: id, error: existingError?.message });
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
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
      .eq('project_id', existingItem.project_id)
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
    const { content, title, description, status, owner_user_id, due_date } = body;

    // Handle status update (content provided)
    if (content) {
      log.debug('Adding status update for action item', { actionItemId: id });

      const updateId = crypto.randomUUID();
      const createdByName = userProfile?.full_name || 'Unknown';

      // Use atomic database function to prevent race conditions
      const { data: updatedUpdates, error: updateError } = await serviceSupabase.rpc(
        'append_action_item_update',
        {
          p_action_item_id: id,
          p_update_id: updateId,
          p_content: content.trim(),
          p_created_by_user_id: user.id,
          p_created_by_name: createdByName,
        }
      );

      if (updateError) {
        log.error('Failed to add status update', {
          actionItemId: id,
          error: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
          fullError: JSON.stringify(updateError)
        });

        // Check if it's a "not found" error
        if (updateError.message.includes('not found')) {
          return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to add status update: ${updateError.message}` }, { status: 500 });
      }

      // Extract the newly added update from the result
      const updates = updatedUpdates as ActionItemUpdate[];
      const update = updates[updates.length - 1];

      return NextResponse.json({ success: true, update });
    }

    // Handle general action item update
    else if (title !== undefined || description !== undefined || status !== undefined || owner_user_id !== undefined || due_date !== undefined) {
      // Validate status if provided
      const validStatuses = Object.values(EntityStatus);
      if (status !== undefined && !validStatuses.includes(status as typeof validStatuses[number])) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
      }

      // Prepare update data
      const updateData: UpdateActionItemData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description || null;
      if (status !== undefined) updateData.status = status;
      if (due_date !== undefined) updateData.due_date = due_date || null;

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
        .from('action_items')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        log.error('Failed to update action item', { actionItemId: id, error: updateError.message });
        return NextResponse.json({ error: 'Failed to update action item' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  } catch (error) {
    log.error('Unexpected error in action item update', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

