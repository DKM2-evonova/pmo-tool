import { createClient } from '@/lib/supabase/server';
import {
  CheckSquare,
  AlertTriangle,
  FileText,
  Calendar,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

// Helper function to get date N business days from now
function getBusinessDaysFromNow(days: number): Date {
  const date = new Date();
  let count = 0;
  while (count < days) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  return date;
}

// Format date for display
function formatDueDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly.getTime() === today.getTime()) {
    return 'Today';
  }
  if (dateOnly.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Check if date is past due
function isPastDue(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

// Helper to safely extract name from project relation
function getProjectName(project: unknown): string {
  if (project && typeof project === 'object' && 'name' in project) {
    return (project as { name: string }).name;
  }
  return 'No Project';
}

// Helper to safely extract owner name from owner relation
function getOwnerName(owner: unknown): string | null {
  if (owner && typeof owner === 'object' && 'full_name' in owner) {
    return (owner as { full_name: string | null }).full_name;
  }
  return null;
}

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

  // Calculate date ranges
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayStr = endOfToday.toISOString();

  const fiveBusinessDaysOut = getBusinessDaysFromNow(5);
  const fiveBusinessDaysStr = fiveBusinessDaysOut.toISOString().split('T')[0];

  // Get stats and action items
  const [actionItems, decisions, risks, meetings, overdueItems, upcomingItems] = await Promise.all([
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
    // Due today or past due (open items only)
    supabase
      .from('action_items')
      .select('id, description, due_date, status, project:projects(name), owner:profiles!action_items_owner_user_id_fkey(full_name)')
      .in('project_id', projectIds.length > 0 ? projectIds : ['none'])
      .neq('status', 'Closed')
      .not('due_date', 'is', null)
      .lte('due_date', endOfTodayStr)
      .order('due_date', { ascending: true }),
    // Due in next 5 business days (open items only, after today)
    supabase
      .from('action_items')
      .select('id, description, due_date, status, project:projects(name), owner:profiles!action_items_owner_user_id_fkey(full_name)')
      .in('project_id', projectIds.length > 0 ? projectIds : ['none'])
      .neq('status', 'Closed')
      .not('due_date', 'is', null)
      .gt('due_date', endOfTodayStr)
      .lte('due_date', fiveBusinessDaysStr)
      .order('due_date', { ascending: true }),
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

      {/* Main Content - Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Due Items */}
        <div className="space-y-6">
          {/* Due Today / Past Due Section */}
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-danger-500" />
                <h2 className="text-lg font-semibold text-surface-900">
                  Due Today / Past Due
                </h2>
              </div>
              <Link
                href="/action-items"
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                View all
              </Link>
            </div>
            {overdueItems.data && overdueItems.data.length > 0 ? (
              <div className="space-y-2">
                {overdueItems.data.map((item) => (
                  <Link
                    key={item.id}
                    href={`/action-items/${item.id}`}
                    className="group flex items-center justify-between rounded-lg border border-surface-200 p-3 transition-colors hover:bg-surface-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900 group-hover:text-primary-600">
                        {item.description}
                      </p>
                      <p className="text-xs text-surface-500">
                        {getProjectName(item.project)} {getOwnerName(item.owner) ? `• ${getOwnerName(item.owner)}` : ''}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${
                          isPastDue(item.due_date)
                            ? 'bg-danger-50 text-danger-700'
                            : 'bg-warning-50 text-warning-700'
                        }`}
                      >
                        {formatDueDate(item.due_date)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-surface-400 group-hover:text-primary-600" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckSquare className="mb-2 h-8 w-8 text-success-300" />
                <p className="text-sm text-surface-500">No overdue items</p>
                <p className="mt-1 text-xs text-surface-400">You&apos;re all caught up!</p>
              </div>
            )}
          </div>

          {/* Coming Up Section - Next 5 Business Days */}
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary-500" />
                <h2 className="text-lg font-semibold text-surface-900">
                  Coming Up
                </h2>
              </div>
              <span className="text-xs text-surface-500">Next 5 business days</span>
            </div>
            {upcomingItems.data && upcomingItems.data.length > 0 ? (
              <div className="space-y-2">
                {upcomingItems.data.map((item) => (
                  <Link
                    key={item.id}
                    href={`/action-items/${item.id}`}
                    className="group flex items-center justify-between rounded-lg border border-surface-200 p-3 transition-colors hover:bg-surface-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900 group-hover:text-primary-600">
                        {item.description}
                      </p>
                      <p className="text-xs text-surface-500">
                        {getProjectName(item.project)} {getOwnerName(item.owner) ? `• ${getOwnerName(item.owner)}` : ''}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <span className="whitespace-nowrap rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
                        {formatDueDate(item.due_date)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-surface-400 group-hover:text-primary-600" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="mb-2 h-8 w-8 text-surface-300" />
                <p className="text-sm text-surface-500">Nothing due soon</p>
                <p className="mt-1 text-xs text-surface-400">No items due in the next 5 business days</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Actions & Recent Meetings */}
        <div className="space-y-6">
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
        </div>
      </div>
    </div>
  );
}

