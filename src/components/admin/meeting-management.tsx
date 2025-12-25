'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Search, MoreVertical, Trash2, Calendar, FileText, AlertTriangle } from 'lucide-react';
import { cn, formatDateReadable } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { clientLog } from '@/lib/client-logger';
import type { Meeting } from '@/types/database';
import type { MeetingCategory, MeetingStatus } from '@/types/enums';

interface MeetingWithProject extends Meeting {
  project: {
    id: string;
    name: string;
  } | null;
}

interface MeetingManagementProps {
  meetings: MeetingWithProject[];
}

export function MeetingManagement({ meetings }: MeetingManagementProps) {
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredMeetings = meetings.filter(
    (meeting) =>
      meeting.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.project?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors: Record<MeetingStatus, string> = {
    Draft: 'bg-surface-50 text-surface-600',
    Processing: 'bg-warning-50 text-warning-600',
    Review: 'bg-info-50 text-info-600',
    Published: 'bg-success-50 text-success-600',
    Failed: 'bg-danger-50 text-danger-600',
    Deleted: 'bg-danger-50 text-danger-600',
  };

  const categoryLabels: Record<MeetingCategory, string> = {
    Project: 'Project',
    Governance: 'Governance',
    Discovery: 'Discovery',
    Alignment: 'Alignment',
    Remediation: 'Remediation',
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting?.status === 'Deleted') {
      showToast('This meeting is already deleted.', 'warning');
      return;
    }

    if (!confirm('Are you sure you want to delete this meeting and all associated items? The meeting will be marked as deleted and will no longer generate new items. This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE',
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to delete meeting');
      }

      showToast(`Meeting deleted successfully. Removed ${responseData.deleted.action_items} action items, ${responseData.deleted.decisions} decisions, and ${responseData.deleted.risks} risks.`, 'success');

      // Force a hard refresh to ensure the status update is visible
      router.refresh();
      setSelectedMeeting(null);
    } catch (error) {
      clientLog.error('Error deleting meeting', { error: error instanceof Error ? error.message : 'Unknown error' });
      showToast('Failed to delete meeting: ' + (error as Error).message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="card">
      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search meetings by title, project, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Meeting table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-200">
              <th className="py-3 text-left text-sm font-medium text-surface-500">
                Meeting
              </th>
              <th className="py-3 text-left text-sm font-medium text-surface-500">
                Project
              </th>
              <th className="py-3 text-left text-sm font-medium text-surface-500">
                Category
              </th>
              <th className="py-3 text-left text-sm font-medium text-surface-500">
                Status
              </th>
              <th className="py-3 text-left text-sm font-medium text-surface-500">
                Date
              </th>
              <th className="py-3 text-right text-sm font-medium text-surface-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {filteredMeetings.map((meeting) => (
              <tr key={meeting.id} className="group">
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                      <FileText className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-surface-900">
                        {meeting.title || 'Untitled Meeting'}
                      </p>
                      <p className="text-sm text-surface-500">
                        Created {formatDateReadable(meeting.created_at)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-4">
                  <span className="text-sm text-surface-700">
                    {meeting.project?.name || 'Unknown Project'}
                  </span>
                </td>
                <td className="py-4">
                  <span className="text-sm text-surface-700">
                    {meeting.category ? categoryLabels[meeting.category] : 'Unknown'}
                  </span>
                </td>
                <td className="py-4">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                      statusColors[meeting.status]
                    )}
                  >
                    {meeting.status}
                  </span>
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-1 text-sm text-surface-500">
                    <Calendar className="h-4 w-4" />
                    {meeting.date ? formatDateReadable(meeting.date) : 'No date'}
                  </div>
                </td>
                <td className="py-4 text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={() =>
                        setSelectedMeeting(
                          selectedMeeting?.id === meeting.id ? null : meeting
                        )
                      }
                      className="rounded-lg p-2 text-surface-400 opacity-0 transition-opacity hover:bg-surface-100 hover:text-surface-600 group-hover:opacity-100"
                      aria-label="Meeting actions menu"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {selectedMeeting?.id === meeting.id && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-48 animate-fade-in rounded-lg border border-surface-200 bg-white py-1 shadow-medium">
                        {meeting.status === 'Deleted' ? (
                          <p className="px-3 py-2 text-sm text-surface-400">
                            Already deleted
                          </p>
                        ) : (
                          <button
                            onClick={() => handleDeleteMeeting(meeting.id)}
                            disabled={isDeleting}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            {isDeleting ? 'Deleting...' : 'Delete Meeting'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredMeetings.length === 0 && (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-surface-300" />
            <p className="text-surface-500">No meetings found</p>
          </div>
        )}
      </div>
    </div>
  );
}
























