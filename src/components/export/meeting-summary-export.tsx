'use client';

import { useState } from 'react';
import { Download, ChevronDown, FileText, File, Loader2 } from 'lucide-react';
import { downloadMeetingSummary } from '@/lib/export/meeting-summary';
import type { Meeting, MeetingRecap, MeetingTone } from '@/types/database';

interface MeetingSummaryExportProps {
  meeting: Meeting & { project: { id: string; name: string } };
  recap: MeetingRecap;
  tone?: MeetingTone | null;
  showTone?: boolean;
}

type ExportFormat = 'pdf' | 'docx';

export function MeetingSummaryExport({
  meeting,
  recap,
  tone,
  showTone = false,
}: MeetingSummaryExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(format);
    setIsOpen(false);

    try {
      await downloadMeetingSummary(
        { meeting, recap, tone, showTone },
        format
      );
    } catch (error) {
      // Error details logged server-side if applicable
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting !== null}
        className="btn-secondary"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {isExporting ? 'Exporting...' : 'Download Summary'}
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-surface-200 bg-white py-1 shadow-medium">
            <div className="border-b border-surface-100 px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-surface-500">
                Export Format
              </span>
            </div>
            
            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting !== null}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 disabled:opacity-50"
            >
              <File className="h-4 w-4 text-danger-500" />
              <div className="text-left">
                <div className="font-medium">PDF Document</div>
                <div className="text-xs text-surface-500">
                  Best for printing & sharing
                </div>
              </div>
            </button>

            <button
              onClick={() => handleExport('docx')}
              disabled={isExporting !== null}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 disabled:opacity-50"
            >
              <FileText className="h-4 w-4 text-primary-500" />
              <div className="text-left">
                <div className="font-medium">Word Document (.docx)</div>
                <div className="text-xs text-surface-500">
                  Works with Microsoft Word & Google Docs
                </div>
              </div>
            </button>

            <div className="border-t border-surface-100 px-4 py-2">
              <p className="text-xs text-surface-400">
                Google Docs: Upload the .docx file to Google Drive to edit
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}












