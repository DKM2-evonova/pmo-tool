import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserManagement } from '@/components/admin/user-management';

export default async function AdminUsersPage() {
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

  // Get all users
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">User Management</h1>
        <p className="mt-1 text-surface-500">
          Manage user roles and permissions
        </p>
      </div>

      <UserManagement users={users || []} />
    </div>
  );
}

