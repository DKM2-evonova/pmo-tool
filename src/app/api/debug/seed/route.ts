import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = createServiceClient();

    // Create a test user (this won't work with Supabase Auth, but let's try)
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';
    const testProjectId = '660e8400-e29b-41d4-a716-446655440001';
    const testActionItemId = '770e8400-e29b-41d4-a716-446655440002';

    // Insert test profile (this should work)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: testUserId,
        email: 'test@example.com',
        full_name: 'Test User',
        global_role: 'consultant' // Use correct enum value
      });

    // Insert test project
    const { error: projectError } = await supabase
      .from('projects')
      .upsert({
        id: testProjectId,
        name: 'Test Project',
        description: 'A test project for debugging'
      });

    // Add user to project
    const { error: memberError } = await supabase
      .from('project_members')
      .upsert({
        project_id: testProjectId,
        user_id: testUserId,
        project_role: 'member'
      });

    // Insert test action item
    const { error: actionItemError } = await supabase
      .from('action_items')
      .upsert({
        id: testActionItemId,
        project_id: testProjectId,
        title: 'Test Action Item',
        description: 'This is a test action item for debugging',
        status: 'Open',
        owner_user_id: testUserId,
        owner_name: 'Test User',
        owner_email: 'test@example.com'
      });

    // Check what we have
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('id, title, project_id, owner_user_id')
      .limit(5);

    return NextResponse.json({
      success: true,
      errors: {
        profile: profileError?.message,
        project: projectError?.message,
        member: memberError?.message,
        actionItem: actionItemError?.message
      },
      actionItems: actionItems
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
