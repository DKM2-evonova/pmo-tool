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

  // Get action item data with RLS
  const { data: actionItem, error } = await supabase
    .from('action_items')
    .select(`
      *,
      owner:profiles!action_items_owner_user_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq('id', id)
    .single();

  if (error || !actionItem) {
    notFound();
  }

  // Simplified related data fetching
  let projectMembers: Array<{ id: string; full_name: string; email: string }> = [];

  // Get project members
  const { data: members } = await serviceSupabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', actionItem.project_id);

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
    updatesArray = actionItem.updates ? JSON.parse(actionItem.updates as string) : [];
    if (!Array.isArray(updatesArray)) updatesArray = [];
  } catch (e) {
    console.warn('Failed to parse updates JSON:', e);
    updatesArray = [];
  }

  const actionItemWithUpdates = {
    ...actionItem,
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