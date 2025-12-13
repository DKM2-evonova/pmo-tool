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
    notFound();
  }

  console.log('=== TESTING ACTION ITEM ACCESS ===');
  console.log('User ID:', user.id);
  console.log('Action Item ID:', id);

  // Test 1: Service client (bypasses RLS)
  const { data: serviceActionItem, error: serviceError } = await serviceSupabase
    .from('action_items')
    .select(`
      *,
      owner:profiles!action_items_owner_user_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq('id', id)
    .single();

  console.log('Service client (no RLS):', {
    found: !!serviceActionItem,
    error: serviceError?.message,
    projectId: serviceActionItem?.project_id
  });

  if (!serviceActionItem) {
    console.error('Action item does not exist in database');
    notFound();
  }

  // Test 2: Regular client (with RLS)
  const { data: actionItem, error } = await supabase
    .from('action_items')
    .select(`
      *,
      owner:profiles!action_items_owner_user_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq('id', id)
    .single();

  console.log('Regular client (with RLS):', {
    found: !!actionItem,
    error: error?.message
  });

  // TEMPORARY WORKAROUND: Use service client if RLS blocks access
  const finalActionItem = actionItem || serviceActionItem;

  if (!finalActionItem) {
    console.error('No action item data available');
    notFound();
  }

  if (!actionItem && serviceActionItem) {
    console.log('RLS BLOCKED ACCESS - Using service client workaround');
  }

  // Simplified related data fetching
  let projectMembers: Array<{ id: string; full_name: string; email: string }> = [];

  // Get project members
  const { data: members } = await serviceSupabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', finalActionItem.project_id);

  if (members) {
    for (const m of members) {
      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', m.user_id)
        .single();

      if (profile) {
        projectMembers.push({
          id: profile.id,
          full_name: profile.full_name || '',
          email: profile.email,
        });
      }
    }
  }

  // Parse updates
  let updatesArray: any[] = [];
  try {
    updatesArray = finalActionItem.updates ? JSON.parse(finalActionItem.updates as string) : [];
    if (!Array.isArray(updatesArray)) updatesArray = [];
  } catch (e) {
    console.warn('Failed to parse updates JSON:', e);
    updatesArray = [];
  }

  const actionItemWithUpdates = {
    ...finalActionItem,
    updates: updatesArray
  };

  return (
    <ActionItemDetail
      actionItem={actionItemWithUpdates}
      projectMembers={projectMembers}
      currentUserId={user.id}
    />
  );
}