'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui';
import { Search, ChevronDown, ChevronUp, Users, User, Settings, Trash2 } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import type { Profile, ProjectContact } from '@/types/database';

interface ProjectWithTeam {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  members: Array<{
    id: string;
    project_role: string;
    created_at: string;
    profile: Profile;
  }>;
  contacts: ProjectContact[];
  member_count: number;
  contact_count: number;
}

interface TeamOverviewProps {
  projects: ProjectWithTeam[];
}

export function TeamOverview({ projects }: TeamOverviewProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  const toggleExpanded = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleDeleteProject = async (project: ProjectWithTeam) => {
    const confirmMessage = `Are you sure you want to delete "${project.name}"?\n\nThis will permanently delete:\n- ${project.member_count} team member${project.member_count !== 1 ? 's' : ''}\n- ${project.contact_count} contact${project.contact_count !== 1 ? 's' : ''}\n- All meetings, action items, decisions, and risks\n\nThis action cannot be undone.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setDeletingProjectId(project.id);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to delete project');
      }

      showToast(
        `Project "${responseData.deleted.project}" deleted successfully. Removed ${responseData.deleted.meetings} meetings, ${responseData.deleted.action_items} action items, ${responseData.deleted.decisions} decisions, ${responseData.deleted.risks} risks.`,
        'success'
      );

      router.refresh();
    } catch (error) {
      console.error('Error deleting project:', error);
      showToast('Failed to delete project: ' + (error as Error).message, 'error');
    } finally {
      setDeletingProjectId(null);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;

    // Search in project name
    if (project.name.toLowerCase().includes(query)) return true;

    // Search in member names/emails
    const memberMatch = project.members.some(
      (m) =>
        m.profile.full_name?.toLowerCase().includes(query) ||
        m.profile.email.toLowerCase().includes(query)
    );
    if (memberMatch) return true;

    // Search in contact names/emails
    const contactMatch = project.contacts.some(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query)
    );
    if (contactMatch) return true;

    return false;
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search projects, members, or contacts..."
          className="pl-10"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card bg-primary-50 border-primary-200">
          <p className="text-sm text-primary-600">Total Projects</p>
          <p className="text-2xl font-bold text-primary-700">{projects.length}</p>
        </div>
        <div className="card bg-success-50 border-success-200">
          <p className="text-sm text-success-600">Total Members</p>
          <p className="text-2xl font-bold text-success-700">
            {projects.reduce((sum, p) => sum + p.member_count, 0)}
          </p>
        </div>
        <div className="card bg-purple-50 border-purple-200">
          <p className="text-sm text-purple-600">Total Contacts</p>
          <p className="text-2xl font-bold text-purple-700">
            {projects.reduce((sum, p) => sum + p.contact_count, 0)}
          </p>
        </div>
      </div>

      {/* Projects list */}
      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-200 text-left text-sm text-surface-500">
              <th className="pb-3 pr-4 font-medium">Project</th>
              <th className="pb-3 px-4 font-medium">Members</th>
              <th className="pb-3 px-4 font-medium">Contacts</th>
              <th className="pb-3 pl-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {filteredProjects.map((project) => {
              const isExpanded = expandedProjects.has(project.id);
              return (
                <tr key={project.id}>
                  <td colSpan={4} className="p-0">
                    <div>
                      {/* Project row */}
                      <div className="flex items-center py-4">
                        <button
                          onClick={() => toggleExpanded(project.id)}
                          className="flex flex-1 items-center gap-3 text-left"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary-100 text-primary-700">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-surface-900">{project.name}</p>
                            {project.description && (
                              <p className="text-sm text-surface-500 truncate max-w-md">
                                {project.description}
                              </p>
                            )}
                          </div>
                        </button>
                        <div className="px-4">
                          <span className="inline-flex items-center gap-1 text-sm text-surface-600">
                            <User className="h-4 w-4" />
                            {project.member_count}
                          </span>
                        </div>
                        <div className="px-4">
                          <span className="inline-flex items-center gap-1 text-sm text-purple-600">
                            <Users className="h-4 w-4" />
                            {project.contact_count}
                          </span>
                        </div>
                        <div className="pl-4 flex items-center gap-2">
                          <Link
                            href={`/projects/${project.id}/settings`}
                            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                          >
                            <Settings className="h-4 w-4" />
                            Manage
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project);
                            }}
                            disabled={deletingProjectId === project.id}
                            className="inline-flex items-center gap-1 text-sm text-danger-600 hover:text-danger-700 disabled:opacity-50"
                            title="Delete project"
                            aria-label={`Delete project ${project.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                            {deletingProjectId === project.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-surface-100 bg-surface-50 px-4 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Members */}
                            <div>
                              <h4 className="mb-3 text-sm font-medium text-surface-700">
                                Team Members ({project.members.length})
                              </h4>
                              {project.members.length === 0 ? (
                                <p className="text-sm text-surface-400">No members</p>
                              ) : (
                                <div className="space-y-2">
                                  {project.members.map((member) => (
                                    <div
                                      key={member.id}
                                      className="flex items-center gap-2 rounded-lg bg-white p-2"
                                    >
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                                        {member.profile.avatar_url ? (
                                          <img
                                            src={member.profile.avatar_url}
                                            alt=""
                                            className="h-8 w-8 rounded-full"
                                          />
                                        ) : (
                                          getInitials(
                                            member.profile.full_name || member.profile.email
                                          )
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-surface-900 truncate">
                                          {member.profile.full_name || 'Unknown'}
                                        </p>
                                        <p className="text-xs text-surface-500 truncate">
                                          {member.profile.email}
                                        </p>
                                      </div>
                                      <span
                                        className={cn(
                                          'rounded-full px-2 py-0.5 text-xs font-medium',
                                          member.project_role === 'owner'
                                            ? 'bg-warning-100 text-warning-700'
                                            : 'bg-surface-100 text-surface-600'
                                        )}
                                      >
                                        {member.project_role}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Contacts */}
                            <div>
                              <h4 className="mb-3 text-sm font-medium text-surface-700">
                                Project Contacts ({project.contacts.length})
                              </h4>
                              {project.contacts.length === 0 ? (
                                <p className="text-sm text-surface-400">No contacts</p>
                              ) : (
                                <div className="space-y-2">
                                  {project.contacts.map((contact) => (
                                    <div
                                      key={contact.id}
                                      className="flex items-center gap-2 rounded-lg bg-white p-2"
                                    >
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-700">
                                        {contact.avatar_url ? (
                                          <img
                                            src={contact.avatar_url}
                                            alt=""
                                            className="h-8 w-8 rounded-full"
                                          />
                                        ) : (
                                          getInitials(contact.name)
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-surface-900 truncate">
                                          {contact.name}
                                        </p>
                                        <p className="text-xs text-surface-500 truncate">
                                          {contact.email || 'No email'}
                                        </p>
                                      </div>
                                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                                        Contact
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredProjects.length === 0 && (
          <div className="py-8 text-center text-surface-500">
            {searchQuery ? 'No projects match your search' : 'No projects found'}
          </div>
        )}
      </div>
    </div>
  );
}
