import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MeetingManagement } from '@/components/admin/meeting-management';

export default async function AdminMeetingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', user?.id)
    .single();

  if (profile?.global_role !== 'admin') {
    redirect('/dashboard');
  }

  // Get all meetings with project info
  const { data: meetings } = await supabase
    .from('meetings')
    .select(`
      *,
      project:projects(id, name)
    `)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Meeting Management</h1>
        <p className="mt-1 text-surface-500">
          View and manage all meetings across projects
        </p>
      </div>

      <MeetingManagement meetings={meetings || []} />
    </div>
  );
}

























