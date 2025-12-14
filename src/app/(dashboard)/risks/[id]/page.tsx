import { createClient, createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { RiskDetail } from './risk-detail';

interface RiskPageProps {
  params: Promise<{ id: string }>;
}

interface StatusUpdate {
  id: string;
  content: string;
  created_at: string;
  created_by_user_id: string;
  created_by_name: string;
}

export default async function RiskPage({ params }: RiskPageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const supabase = await createClient();
  const serviceSupabase = createServiceClient();

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Get risk data with RLS
  const { data: risk, error } = await supabase
    .from('risks')
    .select(`
      *,
      owner:profiles!risks_owner_user_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq('id', id)
    .single();

  if (error || !risk) {
    notFound();
  }

  // Get project members with a single query using join
  const { data: members } = await serviceSupabase
    .from('project_members')
    .select(`
      user_id,
      profile:profiles!project_members_user_id_fkey(id, full_name, email)
    `)
    .eq('project_id', risk.project_id);

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
    const parsed = risk.updates ? JSON.parse(risk.updates as string) : [];
    updatesArray = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to parse updates JSON:', e);
    updatesArray = [];
  }

  const riskWithUpdates = {
    ...risk,
    updates: updatesArray
  };

  return (
    <RiskDetail
      risk={riskWithUpdates}
      projectMembers={projectMembers}
      currentUserId={user.id}
    />
  );
}

