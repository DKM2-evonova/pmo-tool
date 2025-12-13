import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    console.log('API Route - Update risk:', id);

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the update data
    const body: UpdateRequest = await request.json();
    const { content, title, description, probability, impact, mitigation, status, owner_user_id } = body;

    const serviceSupabase = createServiceClient();

    // Handle status update (content provided)
    if (content) {
      console.log('Adding status update for risk:', id);

      // Get user profile for the update
      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      console.log('User profile:', profile);

      // Get current risk
      const { data: risk, error: fetchError } = await serviceSupabase
        .from('risks')
        .select('updates')
        .eq('id', id)
        .single();

      console.log('Risk fetch result:', { risk, error: fetchError });

      if (fetchError || !risk) {
        console.error('Risk not found:', { id, fetchError, risk });
        return NextResponse.json({ error: `Risk not found: ${fetchError?.message || 'Unknown error'}` }, { status: 404 });
      }

      // Create the update
      const update = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        content: content.trim(),
        created_at: new Date().toISOString(),
        created_by_user_id: user.id,
        created_by_name: profile?.full_name || 'Unknown',
      };

      // Update the risk
      let currentUpdates: any[] = [];
      try {
        const parsedUpdates = risk.updates ? JSON.parse(risk.updates) : [];
        currentUpdates = Array.isArray(parsedUpdates) ? parsedUpdates : [];
      } catch (error) {
        console.error('Failed to parse risk updates:', error);
        currentUpdates = [];
      }
      const updatedUpdates = [...currentUpdates, update];

      const { error: updateError } = await serviceSupabase
        .from('risks')
        .update({ updates: JSON.stringify(updatedUpdates) })
        .eq('id', id);

      if (updateError) {
        console.error('Failed to add status update:', updateError);
        return NextResponse.json({ error: 'Failed to add status update' }, { status: 500 });
      }

      return NextResponse.json({ success: true, update });
    }

    // Handle general risk update
    else if (title !== undefined || description !== undefined || probability !== undefined || impact !== undefined || mitigation !== undefined || status !== undefined || owner_user_id !== undefined) {
      // Prepare update data
      const updateData: any = {};
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
        console.error('Failed to update risk:', updateError);
        return NextResponse.json({ error: 'Failed to update risk' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}