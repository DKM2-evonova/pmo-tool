import Link from 'next/link';
import { ArrowLeft, Calendar, Users, Tag } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatDateReadable } from '@/lib/utils';
import type { Meeting } from '@/types/database';

interface MeetingDetailsProps {
  meeting: Meeting & { project: { id: string; name: string } };
}

export function MeetingDetails({ meeting }: MeetingDetailsProps) {
  const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
    Draft: 'default',
    Processing: 'default',
    Review: 'warning',
    Published: 'success',
    Failed: 'danger',
  };

  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm text-surface-500">
          <Link
            href={`/projects/${meeting.project_id}`}
            className="hover:text-primary-600"
          >
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            {(meeting.project as any).name}
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-surface-900">
          {meeting.title || 'Untitled Meeting'}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-surface-500">
          {meeting.date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDateReadable(meeting.date)}
            </span>
          )}
          {meeting.category && (
            <span className="flex items-center gap-1">
              <Tag className="h-4 w-4" />
              {meeting.category}
            </span>
          )}
          {(meeting.attendees as any[])?.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {(meeting.attendees as any[]).length} attendees
            </span>
          )}
        </div>
      </div>
      <Badge variant={statusVariant[meeting.status]}>{meeting.status}</Badge>
    </div>
  );
}

