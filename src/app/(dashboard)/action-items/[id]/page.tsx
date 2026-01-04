import { createClient, createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ActionItemDetail } from './action-item-detail';
import { parseUpdatesArray } from '@/lib/utils';
import type { ActionItemUpdate } from '@/types/database';

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

  // Parse updates array (handles both TEXT and JSONB formats)
  const updatesArray = parseUpdatesArray<ActionItemUpdate>(actionItem.updates);

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