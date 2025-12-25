import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Settings,
  CheckSquare,
  AlertTriangle,
  FileText,
  Calendar,
  Users,
  Plus,
} from 'lucide-react';
import { formatDateReadable } from '@/lib/utils';
import { MilestoneList } from '@/components/projects/milestone-list';
import type { MilestoneRecord, MilestoneWithPredecessor } from '@/types/database';

// Transform Supabase result to proper type (predecessor comes as array from join)
type RawMilestoneFromDB = Omit<MilestoneWithPredecessor, 'predecessor'> & {
  predecessor: Array<Pick<MilestoneRecord, 'id' | 'name' | 'target_date' | 'status'>> | null;
};

function transformMilestones(raw: RawMilestoneFromDB[]): MilestoneWithPredecessor[] {
  return raw.map((m) => ({
    ...m,
    predecessor: Array.isArray(m.predecessor) && m.predecessor.length > 0
      ? m.predecessor[0]
      : null,
  }));
}

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const supabase = await createClient();
  const { projectId } = await params;

  // Get project details
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    notFound();
  }

  // Get project stats and milestones
  const [actionItems, decisions, risks, meetings, members, milestones] = await Promise.all([
    supabase
      .from('action_items')
      .select('id, status')
      .eq('project_id', projectId),
    supabase.from('decisions').select('id').eq('project_id', projectId),
    supabase
      .from('risks')
      .select('id, status')
      .eq('project_id', projectId),
    supabase
      .from('meetings')
      .select('id, title, date, status, category')
      .eq('project_id', projectId)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('project_members')
      .select('user_id, project_role, profile:profiles(full_name, email, avatar_url)')
      .eq('project_id', projectId),
    supabase
      .from('milestones')
      .select(`
        id,
        project_id,
        name,
        description,
        target_date,
        status,
        sort_order,
        predecessor_id,
        created_at,
        updated_at,
        predecessor:predecessor_id (
          id,
          name,
          target_date,
          status
        )
      `)
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
  ]);

  const openActionItems =
    actionItems.data?.filter((a) => a.status !== 'Closed').length || 0;
  const openRisks =
    risks.data?.filter((r) => r.status !== 'Closed').length || 0;

  const stats = [
    {
      name: 'Action Items',
      value: openActionItems,
      total: actionItems.data?.length || 0,
      icon: CheckSquare,
      href: `/projects/${projectId}/action-items`,
      color: 'bg-primary-50 text-primary-600',
    },
    {
      name: 'Risks & Issues',
      value: openRisks,
      total: risks.data?.length || 0,
      icon: AlertTriangle,
      href: `/projects/${projectId}/risks`,
      color: 'bg-warning-50 text-warning-600',
    },
    {
      name: 'Decisions',
      value: decisions.data?.length || 0,
      icon: FileText,
      href: `/projects/${projectId}/decisions`,
      color: 'bg-success-50 text-success-600',
    },
    {
      name: 'Meetings',
      value: meetings.data?.length || 0,
      icon: Calendar,
      href: `/projects/${projectId}/meetings`,
      color: 'bg-surface-100 text-surface-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-surface-500">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/projects/${projectId}/meetings/new`}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Process Meeting
          </Link>
          <Link
            href={`/projects/${projectId}/settings`}
            className="btn-secondary"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="card-hover flex items-center gap-4"
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}
            >
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900">
                {stat.value}
                {'total' in stat && (
                  <span className="text-sm font-normal text-surface-400">
                    /{stat.total}
                  </span>
                )}
              </p>
              <p className="text-sm text-surface-500">{stat.name}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Meetings */}
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-surface-900">
              Recent Meetings
            </h2>
            <Link
              href={`/projects/${projectId}/meetings`}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View all
            </Link>
          </div>
          {meetings.data && meetings.data.length > 0 ? (
            <div className="space-y-3">
              {meetings.data.map((meeting) => (
                <Link
                  key={meeting.id}
                  href={`/meetings/${meeting.id}`}
                  className="flex items-center justify-between rounded-lg border border-surface-200 p-3 transition-colors hover:bg-surface-50"
                >
                  <div>
                    <p className="font-medium text-surface-900">
                      {meeting.title || 'Untitled Meeting'}
                    </p>
                    <p className="text-sm text-surface-500">
                      {meeting.date
                        ? formatDateReadable(meeting.date)
                        : 'No date'}
                      {meeting.category && ` · ${meeting.category}`}
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      meeting.status === 'Published'
                        ? 'badge-success'
                        : meeting.status === 'Review'
                          ? 'badge-warning'
                          : meeting.status === 'Failed'
                            ? 'badge-danger'
                            : 'badge-neutral'
                    }`}
                  >
                    {meeting.status}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Calendar className="mx-auto mb-2 h-8 w-8 text-surface-300" />
              <p className="text-surface-500">No meetings yet</p>
            </div>
          )}
        </div>

        {/* Team Members */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-surface-900">Team</h2>
            <Link
              href={`/projects/${projectId}/settings`}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Manage
            </Link>
          </div>
          {members.data && members.data.length > 0 ? (
            <div className="space-y-3">
              {members.data.map((member) => {
                const profile = member.profile as unknown as {
                  full_name: string | null;
                  email: string;
                  avatar_url: string | null;
                } | null;
                return (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        profile?.full_name?.charAt(0) || 'U'
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900">
                        {profile?.full_name || 'Unknown'}
                      </p>
                      <p className="truncate text-xs text-surface-500">
                        {member.project_role === 'owner' ? 'Owner' : 'Member'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-surface-300" />
              <p className="text-surface-500">No team members</p>
            </div>
          )}
        </div>
      </div>

      {/* Milestones */}
      <MilestoneList
        projectId={projectId}
        milestones={transformMilestones((milestones.data || []) as RawMilestoneFromDB[])}
      />
    </div>
  );
}

