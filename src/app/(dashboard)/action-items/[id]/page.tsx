import { createClient, createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ActionItemDetail } from './action-item-detail';

interface ActionItemPageProps {
  params: Promise<{ id: string }>;
}

export default async function ActionItemPage({ params }: ActionItemPageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const supabase = await createClient();
  const serviceSupabase = createServiceClient();

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.log('No user found, redirecting to not found');
    notFound();
  }

  // Get user's project memberships and profile using service client
  const [membershipsResult, profileResult] = await Promise.all([
    serviceSupabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id),
    serviceSupabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single()
  ]);

  const projectIds = membershipsResult.data?.map(m => m.project_id) || [];
  const isAdmin = profileResult.data?.global_role === 'admin';

  console.log('=== ACTION ITEM ACCESS CHECK ===');
  console.log('User ID:', user.id);
  console.log('User Projects:', projectIds);
  console.log('Is Admin:', isAdmin);

  // Fetch action item using SERVICE CLIENT (bypasses RLS)
  // We manually verify access below
  const { data: actionItem, error } = await serviceSupabase
    .from('action_items')
    .select(`
      id, title, description, status, owner_user_id, owner_name, owner_email,
      due_date, created_at, updated_at, project_id, source_meeting_id,
      updates,
      owner:profiles!action_items_owner_user_id_fkey(id, full_name, email, avatar_url),
      project:projects(id, name),
      source_meeting:meetings(id, title)
    `)
    .eq('id', id)
    .single();

  console.log('Action item fetch result:', {
    found: !!actionItem,
    projectId: actionItem?.project_id,
    error: error?.message,
    errorCode: error?.code,
    errorDetails: error
  });

  // Check for database errors first
  if (error) {
    console.error('Database error fetching action item:', {
      id,
      error: error.message,
      code: error.code,
      details: error
    });
    // If it's a "not found" error (PGRST116), that's expected
    // Otherwise, log the error but still show not found
    if (error.code === 'PGRST116') {
      console.error('Action item not found in database:', id);
    } else {
      console.error('Unexpected database error:', error);
    }
    notFound();
  }

  // Check if action item exists
  if (!actionItem) {
    console.error('Action item not found:', id);
    notFound();
  }

  // Manual access control check
  const hasProjectAccess = projectIds.includes(actionItem.project_id);
  const hasAccess = hasProjectAccess || isAdmin;

  console.log('Access check:', {
    actionItemProjectId: actionItem.project_id,
    hasProjectAccess,
    isAdmin,
    hasAccess
  });
  console.log('=== END ACCESS CHECK ===');

  if (!hasAccess) {
    console.error('Access denied: User is not a member of project and not an admin');
    notFound();
  }

  // Get project members for the owner dropdown
  const { data: projectMembersData } = await serviceSupabase
    .from('project_members')
    .select('user_id, profile:profiles(id, full_name, email)')
    .eq('project_id', actionItem.project_id);

  const projectMembers: Array<{ id: string; full_name: string; email: string }> = [];
  if (projectMembersData) {
    for (const m of projectMembersData) {
      const p = m.profile as any;
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        projectMembers.push({
          id: m.user_id,
          full_name: p.full_name || '',
          email: p.email,
        });
      }
    }
  }

  // Parse updates JSON
  let updatesArray: any[] = [];
  try {
    updatesArray = actionItem.updates ? JSON.parse(actionItem.updates as string) : [];
    if (!Array.isArray(updatesArray)) updatesArray = [];
  } catch (e) {
    console.warn('Failed to parse updates JSON:', e);
    updatesArray = [];
  }

  // Prepare the action item with parsed updates
  const actionItemWithParsedUpdates = {
    ...actionItem,
    updates: updatesArray
  };

  return (
    <ActionItemDetail
      actionItem={actionItemWithParsedUpdates}
      projectMembers={projectMembers}
      currentUserId={user.id}
    />
  );
}
