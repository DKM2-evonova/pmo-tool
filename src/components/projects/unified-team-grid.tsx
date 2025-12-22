'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Select, Modal, ModalFooter, Input } from '@/components/ui';
import { Plus, Trash2, Crown, User, UserPlus, Pencil, Users } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import type { Profile, ProjectContact } from '@/types/database';
import type { ProjectRole } from '@/types/enums';

interface UnifiedTeamGridProps {
  projectId: string;
  members: Array<{
    user_id: string;
    project_role: string;
    profile: unknown;
  }>;
  contacts: ProjectContact[];
  allUsers: Array<{
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  }>;
  canManage: boolean;
}

type MemberProfile = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
};

export function UnifiedTeamGrid({
  projectId,
  members,
  contacts,
  allUsers,
  canManage,
}: UnifiedTeamGridProps) {
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  // Member modal state
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('member');

  // Contact modal state
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ProjectContact | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberUserIds = members.map((m) => m.user_id);
  const availableUsers = allUsers.filter((u) => !memberUserIds.includes(u.id));

  const getProfile = (member: typeof members[0]): MemberProfile | null => {
    const p = member.profile as MemberProfile | MemberProfile[] | null;
    if (!p) return null;
    if (Array.isArray(p)) return p[0] || null;
    return p;
  };

  // Member handlers
  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.from('project_members').insert({
        project_id: projectId,
        user_id: selectedUserId,
        project_role: selectedRole,
      });

      if (error) throw error;
      setIsAddMemberModalOpen(false);
      setSelectedUserId('');
      setSelectedRole('member');
      router.refresh();
    } catch (error) {
      console.error('Error adding member:', error);
      setError('Failed to add member');
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
      showToast('Failed to remove member', 'error');
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
      showToast('Failed to update role', 'error');
    }
  };

  // Contact handlers
  const handleAddContact = async () => {
    if (!contactName.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add contact');
      }

      setIsAddContactModalOpen(false);
      setContactName('');
      setContactEmail('');
      router.refresh();
    } catch (error) {
      console.error('Error adding contact:', error);
      setError(error instanceof Error ? error.message : 'Failed to add contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditContact = (contact: ProjectContact) => {
    setEditingContact(contact);
    setContactName(contact.name);
    setContactEmail(contact.email || '');
    setIsEditContactModalOpen(true);
  };

  const handleUpdateContact = async () => {
    if (!editingContact || !contactName.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/contacts/${editingContact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update contact');
      }

      setIsEditContactModalOpen(false);
      setEditingContact(null);
      setContactName('');
      setContactEmail('');
      router.refresh();
    } catch (error) {
      console.error('Error updating contact:', error);
      setError(error instanceof Error ? error.message : 'Failed to update contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to remove this contact?')) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/contacts/${contactId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove contact');
      }

      router.refresh();
    } catch (error) {
      console.error('Error removing contact:', error);
      showToast('Failed to remove contact', 'error');
    }
  };

  const totalCount = members.length + contacts.length;

  return (
    <>
      <div className="card">
        {/* Action buttons */}
        {canManage && (
          <div className="mb-4 flex gap-2 flex-wrap">
            {availableUsers.length > 0 && (
              <Button onClick={() => setIsAddMemberModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Member
              </Button>
            )}
            <Button variant="secondary" onClick={() => setIsAddContactModalOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Add Contact
            </Button>
          </div>
        )}

        {/* Team list */}
        <div className="divide-y divide-surface-100">
          {/* Project Members */}
          {members.map((member) => {
            const profile = getProfile(member);
            return (
              <div
                key={`member-${member.user_id}`}
                className="flex items-center justify-between py-4 first:pt-0"
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
                      getInitials(profile?.full_name || profile?.email || 'U')
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-surface-900">
                        {profile?.full_name || 'Unknown'}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                        <User className="h-3 w-3" />
                        User
                      </span>
                    </div>
                    <p className="text-sm text-surface-500">{profile?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {canManage ? (
                    <>
                      <Select
                        value={member.project_role}
                        onChange={(e) =>
                          handleRoleChange(member.user_id, e.target.value as ProjectRole)
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

          {/* Project Contacts */}
          {contacts.map((contact) => (
            <div
              key={`contact-${contact.id}`}
              className="flex items-center justify-between py-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-sm font-medium text-purple-700">
                  {contact.avatar_url ? (
                    <img
                      src={contact.avatar_url}
                      alt=""
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    getInitials(contact.name)
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-surface-900">{contact.name}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                      <Users className="h-3 w-3" />
                      Contact
                    </span>
                  </div>
                  <p className="text-sm text-surface-500">
                    {contact.email || 'No email'}
                  </p>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditContact(contact)}
                    className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveContact(contact.id)}
                    className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-danger-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {totalCount === 0 && (
            <div className="py-8 text-center text-surface-500">
              No team members or contacts yet
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddMemberModalOpen}
        onClose={() => {
          setIsAddMemberModalOpen(false);
          setError(null);
        }}
        title="Add Team Member"
        description="Select a user with an account to add to this project"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
              {error}
            </div>
          )}
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
          <Button variant="secondary" onClick={() => setIsAddMemberModalOpen(false)}>
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

      {/* Add Contact Modal */}
      <Modal
        isOpen={isAddContactModalOpen}
        onClose={() => {
          setIsAddContactModalOpen(false);
          setContactName('');
          setContactEmail('');
          setError(null);
        }}
        title="Add Project Contact"
        description="Add a person without a login account who should be recognized in meeting uploads"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
              {error}
            </div>
          )}
          <Input
            label="Name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Enter name"
            required
          />

          <Input
            label="Email (optional)"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Enter email address"
          />
        </div>

        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setIsAddContactModalOpen(false);
              setContactName('');
              setContactEmail('');
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddContact}
            isLoading={isSubmitting}
            disabled={!contactName.trim()}
          >
            Add Contact
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        isOpen={isEditContactModalOpen}
        onClose={() => {
          setIsEditContactModalOpen(false);
          setEditingContact(null);
          setContactName('');
          setContactEmail('');
          setError(null);
        }}
        title="Edit Contact"
        description="Update contact information"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
              {error}
            </div>
          )}
          <Input
            label="Name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Enter name"
            required
          />

          <Input
            label="Email (optional)"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Enter email address"
          />
        </div>

        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setIsEditContactModalOpen(false);
              setEditingContact(null);
              setContactName('');
              setContactEmail('');
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateContact}
            isLoading={isSubmitting}
            disabled={!contactName.trim()}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
