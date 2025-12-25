import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/utils';
import { parseMilestoneExcel, validateParsedMilestones } from '@/lib/import/milestone-parser';
import { MilestoneStatus } from '@/types/enums';

// POST - Import milestones from uploaded Excel file
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
        { error: 'Forbidden - You must be a project member or admin to import milestones' },
        { status: 403 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Please upload an Excel file.' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx).' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Parse the Excel file
    const buffer = await file.arrayBuffer();
    const parseResult = await parseMilestoneExcel(buffer);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Failed to parse Excel file',
          details: parseResult.errors,
          warnings: parseResult.warnings,
          stats: parseResult.stats,
        },
        { status: 400 }
      );
    }

    if (parseResult.milestones.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid milestones found in the file',
          warnings: parseResult.warnings,
          stats: parseResult.stats,
        },
        { status: 400 }
      );
    }

    // Get existing milestone IDs for validation
    const { data: existingMilestones } = await supabase
      .from('milestones')
      .select('id')
      .eq('project_id', projectId);

    const existingIds = (existingMilestones || []).map((m) => m.id);

    // Validate cross-references
    const validation = validateParsedMilestones(parseResult.milestones, existingIds);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Validation errors in imported data',
          details: validation.errors,
          warnings: parseResult.warnings,
          stats: parseResult.stats,
        },
        { status: 400 }
      );
    }

    // Separate new vs existing milestones
    const existingToUpdate = parseResult.milestones.filter(
      (m) => m.id && existingIds.includes(m.id)
    );
    const newToCreate = parseResult.milestones.filter((m) => !m.id);
    const unknownIds = parseResult.milestones.filter(
      (m) => m.id && !existingIds.includes(m.id)
    );

    // Warn about unknown IDs (will be treated as new)
    if (unknownIds.length > 0) {
      parseResult.warnings.push(
        ...unknownIds.map((m) => ({
          row: m.row_number,
          column: 'ID',
          message: `ID "${m.id}" not found in existing milestones. Will be created as new.`,
        }))
      );
    }

    // Determine IDs to delete (existing IDs not in import)
    const importedExistingIds = new Set(existingToUpdate.map((m) => m.id));
    const idsToDelete = existingIds.filter((id) => !importedExistingIds.has(id));

    // Process deletions first (to avoid dependency conflicts)
    if (idsToDelete.length > 0) {
      // Clear predecessor references to milestones being deleted
      const { error: clearError } = await supabase
        .from('milestones')
        .update({ predecessor_id: null })
        .eq('project_id', projectId)
        .in('predecessor_id', idsToDelete);

      if (clearError) {
        console.error('Error clearing predecessor references:', clearError);
        return NextResponse.json(
          { error: 'Failed to update dependencies before deletion' },
          { status: 500 }
        );
      }

      // Delete milestones
      const { error: deleteError } = await supabase
        .from('milestones')
        .delete()
        .eq('project_id', projectId)
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('Error deleting milestones:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete removed milestones' },
          { status: 500 }
        );
      }
    }

    // Update existing milestones
    let updateErrors: string[] = [];
    for (let i = 0; i < existingToUpdate.length; i++) {
      const m = existingToUpdate[i];
      const { error: updateError } = await supabase
        .from('milestones')
        .update({
          name: m.name,
          description: m.description,
          target_date: m.target_date,
          status: m.status as typeof MilestoneStatus[keyof typeof MilestoneStatus],
          sort_order: i,
          predecessor_id: m.predecessor_id,
        })
        .eq('id', m.id!)
        .eq('project_id', projectId);

      if (updateError) {
        console.error('Error updating milestone:', updateError);
        if (updateError.message.includes('circular') || updateError.message.includes('depend')) {
          updateErrors.push(`Row ${m.row_number}: ${updateError.message}`);
        } else {
          updateErrors.push(`Row ${m.row_number}: Failed to update "${m.name}"`);
        }
      }
    }

    if (updateErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Some milestones failed to update',
          details: updateErrors.map((msg) => ({ row: 0, column: 'Update', message: msg })),
          warnings: parseResult.warnings,
          stats: parseResult.stats,
        },
        { status: 400 }
      );
    }

    // Create new milestones
    const sortOrderOffset = existingToUpdate.length;
    const newMilestonesWithOrder = [
      ...newToCreate,
      ...unknownIds.map((m) => ({ ...m, id: null })), // Treat unknown IDs as new
    ].map((m, i) => ({
      project_id: projectId,
      name: m.name,
      description: m.description,
      target_date: m.target_date,
      status: m.status as typeof MilestoneStatus[keyof typeof MilestoneStatus],
      sort_order: sortOrderOffset + i,
      predecessor_id: m.predecessor_id,
    }));

    if (newMilestonesWithOrder.length > 0) {
      const { error: insertError } = await supabase
        .from('milestones')
        .insert(newMilestonesWithOrder);

      if (insertError) {
        console.error('Error inserting new milestones:', insertError);
        if (insertError.message.includes('circular') || insertError.message.includes('depend')) {
          return NextResponse.json(
            {
              error: `Dependency error: ${insertError.message}`,
              warnings: parseResult.warnings,
              stats: parseResult.stats,
            },
            { status: 400 }
          );
        }
        return NextResponse.json(
          {
            error: 'Failed to create new milestones',
            warnings: parseResult.warnings,
            stats: parseResult.stats,
          },
          { status: 500 }
        );
      }
    }

    // Fetch final results
    const { data: finalMilestones, error: fetchError } = await supabase
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
      console.error('Error fetching final milestones:', fetchError);
    }

    return NextResponse.json({
      success: true,
      message: 'Import completed successfully',
      stats: {
        imported: parseResult.stats.validRows,
        created: newMilestonesWithOrder.length,
        updated: existingToUpdate.length,
        deleted: idsToDelete.length,
      },
      warnings: parseResult.warnings,
      milestones: finalMilestones || [],
    });
  } catch (error) {
    console.error('Error importing milestones:', error);
    return NextResponse.json(
      { error: 'Failed to process import' },
      { status: 500 }
    );
  }
}
