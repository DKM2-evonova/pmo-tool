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
  FileBarChart,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
      gradient: 'from-primary-500 to-primary-600',
      bgGradient: 'from-primary-50 to-primary-100/50',
      iconColor: 'text-primary-600',
      shadow: 'shadow-primary-500/20',
    },
    {
      name: 'Active Risks',
      value: openRisks,
      icon: AlertTriangle,
      href: '/risks',
      gradient: 'from-warning-500 to-warning-600',
      bgGradient: 'from-warning-50 to-warning-100/50',
      iconColor: 'text-warning-600',
      shadow: 'shadow-warning-500/20',
    },
    {
      name: 'Total Decisions',
      value: decisions.data?.length || 0,
      icon: FileText,
      href: '/decisions',
      gradient: 'from-success-500 to-success-600',
      bgGradient: 'from-success-50 to-success-100/50',
      iconColor: 'text-success-600',
      shadow: 'shadow-success-500/20',
    },
    {
      name: 'Meetings Processed',
      value: meetings.data?.filter((m) => m.status === 'Published').length || 0,
      icon: Calendar,
      href: '/meetings',
      gradient: 'from-surface-500 to-surface-600',
      bgGradient: 'from-surface-100 to-surface-200/50',
      iconColor: 'text-surface-600',
      shadow: 'shadow-surface-500/20',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
            <span className="glass-badge text-primary-600">
              <Sparkles className="mr-1 h-3 w-3" />
              Overview
            </span>
          </div>
          <p className="mt-1.5 text-surface-500">
            Overview of your project management activities
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Link
            key={stat.name}
            href={stat.href}
            className={cn(
              'group relative overflow-hidden rounded-2xl p-5',
              'bg-gradient-to-br',
              stat.bgGradient,
              'border border-white/60',
              'shadow-lg',
              stat.shadow,
              'transition-all duration-300',
              'hover:scale-[1.02] hover:shadow-xl',
              'animate-fade-in'
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Subtle shine effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="relative flex items-center gap-4">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl',
                  'bg-white/80 backdrop-blur-sm',
                  'shadow-soft',
                  'transition-transform duration-300 group-hover:scale-110'
                )}
              >
                <stat.icon className={cn('h-6 w-6', stat.iconColor)} />
              </div>
              <div>
                <p className="text-3xl font-bold text-surface-900">{stat.value}</p>
                <p className="text-sm font-medium text-surface-600">{stat.name}</p>
              </div>
            </div>

            {/* Arrow indicator */}
            <div className="absolute right-4 top-4 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2">
              <ArrowUpRight className="h-5 w-5 text-surface-400" />
            </div>
          </Link>
        ))}
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Due Items */}
        <div className="space-y-6">
          {/* Due Today / Past Due Section */}
          <div className="glass-panel p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger-50 shadow-sm">
                  <AlertCircle className="h-5 w-5 text-danger-500" />
                </div>
                <h2 className="text-lg font-semibold text-surface-900">
                  Due Today / Past Due
                </h2>
              </div>
              <Link
                href="/action-items"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
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
                    className={cn(
                      'group flex items-center justify-between rounded-xl p-3',
                      'bg-white/60 backdrop-blur-sm',
                      'border border-surface-200/60',
                      'transition-all duration-200',
                      'hover:bg-white hover:shadow-md hover:border-surface-300/60'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900 group-hover:text-primary-600 transition-colors">
                        {item.description}
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {getProjectName(item.project)} {getOwnerName(item.owner) ? `• ${getOwnerName(item.owner)}` : ''}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <span
                        className={cn(
                          'whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium',
                          isPastDue(item.due_date)
                            ? 'bg-danger-50/80 text-danger-700 border border-danger-200/50'
                            : 'bg-warning-50/80 text-warning-700 border border-warning-200/50'
                        )}
                      >
                        {formatDueDate(item.due_date)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-surface-400 group-hover:text-primary-600 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50/80 mb-3">
                  <CheckSquare className="h-7 w-7 text-success-400" />
                </div>
                <p className="text-sm font-medium text-surface-600">No overdue items</p>
                <p className="mt-1 text-xs text-surface-400">You&apos;re all caught up!</p>
              </div>
            )}
          </div>

          {/* Coming Up Section - Next 5 Business Days */}
          <div className="glass-panel p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 shadow-sm">
                  <Clock className="h-5 w-5 text-primary-500" />
                </div>
                <h2 className="text-lg font-semibold text-surface-900">
                  Coming Up
                </h2>
              </div>
              <span className="glass-badge text-surface-500">Next 5 business days</span>
            </div>
            {upcomingItems.data && upcomingItems.data.length > 0 ? (
              <div className="space-y-2">
                {upcomingItems.data.map((item) => (
                  <Link
                    key={item.id}
                    href={`/action-items/${item.id}`}
                    className={cn(
                      'group flex items-center justify-between rounded-xl p-3',
                      'bg-white/60 backdrop-blur-sm',
                      'border border-surface-200/60',
                      'transition-all duration-200',
                      'hover:bg-white hover:shadow-md hover:border-surface-300/60'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900 group-hover:text-primary-600 transition-colors">
                        {item.description}
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {getProjectName(item.project)} {getOwnerName(item.owner) ? `• ${getOwnerName(item.owner)}` : ''}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <span className="whitespace-nowrap rounded-lg bg-primary-50/80 border border-primary-200/50 px-2.5 py-1 text-xs font-medium text-primary-700">
                        {formatDueDate(item.due_date)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-surface-400 group-hover:text-primary-600 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100/80 mb-3">
                  <Calendar className="h-7 w-7 text-surface-400" />
                </div>
                <p className="text-sm font-medium text-surface-600">Nothing due soon</p>
                <p className="mt-1 text-xs text-surface-400">No items due in the next 5 business days</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Actions & Recent Meetings */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="glass-panel p-6">
            <h2 className="mb-5 text-lg font-semibold text-surface-900">
              Quick Actions
            </h2>
            <div className="space-y-3">
              {[
                {
                  href: '/meetings/new',
                  icon: Calendar,
                  iconBg: 'bg-primary-50',
                  iconColor: 'text-primary-600',
                  title: 'Process New Meeting',
                  description: 'Upload a transcript or connect to Google Meet',
                },
                {
                  href: '/action-items/new',
                  icon: CheckSquare,
                  iconBg: 'bg-success-50',
                  iconColor: 'text-success-600',
                  title: 'Create Action Item',
                  description: 'Manually add a new task',
                },
                {
                  href: '/action-items?view=kanban',
                  icon: TrendingUp,
                  iconBg: 'bg-surface-100',
                  iconColor: 'text-surface-600',
                  title: 'View Kanban Board',
                  description: 'Manage action items visually',
                },
                {
                  href: '/reports/project-status',
                  icon: FileBarChart,
                  iconBg: 'bg-warning-50',
                  iconColor: 'text-warning-600',
                  title: 'View Status Report',
                  description: 'Action items, risks & decisions',
                },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    'group flex items-center gap-4 rounded-xl p-4',
                    'bg-white/60 backdrop-blur-sm',
                    'border border-surface-200/60',
                    'transition-all duration-200',
                    'hover:bg-white hover:shadow-md hover:border-surface-300/60 hover:scale-[1.01]'
                  )}
                >
                  <div className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl shadow-sm',
                    'transition-transform duration-200 group-hover:scale-110',
                    action.iconBg
                  )}>
                    <action.icon className={cn('h-5 w-5', action.iconColor)} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-surface-900 group-hover:text-primary-600 transition-colors">
                      {action.title}
                    </p>
                    <p className="text-sm text-surface-500">
                      {action.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-surface-300 group-hover:text-primary-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Meetings */}
          <div className="glass-panel p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-surface-900">
                Recent Meetings
              </h2>
              <Link
                href="/meetings"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                View all
              </Link>
            </div>
            {meetings.data && meetings.data.length > 0 ? (
              <div className="space-y-2">
                {meetings.data.map((meeting) => (
                  <Link
                    key={meeting.id}
                    href={`/meetings/${meeting.id}`}
                    className={cn(
                      'group flex items-center justify-between rounded-xl p-3',
                      'bg-white/60 backdrop-blur-sm',
                      'border border-surface-200/60',
                      'transition-all duration-200',
                      'hover:bg-white hover:shadow-md hover:border-surface-300/60'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-surface-900 group-hover:text-primary-600 transition-colors">
                        {meeting.title || 'Untitled Meeting'}
                      </p>
                      <p className="text-sm text-surface-500">
                        {(meeting.project as unknown as { name: string })?.name || 'Unknown Project'}
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-xs font-medium border',
                          meeting.status === 'Published'
                            ? 'bg-success-50/80 text-success-700 border-success-200/50'
                            : meeting.status === 'Review'
                              ? 'bg-warning-50/80 text-warning-700 border-warning-200/50'
                              : meeting.status === 'Failed'
                                ? 'bg-danger-50/80 text-danger-700 border-danger-200/50'
                                : 'bg-surface-100/80 text-surface-600 border-surface-200/50'
                        )}
                      >
                        {meeting.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100/80 mb-3">
                  <Calendar className="h-7 w-7 text-surface-400" />
                </div>
                <p className="text-sm font-medium text-surface-600">No meetings yet</p>
                <Link
                  href="/meetings/new"
                  className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
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
