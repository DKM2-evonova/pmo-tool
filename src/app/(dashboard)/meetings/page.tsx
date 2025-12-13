import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Calendar, Plus, Filter } from 'lucide-react';
import { formatDateReadable } from '@/lib/utils';
import { Badge } from '@/components/ui';

export default async function MeetingsPage() {
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

  // Get meetings (exclude deleted ones for regular users)
  const { data: meetings } = await supabase
    .from('meetings')
    .select(
      `
      *,
      project:projects(id, name)
    `
    )
    .in('project_id', projectIds.length > 0 ? projectIds : ['none'])
    .neq('status', 'Deleted')
    .order('created_at', { ascending: false });

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
    Draft: 'default',
    Processing: 'primary' as any,
    Review: 'warning',
    Published: 'success',
    Failed: 'danger',
    Deleted: 'danger',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Meetings</h1>
          <p className="mt-1 text-surface-500">
            Process and review meeting transcripts
          </p>
        </div>
        <Link href="/meetings/new" className="btn-primary">
          <Plus className="h-4 w-4" />
          New Meeting
        </Link>
      </div>

      {meetings && meetings.length > 0 ? (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-surface-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
                  Meeting
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-surface-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {meetings.map((meeting) => (
                <tr key={meeting.id} className="hover:bg-surface-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/meetings/${meeting.id}`}
                      className="font-medium text-surface-900 hover:text-primary-600"
                    >
                      {meeting.title || 'Untitled Meeting'}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-500">
                    {(meeting.project as unknown as { name: string })?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-500">
                    {meeting.category || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-500">
                    {meeting.date ? formatDateReadable(meeting.date) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusColors[meeting.status] || 'default'}>
                      {meeting.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="mb-4 h-12 w-12 text-surface-300" />
          <h3 className="text-lg font-medium text-surface-900">
            No meetings yet
          </h3>
          <p className="mt-1 text-surface-500">
            Process your first meeting transcript to get started
          </p>
          <Link href="/meetings/new" className="btn-primary mt-4">
            <Plus className="h-4 w-4" />
            Process Meeting
          </Link>
        </div>
      )}
    </div>
  );
}

