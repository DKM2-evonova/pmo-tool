import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { MilestoneStatus } from '@/types/enums';
import type { MilestoneRecord, MilestoneWithPredecessor } from '@/types/database';
import { isValidUUID } from '@/lib/utils';

// Transform Supabase result to proper type (predecessor comes as array from join)
type RawMilestoneFromDB = Omit<MilestoneWithPredecessor, 'predecessor'> & {
  predecessor: Array<Pick<MilestoneRecord, 'id' | 'name' | 'target_date' | 'status'>> | null;
};

function transformMilestones(raw: RawMilestoneFromDB[]): MilestoneWithPredecessor[] {
  return raw.map((m) => ({
    ...m,
    predecessor: Array.isArray(m.predecessor) && m.predecessor.length > 0
      ? m.predecessor[0]
      : null,
  }));
}

// Validate that user can access project milestones
async function validateAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string
): Promise<{ allowed: boolean; isAdmin: boolean; error?: string }> {
  // Check user's role for admin override
  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', userId)
    .single();

  const isAdmin = profile?.global_role === 'admin';

  // Check user is a member of the project
  const { data: membership } = await supabase
    .from('project_members')
    .select('project_role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  if (!isAdmin && !membership) {
    return {
      allowed: false,
      isAdmin: false,
      error: 'Forbidden - You must be a project member or admin to access milestones',
    };
  }

  return { allowed: true, isAdmin };
}

