import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Get optional action item ID from query params
    const url = new URL(request.url);
    const actionItemId = url.searchParams.get('id');

    // Regular client (respects RLS)
    const supabase = await createClient();
    // Service client (bypasses RLS)
    const serviceSupabase = createServiceClient();

    // Check authentication using regular client
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('Debug API auth check:', {
      user: user?.id || null,
      email: user?.email || null,
      error: authError?.message || null
    });

    // Get all action items using SERVICE client (bypasses RLS)
    const { data: allActionItems, error: allError } = await serviceSupabase
      .from('action_items')
      .select('id, title, project_id, owner_user_id, status')
      .limit(20);

    // Get all projects using SERVICE client
    const { data: allProjects } = await serviceSupabase
      .from('projects')
      .select('id, name');

    // Get all project memberships using SERVICE client
    const { data: allMemberships } = await serviceSupabase
      .from('project_members')
      .select('project_id, user_id');

    let userProjectIds: string[] = [];
    let rlsActionItems = null;
    let rlsError = null;
    let userProfile = null;
    let specificItem = null;
    let specificItemRls = null;

    if (user) {
      // Get user's profile
      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      userProfile = profile;

      // Get user's project memberships
      const userMemberships = allMemberships?.filter(m => m.user_id === user.id) || [];
      userProjectIds = userMemberships.map(m => m.project_id);

      // Get action items using REGULAR client (respects RLS)
      const rlsResult = await supabase
        .from('action_items')
        .select('id, title, project_id, owner_user_id, status')
        .limit(20);

      rlsActionItems = rlsResult.data;
      rlsError = rlsResult.error;

      // If specific action item ID provided, check access
      if (actionItemId) {
        // Get with service client (bypasses RLS)
        const { data: itemService } = await serviceSupabase
          .from('action_items')
          .select('id, title, project_id, owner_user_id, status')
          .eq('id', actionItemId)
          .single();
        specificItem = itemService;

        // Get with regular client (respects RLS)
        const { data: itemRls, error: itemRlsError } = await supabase
          .from('action_items')
          .select('id, title, project_id, owner_user_id, status')
          .eq('id', actionItemId)
          .single();
        specificItemRls = { data: itemRls, error: itemRlsError?.message };
      }
    }

    return NextResponse.json({
      user: {
        id: user?.id,
        email: user?.email,
        authenticated: !!user,
        profile: userProfile
      },
      userProjectMemberships: userProjectIds,
      allProjects: allProjects,
      allMemberships: allMemberships,
      allActionItems: {
        note: 'Using SERVICE client - bypasses RLS',
        count: allActionItems?.length || 0,
        items: allActionItems,
        error: allError?.message
      },
      rlsActionItems: {
        note: 'Using REGULAR client - respects RLS',
        count: rlsActionItems?.length || 0,
        items: rlsActionItems,
        error: rlsError?.message
      },
      specificItem: actionItemId ? {
        id: actionItemId,
        serviceClient: specificItem,
        rlsClient: specificItemRls,
        analysis: specificItem ? {
          itemProjectId: specificItem.project_id,
          userIsMemberOfProject: userProjectIds.includes(specificItem.project_id),
          userIsOwner: specificItem.owner_user_id === user?.id,
          userIsAdmin: userProfile?.global_role === 'admin'
        } : null
      } : null
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch action items',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


