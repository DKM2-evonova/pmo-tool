import { createClient } from '@/lib/supabase/server';
import {
  CheckSquare,
  AlertTriangle,
  FileText,
  Calendar,
  TrendingUp,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's projects
  const { data: memberships } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user?.id);

  const projectIds = memberships?.map((m) => m.project_id) || [];

  // Get stats
  const [actionItems, decisions, risks, meetings] = await Promise.all([
    supabase
      .from('action_items')
      .select('id, status')
      .in('project_id', projectIds.length > 0 ? projectIds : ['none']),
    supabase
      .from('decisions')
      .select('id')
      .in('project_id', projectIds.length > 0 ? projectIds : ['none']),
    supabase
      .from('risks')
      .select('id, status')
      .in('project_id', projectIds.length > 0 ? projectIds : ['none']),
    supabase
      .from('meetings')
      .select('id, title, date, category, status, project:projects(name)')
      .in('project_id', projectIds.length > 0 ? projectIds : ['none'])
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const openActionItems =
    actionItems.data?.filter((a) => a.status !== 'Closed').length || 0;
  const openRisks =
    risks.data?.filter((r) => r.status !== 'Closed').length || 0;

  const stats = [
    {
      name: 'Open Action Items',
      value: openActionItems,
      icon: CheckSquare,
      href: '/action-items',
      color: 'bg-primary-50 text-primary-600',
    },
    {
      name: 'Active Risks',
      value: openRisks,
      icon: AlertTriangle,
      href: '/risks',
      color: 'bg-warning-50 text-warning-600',
    },
    {
      name: 'Total Decisions',
      value: decisions.data?.length || 0,
      icon: FileText,
      href: '/decisions',
      color: 'bg-success-50 text-success-600',
    },
    {
      name: 'Meetings Processed',
      value: meetings.data?.filter((m) => m.status === 'Published').length || 0,
      icon: Calendar,
      href: '/meetings',
      color: 'bg-surface-100 text-surface-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
        <p className="mt-1 text-surface-500">
          Overview of your project management activities
        </p>
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
              <p className="text-2xl font-bold text-surface-900">{stat.value}</p>
              <p className="text-sm text-surface-500">{stat.name}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Meetings */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-surface-900">
              Recent Meetings
            </h2>
            <Link
              href="/meetings"
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-surface-900">
                      {meeting.title || 'Untitled Meeting'}
                    </p>
                    <p className="text-sm text-surface-500">
                      {(meeting.project as unknown as { name: string })?.name || 'Unknown Project'}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
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
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="mb-2 h-8 w-8 text-surface-300" />
              <p className="text-sm text-surface-500">No meetings yet</p>
              <Link
                href="/meetings/new"
                className="mt-3 text-sm text-primary-600 hover:text-primary-700"
              >
                Process your first meeting
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-surface-900">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link
              href="/meetings/new"
              className="flex items-center gap-4 rounded-lg border border-surface-200 p-4 transition-colors hover:bg-surface-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                <Calendar className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-surface-900">
                  Process New Meeting
                </p>
                <p className="text-sm text-surface-500">
                  Upload a transcript or connect to Google Meet
                </p>
              </div>
            </Link>
            <Link
              href="/action-items/new"
              className="flex items-center gap-4 rounded-lg border border-surface-200 p-4 transition-colors hover:bg-surface-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-50">
                <CheckSquare className="h-5 w-5 text-success-600" />
              </div>
              <div>
                <p className="font-medium text-surface-900">
                  Create Action Item
                </p>
                <p className="text-sm text-surface-500">
                  Manually add a new task
                </p>
              </div>
            </Link>
            <Link
              href="/action-items?view=kanban"
              className="flex items-center gap-4 rounded-lg border border-surface-200 p-4 transition-colors hover:bg-surface-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100">
                <TrendingUp className="h-5 w-5 text-surface-600" />
              </div>
              <div>
                <p className="font-medium text-surface-900">View Kanban Board</p>
                <p className="text-sm text-surface-500">
                  Manage action items visually
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

