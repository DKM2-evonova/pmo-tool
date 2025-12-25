'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Search, MoreVertical, Shield, User, Users, XCircle } from 'lucide-react';
import { cn, getInitials, formatDateReadable } from '@/lib/utils';
import { clientLog } from '@/lib/client-logger';
import type { Profile } from '@/types/database';
import type { GlobalRole } from '@/types/enums';

interface UserManagementProps {
  users: (Profile & {
    project_members: Array<{
      project_role: string;
      projects: {
        id: string;
        name: string;
      } | null;
    }> | null;
  })[];
}

export function UserManagement({ users }: UserManagementProps) {
  const router = useRouter();
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const roleIcons: Record<GlobalRole, typeof Shield> = {
    admin: Shield,
    consultant: User,
    program_manager: Users,
  };

  const roleLabels: Record<GlobalRole, string> = {
    admin: 'Administrator',
    consultant: 'Project Consultant',
    program_manager: 'Program Manager',
  };

  const roleColors: Record<GlobalRole, string> = {
    admin: 'bg-danger-50 text-danger-600',
    consultant: 'bg-primary-50 text-primary-600',
    program_manager: 'bg-success-50 text-success-600',
  };

  const handleRoleChange = async (userId: string, newRole: GlobalRole) => {
    setIsUpdating(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ global_role: newRole })
        .eq('id', userId);

      if (updateError) throw updateError;
      router.refresh();
      setSelectedUser(null);
    } catch (err) {
      clientLog.error('Error updating role', { error: err instanceof Error ? err.message : 'Unknown error' });
      setError('Failed to update user role. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="card">
      {/* Error Toast */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto rounded p-1 hover:bg-danger-100"
            aria-label="Dismiss error"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* User table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-200">
              <th className="py-3 text-left text-sm font-medium text-surface-500">
                User
              </th>
              <th className="py-3 text-left text-sm font-medium text-surface-500">
                Role
              </th>
              <th className="py-3 text-left text-sm font-medium text-surface-500">
                Projects
              </th>
              <th className="py-3 text-left text-sm font-medium text-surface-500">
                Joined
              </th>
              <th className="py-3 text-right text-sm font-medium text-surface-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {filteredUsers.map((user) => {
              const RoleIcon = roleIcons[user.global_role];
              return (
                <tr key={user.id} className="group">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name || 'User'}
                            className="h-10 w-10 rounded-full"
                          />
                        ) : (
                          getInitials(user.full_name || user.email)
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-surface-900">
                          {user.full_name || 'Unknown'}
                        </p>
                        <p className="text-sm text-surface-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                        roleColors[user.global_role]
                      )}
                    >
                      <RoleIcon className="h-3.5 w-3.5" />
                      {roleLabels[user.global_role]}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.project_members && user.project_members.length > 0 ? (
                        user.project_members
                          .filter((pm) => pm.projects)
                          .map((pm, index) => (
                            <span
                              key={pm.projects?.id || index}
                              className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700"
                            >
                              {pm.projects?.name}
                              {pm.project_role === 'owner' && (
                                <span className="text-xs opacity-75">(Owner)</span>
                              )}
                            </span>
                          ))
                      ) : (
                        <span className="text-sm text-surface-400">No projects</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 text-sm text-surface-500">
                    {formatDateReadable(user.created_at)}
                  </td>
                  <td className="py-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() =>
                          setSelectedUser(
                            selectedUser?.id === user.id ? null : user
                          )
                        }
                        className="rounded-lg p-2 text-surface-400 opacity-0 transition-opacity hover:bg-surface-100 hover:text-surface-600 group-hover:opacity-100"
                        aria-label="User actions menu"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {selectedUser?.id === user.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-48 animate-fade-in rounded-lg border border-surface-200 bg-white py-1 shadow-medium">
                          <p className="px-3 py-2 text-xs font-medium text-surface-400">
                            Change Role
                          </p>
                          {(
                            Object.keys(roleLabels) as GlobalRole[]
                          ).map((role) => (
                            <button
                              key={role}
                              onClick={() => handleRoleChange(user.id, role)}
                              disabled={
                                isUpdating || user.global_role === role
                              }
                              className={cn(
                                'flex w-full items-center gap-2 px-3 py-2 text-sm',
                                user.global_role === role
                                  ? 'bg-surface-50 text-surface-400'
                                  : 'text-surface-700 hover:bg-surface-50'
                              )}
                            >
                              {React.createElement(roleIcons[role], {
                                className: 'h-4 w-4',
                              })}
                              {roleLabels[role]}
                              {user.global_role === role && (
                                <span className="ml-auto text-xs text-surface-400">
                                  Current
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="py-12 text-center">
            <User className="mx-auto mb-2 h-8 w-8 text-surface-300" />
            <p className="text-surface-500">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}

