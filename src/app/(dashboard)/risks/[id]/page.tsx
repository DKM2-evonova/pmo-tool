import { createClient, createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { RiskDetail } from './risk-detail';

interface RiskPageProps {
  params: Promise<{ id: string }>;
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

  // Simplified related data fetching
  let projectMembers: Array<{ id: string; full_name: string; email: string }> = [];

  // Get project members
  const { data: members } = await serviceSupabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', risk.project_id);

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
    updatesArray = risk.updates ? JSON.parse(risk.updates as string) : [];
    if (!Array.isArray(updatesArray)) updatesArray = [];
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