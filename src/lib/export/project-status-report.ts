/**
 * Project Status Report PDF Export
 * Generates a professional PDF with Action Items, Risks, and Decisions logs
 */

import { jsPDF } from 'jspdf';
import type { ActionItemWithOwner, RiskWithOwner, DecisionWithMaker } from '@/types/database';

export interface ProjectStatusExportData {
  projectName: string;
  generatedAt: Date;
  actionItems: ActionItemWithOwner[];
  risks: RiskWithOwner[];
  decisions: DecisionWithMaker[];
  executiveSummary?: string;
}

// Helper functions
function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isOverdue(dateString: string | null): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function getOwnerName(item: ActionItemWithOwner | RiskWithOwner): string {
  if ('owner' in item && item.owner?.full_name) return item.owner.full_name;
  if ('owner_name' in item && item.owner_name) return item.owner_name;
  return 'Unassigned';
}

function getDecisionMakerName(item: DecisionWithMaker): string {
  if (item.decision_maker?.full_name) return item.decision_maker.full_name;
  if (item.decision_maker_name) return item.decision_maker_name;
  return '—';
}

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '—';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generate PDF from project status report data
 */
export async function generateProjectStatusPDF(
  data: ProjectStatusExportData
): Promise<Blob> {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = 20;
  const lineHeight = 6;

  // Track page count for footer
  let totalPages = 1;

  // Helper function to check page break
  const checkPageBreak = (requiredSpace: number): boolean => {
    if (yPosition + requiredSpace > pageHeight - 25) {
      pdf.addPage();
      totalPages++;
      yPosition = 20;
      return true;
    }
    return false;
  };

  // Helper to draw section header
  const drawSectionHeader = (title: string, itemCount: number) => {
    checkPageBreak(25);
    pdf.setFillColor(79, 70, 229); // Primary color
    pdf.rect(margin, yPosition - 5, contentWidth, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${title} (${itemCount})`, margin + 3, yPosition + 1);
    pdf.setTextColor(0, 0, 0);
    yPosition += 12;
  };

  // =====================
  // TITLE PAGE HEADER
  // =====================
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(31, 41, 55); // surface-900
  pdf.text('Project Status Report', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(16);
  pdf.setTextColor(79, 70, 229); // Primary color
  pdf.text(data.projectName, margin, yPosition);
  yPosition += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(107, 114, 128); // surface-500
  pdf.text(
    `Generated: ${data.generatedAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    margin,
    yPosition
  );
  yPosition += 15;

  // Summary stats
  pdf.setFillColor(249, 250, 251); // surface-50
  pdf.rect(margin, yPosition - 3, contentWidth, 14, 'F');
  pdf.setFontSize(9);
  pdf.setTextColor(55, 65, 81);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Action Items: ${data.actionItems.length}`, margin + 5, yPosition + 5);
  pdf.text(`Open Risks: ${data.risks.length}`, margin + 60, yPosition + 5);
  pdf.text(`Key Decisions: ${data.decisions.length}`, margin + 110, yPosition + 5);
  yPosition += 20;

  // =====================
  // EXECUTIVE SUMMARY (if provided)
  // =====================
  if (data.executiveSummary) {
    // Section header (matches other sections)
    checkPageBreak(25);
    pdf.setFillColor(79, 70, 229); // Primary color
    pdf.rect(margin, yPosition - 5, contentWidth, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Executive Summary', margin + 3, yPosition + 1);
    pdf.setTextColor(0, 0, 0);
    yPosition += 12;

    // Summary content - simple text without background
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(55, 65, 81); // surface-700

    const summaryLines = pdf.splitTextToSize(data.executiveSummary, contentWidth - 4);

    summaryLines.forEach((line: string) => {
      checkPageBreak(lineHeight);
      pdf.text(line, margin + 2, yPosition);
      yPosition += lineHeight;
    });

    yPosition += 10;
  }

  // =====================
  // SECTION 1: ACTION ITEMS
  // =====================
  drawSectionHeader('Action Items Log', data.actionItems.length);

  if (data.actionItems.length === 0) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(107, 114, 128);
    pdf.text('No open or in-progress action items', margin, yPosition);
    yPosition += 10;
  } else {
    // Table header
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(243, 244, 246); // surface-100
    pdf.rect(margin, yPosition - 3, contentWidth, 8, 'F');
    pdf.setTextColor(75, 85, 99);
    pdf.text('Title', margin + 2, yPosition + 2);
    pdf.text('Status', margin + 70, yPosition + 2);
    pdf.text('Due Date', margin + 95, yPosition + 2);
    pdf.text('Assigned To', margin + 125, yPosition + 2);
    pdf.text('Created', margin + 160, yPosition + 2);
    yPosition += 8;

    // Table rows
    pdf.setFont('helvetica', 'normal');
    data.actionItems.forEach((item, index) => {
      checkPageBreak(12);

      // Alternating row background
      if (index % 2 === 1) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, yPosition - 3, contentWidth, 10, 'F');
      }

      const overdue = isOverdue(item.due_date) && item.status !== 'Closed';

      pdf.setFontSize(8);
      pdf.setTextColor(31, 41, 55);
      pdf.text(truncateText(item.title, 40), margin + 2, yPosition + 2);

      // Status badge
      if (item.status === 'Open') {
        pdf.setTextColor(29, 78, 216); // primary-700
      } else if (item.status === 'In Progress') {
        pdf.setTextColor(180, 83, 9); // warning-700
      }
      pdf.text(item.status, margin + 70, yPosition + 2);

      // Due date (red if overdue)
      if (overdue) {
        pdf.setTextColor(220, 38, 38); // danger-600
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setTextColor(55, 65, 81);
        pdf.setFont('helvetica', 'normal');
      }
      pdf.text(formatDate(item.due_date), margin + 95, yPosition + 2);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(55, 65, 81);
      pdf.text(truncateText(getOwnerName(item), 20), margin + 125, yPosition + 2);
      pdf.setTextColor(107, 114, 128);
      pdf.text(formatDate(item.created_at), margin + 160, yPosition + 2);

      yPosition += 10;
    });
  }

  // =====================
  // SECTION 2: RISKS/ISSUES
  // =====================
  yPosition += 10;
  drawSectionHeader('Risk/Issue Log', data.risks.length);

  if (data.risks.length === 0) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(107, 114, 128);
    pdf.text('No open risks or issues', margin, yPosition);
    yPosition += 10;
  } else {
    // Table header
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, yPosition - 3, contentWidth, 8, 'F');
    pdf.setTextColor(75, 85, 99);
    pdf.text('Risk/Issue', margin + 2, yPosition + 2);
    pdf.text('Prob.', margin + 55, yPosition + 2);
    pdf.text('Impact', margin + 72, yPosition + 2);
    pdf.text('Mitigation', margin + 90, yPosition + 2);
    pdf.text('Owner', margin + 140, yPosition + 2);
    pdf.text('Created', margin + 165, yPosition + 2);
    yPosition += 8;

    // Table rows
    pdf.setFont('helvetica', 'normal');
    data.risks.forEach((item, index) => {
      checkPageBreak(12);

      if (index % 2 === 1) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, yPosition - 3, contentWidth, 10, 'F');
      }

      pdf.setFontSize(8);
      pdf.setTextColor(31, 41, 55);
      pdf.text(truncateText(item.title, 32), margin + 2, yPosition + 2);

      // Probability badge color
      const probColor = item.probability === 'High' ? [220, 38, 38] : item.probability === 'Med' ? [180, 83, 9] : [22, 163, 74];
      pdf.setTextColor(probColor[0], probColor[1], probColor[2]);
      pdf.text(item.probability, margin + 55, yPosition + 2);

      // Impact badge color
      const impactColor = item.impact === 'High' ? [220, 38, 38] : item.impact === 'Med' ? [180, 83, 9] : [22, 163, 74];
      pdf.setTextColor(impactColor[0], impactColor[1], impactColor[2]);
      pdf.text(item.impact, margin + 72, yPosition + 2);

      pdf.setTextColor(55, 65, 81);
      pdf.text(truncateText(item.mitigation, 30), margin + 90, yPosition + 2);
      pdf.text(truncateText(getOwnerName(item), 15), margin + 140, yPosition + 2);
      pdf.setTextColor(107, 114, 128);
      pdf.text(formatDate(item.created_at), margin + 165, yPosition + 2);

      yPosition += 10;
    });
  }

  // =====================
  // SECTION 3: KEY DECISIONS
  // =====================
  yPosition += 10;
  drawSectionHeader('Key Decisions Log', data.decisions.length);

  if (data.decisions.length === 0) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(107, 114, 128);
    pdf.text('No key decisions recorded', margin, yPosition);
    yPosition += 10;
  } else {
    // Table header
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, yPosition - 3, contentWidth, 8, 'F');
    pdf.setTextColor(75, 85, 99);
    pdf.text('Decision', margin + 2, yPosition + 2);
    pdf.text('Rationale', margin + 55, yPosition + 2);
    pdf.text('Impact', margin + 100, yPosition + 2);
    pdf.text('Decision Maker', margin + 135, yPosition + 2);
    pdf.text('Date', margin + 168, yPosition + 2);
    yPosition += 8;

    // Table rows
    pdf.setFont('helvetica', 'normal');
    data.decisions.forEach((item, index) => {
      checkPageBreak(12);

      if (index % 2 === 1) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, yPosition - 3, contentWidth, 10, 'F');
      }

      pdf.setFontSize(8);
      pdf.setTextColor(31, 41, 55);
      pdf.text(truncateText(item.title, 32), margin + 2, yPosition + 2);
      pdf.setTextColor(55, 65, 81);
      pdf.text(truncateText(item.rationale, 28), margin + 55, yPosition + 2);
      pdf.text(truncateText(item.impact, 22), margin + 100, yPosition + 2);
      pdf.text(truncateText(getDecisionMakerName(item), 18), margin + 135, yPosition + 2);
      pdf.setTextColor(107, 114, 128);
      pdf.text(formatDate(item.created_at), margin + 168, yPosition + 2);

      yPosition += 10;
    });
  }

  // =====================
  // FOOTER ON ALL PAGES
  // =====================
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(156, 163, 175); // surface-400
    pdf.text(
      `${data.projectName} - Project Status Report | Page ${i} of ${pageCount}`,
      margin,
      pageHeight - 10
    );
    pdf.text(
      `Generated ${data.generatedAt.toLocaleDateString()}`,
      pageWidth - margin - 45,
      pageHeight - 10
    );
  }

  return pdf.output('blob');
}
