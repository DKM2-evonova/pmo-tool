import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/utils';
import { generateMilestoneTemplate } from '@/lib/export/milestone-template';
import type { MilestoneRecord, MilestoneWithPredecessor } from '@/types/database';

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

// GET - Download milestone template Excel file
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

    // Check user access
    const { data: profile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.global_role === 'admin';

    const { data: membership } = await supabase
      .from('project_members')
      .select('project_role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!isAdmin && !membership) {
      return NextResponse.json(
        { error: 'Forbidden - You must be a project member or admin to access milestones' },
        { status: 403 }
      );
    }

    // Fetch project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch existing milestones
    const { data: milestones, error: milestonesError } = await supabase
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

    if (milestonesError) {
      console.error('Error fetching milestones:', milestonesError);
      return NextResponse.json(
        { error: 'Failed to fetch milestones' },
        { status: 500 }
      );
    }

    // Generate the Excel template
    const buffer = await generateMilestoneTemplate({
      projectId,
      projectName: project.name,
      milestones: transformMilestones((milestones || []) as RawMilestoneFromDB[]),
    });

    // Create safe filename
    const safeName = project.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `${safeName}_milestones_template.xlsx`;

    // Return as downloadable Excel file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating milestone template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
