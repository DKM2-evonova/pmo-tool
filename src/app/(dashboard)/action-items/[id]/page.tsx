import { createClient, createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ActionItemDetail } from './action-item-detail';
import { loggers } from '@/lib/logger';

interface ActionItemPageProps {
  params: Promise<{ id: string }>;
}

interface StatusUpdate {
  id: string;
  content: string;
  created_at: string;
  created_by_user_id: string;
  created_by_name: string;
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

  // Get project members with a single query using join
  const { data: members } = await serviceSupabase
    .from('project_members')
    .select(`
      user_id,
      profile:profiles!project_members_user_id_fkey(id, full_name, email)
    `)
    .eq('project_id', actionItem.project_id);

  const projectMembers: Array<{ id: string; full_name: string; email: string }> = 
    members
      ?.filter((m): m is typeof m & { profile: { id: string; full_name: string | null; email: string } } => 
        m.profile !== null
      )
      .map((m) => ({
        id: m.profile.id,
        full_name: m.profile.full_name || '',
        email: m.profile.email,
      })) || [];

  // Parse updates
  let updatesArray: StatusUpdate[] = [];
  try {
    const parsed = actionItem.updates ? JSON.parse(actionItem.updates as string) : [];
    updatesArray = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    loggers.api.warn('Failed to parse updates JSON', { error: e instanceof Error ? e.message : 'Unknown error' });
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