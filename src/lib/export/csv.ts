/**
 * CSV Export utilities
 */

import type { ActionItem, Decision, Risk } from '@/types/database';

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportActionItemsToCSV(actionItems: ActionItem[]): string {
  const headers = [
    'Title',
    'Description',
    'Status',
    'Owner',
    'Owner Email',
    'Due Date',
    'Created At',
  ];

  const rows = actionItems.map((item) => [
    escapeCSV(item.title),
    escapeCSV(item.description),
    escapeCSV(item.status),
    escapeCSV(item.owner_name),
    escapeCSV(item.owner_email),
    escapeCSV(item.due_date),
    escapeCSV(item.created_at),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function exportDecisionsToCSV(decisions: Decision[]): string {
  const headers = [
    'Title',
    'Rationale',
    'Impact',
    'Outcome',
    'Decision Maker',
    'Decision Maker Email',
    'Created At',
  ];

  const rows = decisions.map((item) => [
    escapeCSV(item.title),
    escapeCSV(item.rationale),
    escapeCSV(item.impact),
    escapeCSV(item.outcome),
    escapeCSV(item.decision_maker_name),
    escapeCSV(item.decision_maker_email),
    escapeCSV(item.created_at),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function exportRisksToCSV(risks: Risk[]): string {
  const headers = [
    'Title',
    'Description',
    'Probability',
    'Impact',
    'Mitigation',
    'Status',
    'Owner',
    'Owner Email',
    'Created At',
  ];

  const rows = risks.map((item) => [
    escapeCSV(item.title),
    escapeCSV(item.description),
    escapeCSV(item.probability),
    escapeCSV(item.impact),
    escapeCSV(item.mitigation),
    escapeCSV(item.status),
    escapeCSV(item.owner_name),
    escapeCSV(item.owner_email),
    escapeCSV(item.created_at),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