// GET - Fetch milestones for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId } = resolvedParams;

    if (!isValidUUID(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await validateAccess(supabase, user.id, projectId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // Fetch milestones with predecessor info
    const { data: milestones, error } = await supabase
      .from('milestones')
      .select(
        `
        id,
        project_id,
        name,
        description,
        target_date,
        status,
        sort_order,
        predecessor_id,
        created_at,
        updated_at,
        predecessor:predecessor_id (
          id,
          name,
          target_date,
          status
        )
      `
      )
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching milestones:', error);
      return NextResponse.json(
        { error: 'Failed to fetch milestones' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      milestones: transformMilestones(milestones as RawMilestoneFromDB[]),
    });
  } catch (error) {
    console.error('Error in GET milestones:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a single milestone
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId } = resolvedParams;

    if (!isValidUUID(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await validateAccess(supabase, user.id, projectId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    let body: Partial<MilestoneRecord>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // Validate required fields
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json({ error: 'Milestone name is required' }, { status: 400 });
    }

    // Validate status if provided
    const validStatuses = Object.values(MilestoneStatus);
    const status = body.status || MilestoneStatus.NotStarted;
    if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
      return NextResponse.json({ error: `Invalid milestone status: ${status}` }, { status: 400 });
    }

    // Validate predecessor if provided
    if (body.predecessor_id && !isValidUUID(body.predecessor_id)) {
      return NextResponse.json({ error: 'Invalid predecessor ID' }, { status: 400 });
    }

    // Get the next sort_order for this project
    const { data: maxSortOrder } = await supabase
      .from('milestones')
      .select('sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextSortOrder = (maxSortOrder?.sort_order ?? -1) + 1;

    // Insert the milestone
    const { data: milestone, error } = await supabase
      .from('milestones')
      .insert({
        project_id: projectId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        target_date: body.target_date || null,
        status: status,
        sort_order: body.sort_order ?? nextSortOrder,
        predecessor_id: body.predecessor_id || null,
      })
      .select(
        `
        id,
        project_id,
        name,
        description,
        target_date,
        status,
        sort_order,
        predecessor_id,
        created_at,
        updated_at,
        predecessor:predecessor_id (
          id,
          name,
          target_date,
          status
        )
      `
      )
      .single();

    if (error) {
      console.error('Error creating milestone:', error);
      // Check for dependency validation error
      if (error.message.includes('circular') || error.message.includes('depend')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json(
        { error: 'Failed to create milestone: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ milestone }, { status: 201 });
  } catch (error) {
    console.error('Error in POST milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Batch update milestones (for spreadsheet save)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId } = resolvedParams;

    if (!isValidUUID(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await validateAccess(supabase, user.id, projectId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    let body: {
      milestones?: Partial<MilestoneRecord>[];
      deleted_ids?: string[];
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { milestones = [], deleted_ids = [] } = body;

    if (!Array.isArray(milestones)) {
      return NextResponse.json({ error: 'Milestones must be an array' }, { status: 400 });
    }

    // Validate milestone structure
    const validStatuses = Object.values(MilestoneStatus);
    const errors: string[] = [];

    const validatedMilestones = milestones
      .filter((m) => m.name && m.name.trim() !== '') // Filter empty names
      .map((m, index) => {
        const status = m.status || MilestoneStatus.NotStarted;
        if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
          errors.push(`Milestone ${index + 1}: Invalid status "${status}"`);
        }
        if (m.predecessor_id && !isValidUUID(m.predecessor_id)) {
          errors.push(`Milestone ${index + 1}: Invalid predecessor ID`);
        }
        return {
          id: m.id || undefined, // undefined means create new
          project_id: projectId,
          name: m.name!.trim(),
          description: m.description?.trim() || null,
          target_date: m.target_date || null,
          status: status,
          sort_order: m.sort_order ?? index,
          predecessor_id: m.predecessor_id || null,
        };
      });

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    // Delete milestones marked for deletion
    if (deleted_ids.length > 0) {
      const validDeleteIds = deleted_ids.filter(isValidUUID);
      if (validDeleteIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('milestones')
          .delete()
          .eq('project_id', projectId)
          .in('id', validDeleteIds);

        if (deleteError) {
          console.error('Error deleting milestones:', deleteError);
          return NextResponse.json(
            { error: 'Failed to delete milestones: ' + deleteError.message },
            { status: 500 }
          );
        }
      }
    }

    // Separate new milestones from existing ones
    const existingMilestones = validatedMilestones.filter((m) => m.id && isValidUUID(m.id));
    const newMilestones = validatedMilestones.filter((m) => !m.id);

    // Update existing milestones one by one (to handle dependency validation)
    for (const milestone of existingMilestones) {
      const { error: updateError } = await supabase
        .from('milestones')
        .update({
          name: milestone.name,
          description: milestone.description,
          target_date: milestone.target_date,
          status: milestone.status,
          sort_order: milestone.sort_order,
          predecessor_id: milestone.predecessor_id,
        })
        .eq('id', milestone.id!)
        .eq('project_id', projectId);

      if (updateError) {
        console.error('Error updating milestone:', updateError);
        if (updateError.message.includes('circular') || updateError.message.includes('depend')) {
          return NextResponse.json(
            { error: `${milestone.name}: ${updateError.message}` },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: `Failed to update "${milestone.name}": ${updateError.message}` },
          { status: 500 }
        );
      }
    }

    // Insert new milestones
    if (newMilestones.length > 0) {
      const { error: insertError } = await supabase.from('milestones').insert(newMilestones);

      if (insertError) {
        console.error('Error inserting milestones:', insertError);
        if (insertError.message.includes('circular') || insertError.message.includes('depend')) {
          return NextResponse.json({ error: insertError.message }, { status: 400 });
        }
        return NextResponse.json(
          { error: 'Failed to create milestones: ' + insertError.message },
          { status: 500 }
        );
      }
    }

    // Fetch updated milestones
    const { data: updatedMilestones, error: fetchError } = await supabase
      .from('milestones')
      .select(
        `
        id,
        project_id,
        name,
        description,
        target_date,
        status,
        sort_order,
        predecessor_id,
        created_at,
        updated_at,
        predecessor:predecessor_id (
          id,
          name,
          target_date,
          status
        )
      `
      )
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (fetchError) {
      console.error('Error fetching updated milestones:', fetchError);
      return NextResponse.json(
        { error: 'Milestones saved but failed to fetch updated list' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      milestones: transformMilestones(updatedMilestones as RawMilestoneFromDB[]),
    });
  } catch (error) {
    console.error('Error in PUT milestones:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a single milestone by ID (passed as query param)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId } = resolvedParams;

    if (!isValidUUID(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await validateAccess(supabase, user.id, projectId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // Get milestone ID from query params
    const { searchParams } = new URL(request.url);
    const milestoneId = searchParams.get('id');

    if (!milestoneId || !isValidUUID(milestoneId)) {
      return NextResponse.json(
        { error: 'Valid milestone ID is required as query parameter' },
        { status: 400 }
      );
    }

    // Check if any milestones depend on this one
    const { data: dependents } = await supabase
      .from('milestones')
      .select('id, name')
      .eq('predecessor_id', milestoneId);

    if (dependents && dependents.length > 0) {
      const names = dependents.map((d) => d.name).join(', ');
      return NextResponse.json(
        {
          error: `Cannot delete: The following milestones depend on this one: ${names}. Update their dependencies first.`,
        },
        { status: 400 }
      );
    }

    // Delete the milestone
    const { error } = await supabase
      .from('milestones')
      .delete()
      .eq('id', milestoneId)
      .eq('project_id', projectId);

    if (error) {
      console.error('Error deleting milestone:', error);
      return NextResponse.json(
        { error: 'Failed to delete milestone: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE milestone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
