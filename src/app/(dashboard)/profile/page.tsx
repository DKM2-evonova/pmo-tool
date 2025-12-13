import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/profile/profile-form';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Profile</h1>
        <p className="mt-1 text-surface-500">Manage your account settings</p>
      </div>

      <ProfileForm profile={profile} />
    </div>
  );
}

