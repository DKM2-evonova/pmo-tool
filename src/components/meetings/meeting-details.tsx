'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, Users, Tag, FileText, Download, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatDateReadable } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import type { Meeting } from '@/types/database';

interface MeetingDetailsProps {
  meeting: Meeting & { project: { id: string; name: string } };
}

export function MeetingDetails({ meeting }: MeetingDetailsProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const supabase = createClient();
  const { showToast } = useToast();

  const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
    Draft: 'default',
    Processing: 'default',
    Review: 'warning',
    Published: 'success',
    Failed: 'danger',
  };

  const handleDownloadFile = async () => {
    if (!meeting.source_file_path) return;

    setIsDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('meeting-files')
        .download(meeting.source_file_path);

      if (error) {
        console.error('Error downloading file:', error);
        showToast('Failed to download file. Please try again.', 'error');
        return;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = meeting.source_file_name || 'transcript';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      showToast('Failed to download file. Please try again.', 'error');
    } finally {
      setIsDownloading(false);
    }
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
          {meeting.source_file_name && (
            <button
              onClick={handleDownloadFile}
              disabled={isDownloading}
              className="flex items-center gap-1 text-primary-600 hover:text-primary-700 hover:underline disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span>{meeting.source_file_name}</span>
              <Download className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <Badge variant={statusVariant[meeting.status]}>{meeting.status}</Badge>
    </div>
  );
}

