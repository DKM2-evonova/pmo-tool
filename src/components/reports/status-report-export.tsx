'use client';

import { useState } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { generateProjectStatusPDF } from '@/lib/export/project-status-report';
import { generateProjectStatusExcel } from '@/lib/export/project-status-excel';
import { useToast } from '@/components/ui/toast';
import { clientLog } from '@/lib/client-logger';
import type { ActionItemWithOwner, RiskWithOwner, DecisionWithMaker, MilestoneWithPredecessor } from '@/types/database';

interface StatusReportExportProps {
  projectName: string;
  actionItems: ActionItemWithOwner[];
  risks: RiskWithOwner[];
  decisions: DecisionWithMaker[];
  milestones: MilestoneWithPredecessor[];
  disabled?: boolean;
}

export function StatusReportExport({
  projectName,
  actionItems,
  risks,
  decisions,
  milestones,
  disabled,
}: StatusReportExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<'pdf' | 'excel' | null>(null);
  const { showToast } = useToast();

  const handleExport = async (format: 'pdf' | 'excel') => {
    setIsExporting(format);
    setIsOpen(false);

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${sanitizedProjectName}_Status_Report_${timestamp}`;

      const exportData = {
        projectName,
        generatedAt: new Date(),
        actionItems,
        risks,
        decisions,
        milestones,
      };

      let blob: Blob;
      let extension: string;

      if (format === 'pdf') {
        blob = await generateProjectStatusPDF(exportData);
        extension = 'pdf';
      } else {
        blob = await generateProjectStatusExcel(exportData);
        extension = 'xlsx';
      }

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      clientLog.error('Export failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setIsExporting(null);
    }
  };

  const isDisabled = disabled || isExporting !== null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDisabled}
        className="flex items-center gap-2 rounded-lg border border-surface-300 bg-white px-4 py-2.5 text-sm font-medium text-surface-700 shadow-sm transition-colors hover:bg-surface-50 hover:border-surface-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        <span>{isExporting ? 'Exporting...' : 'Export Report'}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && !isDisabled && (
        <>
          {/* Backdrop to close dropdown when clicking outside */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-surface-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => handleExport('pdf')}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-surface-700 transition-colors hover:bg-surface-50"
            >
              <FileText className="h-4 w-4 text-danger-500" />
              <div className="text-left">
                <p className="font-medium">Export as PDF</p>
                <p className="text-xs text-surface-500">Printable format</p>
              </div>
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-surface-700 transition-colors hover:bg-surface-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-success-500" />
              <div className="text-left">
                <p className="font-medium">Export as Excel</p>
                <p className="text-xs text-surface-500">4 worksheets</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
