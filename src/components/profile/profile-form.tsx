'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Input } from '@/components/ui';
import { User } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import type { Profile } from '@/types/database';

interface ProfileFormProps {
  profile: Profile | null;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: formData.full_name })
        .eq('id', profile?.id);

      if (error) throw error;

      router.refresh();
      alert('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    consultant: 'Project Consultant',
    program_manager: 'Program Manager',
  };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="card flex items-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name || 'User'}
              className="h-20 w-20 rounded-full"
            />
          ) : (
            getInitials(profile?.full_name || profile?.email || 'U')
          )}
        </div>
        <div>
          <p className="text-lg font-semibold text-surface-900">
            {profile?.full_name || 'Unknown User'}
          </p>
          <p className="text-surface-500">{profile?.email}</p>
          <p className="mt-1 text-sm text-primary-600">
            {roleLabels[profile?.global_role || 'consultant']}
          </p>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="card space-y-6">
        <Input
          label="Full Name"
          value={formData.full_name}
          onChange={(e) =>
            setFormData({ ...formData, full_name: e.target.value })
          }
          placeholder="Your full name"
        />

        <Input
          label="Email"
          value={profile?.email || ''}
          disabled
          helperText="Email cannot be changed"
        />

        <Input
          label="Role"
          value={roleLabels[profile?.global_role || 'consultant']}
          disabled
          helperText="Contact an administrator to change your role"
        />

        <div className="flex justify-end border-t border-surface-200 pt-6">
          <Button type="submit" isLoading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}

