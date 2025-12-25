'use client';

import { useState } from 'react';
import { Download, ChevronDown, FileText, Table, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { clientLog } from '@/lib/client-logger';
import {
  downloadCSV,
  exportActionItemsToCSV,
  exportDecisionsToCSV,
  exportRisksToCSV,
} from '@/lib/export/csv';
import type { ActionItem, Decision, Risk } from '@/types/database';

type ExportType = 'action_items' | 'decisions' | 'risks' | 'all';

interface ExportButtonProps {
  type: ExportType;
  data: {
    actionItems?: ActionItem[];
    decisions?: Decision[];
    risks?: Risk[];
  };
  projectName?: string;
}

export function ExportButton({ type, data, projectName }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();

  const handleExport = async (format: 'csv') => {
    setIsExporting(true);
    setIsOpen(false);

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const prefix = projectName
        ? `${projectName.replace(/\s+/g, '_')}_`
        : '';

      if (format === 'csv') {
        if (type === 'action_items' && data.actionItems) {
          const csv = exportActionItemsToCSV(data.actionItems);
          downloadCSV(csv, `${prefix}action_items_${timestamp}.csv`);
        } else if (type === 'decisions' && data.decisions) {
          const csv = exportDecisionsToCSV(data.decisions);
          downloadCSV(csv, `${prefix}decisions_${timestamp}.csv`);
        } else if (type === 'risks' && data.risks) {
          const csv = exportRisksToCSV(data.risks);
          downloadCSV(csv, `${prefix}risks_${timestamp}.csv`);
        }
      }
    } catch (error) {
      clientLog.error('Export failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="btn-secondary"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-surface-200 bg-white py-1 shadow-medium">
            <button
              onClick={() => handleExport('csv')}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50"
            >
              <Table className="h-4 w-4" />
              Export as CSV
            </button>
            {/* DOCX and PDF would require additional libraries */}
            <button
              disabled
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-surface-400"
            >
              <FileText className="h-4 w-4" />
              Export as DOCX (coming soon)
            </button>
            <button
              disabled
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-surface-400"
            >
              <File className="h-4 w-4" />
              Export as PDF (coming soon)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

