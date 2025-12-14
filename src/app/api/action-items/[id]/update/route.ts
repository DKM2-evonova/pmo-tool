import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    console.log('API Route - Update action item:', id);

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createServiceClient();

    // Get the action item to check project access
    const { data: existingItem } = await serviceSupabase
      .from('action_items')
      .select('project_id')
      .eq('id', id)
      .single();

    if (!existingItem) {
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
      console.log('Adding status update for action item:', id);

      // Get user profile for the update
      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      console.log('User profile:', profile);

      // Get current action item
      const { data: actionItem, error: fetchError } = await serviceSupabase
        .from('action_items')
        .select('updates')
        .eq('id', id)
        .single();

      console.log('Action item fetch result:', { actionItem, error: fetchError });

      if (fetchError || !actionItem) {
        console.error('Action item not found:', { id, fetchError, actionItem });
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
        console.error('Failed to parse action item updates:', parseError);
        currentUpdates = [];
      }
      const updatedUpdates = [...currentUpdates, update];

      const { error: updateError } = await serviceSupabase
        .from('action_items')
        .update({ updates: JSON.stringify(updatedUpdates) })
        .eq('id', id);

      if (updateError) {
        console.error('Failed to add status update:', updateError);
        return NextResponse.json({ error: 'Failed to add status update' }, { status: 500 });
      }

      return NextResponse.json({ success: true, update });
    }

    // Handle general action item update
    else if (title !== undefined || description !== undefined || status !== undefined || owner_user_id !== undefined || due_date !== undefined) {
      // Prepare update data
      const updateData: any = {};
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
        console.error('Failed to update action item:', updateError);
        return NextResponse.json({ error: 'Failed to update action item' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

