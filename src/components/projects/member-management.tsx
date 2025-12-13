'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Select, Modal, ModalFooter } from '@/components/ui';
import { Plus, Trash2, Crown, User } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import type { Profile } from '@/types/database';
import type { ProjectRole } from '@/types/enums';

interface MemberManagementProps {
  projectId: string;
  members: Array<{
    user_id: string;
    project_role: string;
    profile: unknown;
  }>;
  allUsers: Array<{
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  }>;
  isAdmin: boolean;
}

type MemberProfile = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
};

export function MemberManagement({
  projectId,
  members,
  allUsers,
  isAdmin,
}: MemberManagementProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const memberUserIds = members.map((m) => m.user_id);
  const availableUsers = allUsers.filter((u) => !memberUserIds.includes(u.id));
  
  const getProfile = (member: typeof members[0]): MemberProfile | null => {
    const p = member.profile as MemberProfile | MemberProfile[] | null;
    if (!p) return null;
    if (Array.isArray(p)) return p[0] || null;
    return p;
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('project_members').insert({
        project_id: projectId,
        user_id: selectedUserId,
        project_role: selectedRole,
      });

      if (error) throw error;
      setIsAddModalOpen(false);
      setSelectedUserId('');
      setSelectedRole('member');
      router.refresh();
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;
      router.refresh();
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  };

  const handleRoleChange = async (userId: string, newRole: ProjectRole) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ project_role: newRole })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;
      router.refresh();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    }
  };

  return (
    <>
      <div className="card">
        {isAdmin && availableUsers.length > 0 && (
          <div className="mb-4">
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Member
            </Button>
          </div>
        )}

        <div className="divide-y divide-surface-100">
          {members.map((member) => {
            const profile = getProfile(member);
            return (
            <div
              key={member.user_id}
              className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    getInitials(
                      profile?.full_name || profile?.email || 'U'
                    )
                  )}
                </div>
                <div>
                  <p className="font-medium text-surface-900">
                    {profile?.full_name || 'Unknown'}
                  </p>
                  <p className="text-sm text-surface-500">
                    {profile?.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isAdmin ? (
                  <>
                    <Select
                      value={member.project_role}
                      onChange={(e) =>
                        handleRoleChange(
                          member.user_id,
                          e.target.value as ProjectRole
                        )
                      }
                      options={[
                        { value: 'owner', label: 'Owner' },
                        { value: 'member', label: 'Member' },
                      ]}
                      className="w-32"
                    />
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-danger-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <span
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                      member.project_role === 'owner'
                        ? 'bg-warning-50 text-warning-600'
                        : 'bg-surface-100 text-surface-600'
                    )}
                  >
                    {member.project_role === 'owner' ? (
                      <Crown className="h-3.5 w-3.5" />
                    ) : (
                      <User className="h-3.5 w-3.5" />
                    )}
                    {member.project_role === 'owner' ? 'Owner' : 'Member'}
                  </span>
                )}
              </div>
            </div>
          );
          })}

          {members.length === 0 && (
            <div className="py-8 text-center text-surface-500">
              No members yet
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Team Member"
        description="Select a user to add to this project"
      >
        <div className="space-y-4">
          <Select
            label="User"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            options={availableUsers.map((u) => ({
              value: u.id,
              label: u.full_name || u.email,
            }))}
            placeholder="Select a user"
          />

          <Select
            label="Role"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as ProjectRole)}
            options={[
              { value: 'member', label: 'Member' },
              { value: 'owner', label: 'Owner' },
            ]}
          />
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddMember}
            isLoading={isSubmitting}
            disabled={!selectedUserId}
          >
            Add Member
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}

