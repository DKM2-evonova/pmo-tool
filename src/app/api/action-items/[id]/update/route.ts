import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';

const log = loggers.api;

interface UpdateRequest {
  content?: string;
  title?: string;
  description?: string;
  status?: string;
  owner_user_id?: string;
  due_date?: string;
}

interface StatusUpdate {
  id: string;
  content: string;
  created_at: string;
  created_by_user_id: string;
  created_by_name: string;
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

    // Verify user has access to the project (either as member or admin)
    const { data: membership } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('project_id', existingItem.project_id)
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
    const { content, title, description, status, owner_user_id, due_date } = body;

    // Handle status update (content provided)
    if (content) {
      log.debug('Adding status update for action item', { actionItemId: id });

      // Get user profile for the update
      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      log.debug('User profile retrieved', { userId: user.id, hasProfile: !!profile });

      // Get current action item
      const { data: actionItem, error: fetchError } = await serviceSupabase
        .from('action_items')
        .select('updates')
        .eq('id', id)
        .single();

      log.debug('Action item fetch result', { actionItemId: id, hasData: !!actionItem, hasError: !!fetchError });

      if (fetchError || !actionItem) {
        log.warn('Action item not found for status update', { actionItemId: id, error: fetchError?.message });
        return NextResponse.json({ error: `Action item not found: ${fetchError?.message || 'Unknown error'}` }, { status: 404 });
      }

      // Create the update
      const update = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
        content: content.trim(),
        created_at: new Date().toISOString(),
        created_by_user_id: user.id,
        created_by_name: profile?.full_name || 'Unknown',
      };

      // Update the action item
      let currentUpdates: StatusUpdate[] = [];
      try {
        const parsedUpdates = actionItem.updates ? JSON.parse(actionItem.updates) : [];
        currentUpdates = Array.isArray(parsedUpdates) ? parsedUpdates : [];
      } catch (parseError) {
        log.warn('Failed to parse action item updates', { actionItemId: id, error: parseError instanceof Error ? parseError.message : 'Parse error' });
        currentUpdates = [];
      }
      const updatedUpdates = [...currentUpdates, update];

      const { error: updateError } = await serviceSupabase
        .from('action_items')
        .update({ updates: JSON.stringify(updatedUpdates) })
        .eq('id', id);

      if (updateError) {
        log.error('Failed to add status update', { actionItemId: id, error: updateError.message });
        return NextResponse.json({ error: 'Failed to add status update' }, { status: 500 });
      }

      return NextResponse.json({ success: true, update });
    }

    // Handle general action item update
    else if (title !== undefined || description !== undefined || status !== undefined || owner_user_id !== undefined || due_date !== undefined) {
      // Prepare update data
      const updateData: UpdateActionItemData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description || null;
      if (status !== undefined) updateData.status = status;
      if (due_date !== undefined) updateData.due_date = due_date || null;

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

