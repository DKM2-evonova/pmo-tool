import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { MilestoneStatus } from '@/types/enums';
import type { Milestone } from '@/types/database';
import { isValidUUID } from '@/lib/utils';

// PUT - Update project milestones
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId } = resolvedParams;

    // Validate projectId is a valid UUID
    if (!isValidUUID(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user's role for admin override
    const { data: profile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.global_role === 'admin';

    // Check user is a member of the project
    const { data: membership } = await supabase
      .from('project_members')
      .select('project_role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    // Allow access if user is admin OR a project member
    if (!isAdmin && !membership) {
      return NextResponse.json(
        { error: 'Forbidden - You must be a project member or admin to update milestones' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { milestones } = body;

    if (!Array.isArray(milestones)) {
      return NextResponse.json(
        { error: 'Milestones must be an array' },
        { status: 400 }
      );
    }

    // Validate milestone structure
    const validStatuses = Object.values(MilestoneStatus);
    const validatedMilestones: Milestone[] = milestones.map((m: unknown) => {
      const milestone = m as Record<string, unknown>;
      const status = String(milestone.status || MilestoneStatus.NotStarted);

      if (!validStatuses.includes(status as typeof validStatuses[number])) {
        throw new Error(`Invalid milestone status: ${status}`);
      }

      return {
        id: String(milestone.id || ''),
        name: String(milestone.name || ''),
        target_date: milestone.target_date ? String(milestone.target_date) : null,
        status: status as Milestone['status'],
      };
    });

    // Filter out milestones with empty names
    const cleanedMilestones = validatedMilestones.filter(m => m.name.trim() !== '');

    // Update the project
    const { error: updateError } = await supabase
      .from('projects')
      .update({ milestones: cleanedMilestones })
      .eq('id', projectId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update milestones: ' + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, milestones: cleanedMilestones });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid milestone status')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
