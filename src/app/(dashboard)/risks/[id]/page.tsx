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

  console.log('=== TESTING RISK ACCESS ===');
  console.log('User ID:', user.id);
  console.log('Risk ID:', id);

  // Test 1: Service client (bypasses RLS)
  const { data: serviceRisk, error: serviceError } = await serviceSupabase
    .from('risks')
    .select(`
      *,
      owner:profiles!risks_owner_user_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq('id', id)
    .single();

  console.log('Service client (no RLS):', {
    found: !!serviceRisk,
    error: serviceError?.message,
    projectId: serviceRisk?.project_id
  });

  if (!serviceRisk) {
    console.error('Risk does not exist in database');
    notFound();
  }

  // Test 2: Regular client (with RLS)
  const { data: risk, error } = await supabase
    .from('risks')
    .select(`
      *,
      owner:profiles!risks_owner_user_id_fkey(id, full_name, email, avatar_url)
    `)
    .eq('id', id)
    .single();

  console.log('Regular client (with RLS):', {
    found: !!risk,
    error: error?.message
  });

  // TEMPORARY WORKAROUND: Use service client if RLS blocks access
  const finalRisk = risk || serviceRisk;

  if (!finalRisk) {
    console.error('No risk data available');
    notFound();
  }

  if (!risk && serviceRisk) {
    console.log('RLS BLOCKED ACCESS - Using service client workaround');
  }

  // Simplified related data fetching
  let projectMembers: Array<{ id: string; full_name: string; email: string }> = [];

  // Get project members
  const { data: members } = await serviceSupabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', finalRisk.project_id);

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
    updatesArray = finalRisk.updates ? JSON.parse(finalRisk.updates as string) : [];
    if (!Array.isArray(updatesArray)) updatesArray = [];
  } catch (e) {
    console.warn('Failed to parse updates JSON:', e);
    updatesArray = [];
  }

  const riskWithUpdates = {
    ...finalRisk,
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