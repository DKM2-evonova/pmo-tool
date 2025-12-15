/**
 * Project Status Report Excel Export
 * Generates a professional Excel workbook with 3 sheets:
 * 1. Action Items
 * 2. Risks/Issues
 * 3. Key Decisions
 *
 * Compatible with Microsoft Excel and Google Sheets
 */

import ExcelJS from 'exceljs';
import type { ActionItemWithOwner, RiskWithOwner, DecisionWithMaker } from '@/types/database';

export interface ProjectStatusExportData {
  projectName: string;
  generatedAt: Date;
  actionItems: ActionItemWithOwner[];
  risks: RiskWithOwner[];
  decisions: DecisionWithMaker[];
}

// Color palette (ARGB format for ExcelJS)
const COLORS = {
  primary: 'FF4F46E5',
  primaryDark: 'FF3730A3',
  primaryLight: 'FFEEF2FF',
  success: 'FF16A34A',
  successLight: 'FFDCFCE7',
  warning: 'FFD97706',
  warningLight: 'FFFEF3C7',
  danger: 'FFDC2626',
  dangerLight: 'FFFEE2E2',
  surface50: 'FFF9FAFB',
  surface100: 'FFF3F4F6',
  surface200: 'FFE5E7EB',
  surface300: 'FFD1D5DB',
  surface500: 'FF6B7280',
  surface600: 'FF4B5563',
  surface700: 'FF374151',
  surface900: 'FF111827',
  white: 'FFFFFFFF',
};

// Base row height for single line
const BASE_ROW_HEIGHT = 20;
// Characters per line estimate for wrapped text
const CHARS_PER_LINE = 50;
// Maximum row height
const MAX_ROW_HEIGHT = 80;

// Helper functions
function formatDateString(dateString: string | null): string {
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

function getProjectName(item: ActionItemWithOwner | RiskWithOwner | DecisionWithMaker): string {
  return (item as any).project?.name || '—';
}

function getMeetingTitle(item: ActionItemWithOwner | RiskWithOwner | DecisionWithMaker): string {
  return (item as any).source_meeting?.title || '—';
}

/**
 * Calculate row height based on content
 */
function calculateRowHeight(texts: (string | null | undefined)[], columnWidths: number[]): number {
  let maxLines = 1;

  texts.forEach((text, index) => {
    if (text && columnWidths[index]) {
      // Estimate characters that fit per line based on column width
      const charsPerLine = Math.floor(columnWidths[index] * 1.5);
      const lines = Math.ceil(text.length / charsPerLine);
      maxLines = Math.max(maxLines, lines);
    }
  });

  const calculatedHeight = BASE_ROW_HEIGHT + (maxLines - 1) * 14;
  return Math.min(calculatedHeight, MAX_ROW_HEIGHT);
}

/**
 * Add report header to sheet
 */
function addReportHeader(
  sheet: ExcelJS.Worksheet,
  title: string,
  projectName: string,
  generatedAt: Date,
  itemCount: number,
  columnCount: number
) {
  // Merge cells for title
  sheet.mergeCells(1, 1, 1, columnCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16, color: { argb: COLORS.surface900 } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 28;

  // Project name and date row
  sheet.mergeCells(2, 1, 2, Math.floor(columnCount / 2));
  const projectCell = sheet.getCell(2, 1);
  projectCell.value = `Project: ${projectName}`;
  projectCell.font = { size: 11, color: { argb: COLORS.primary }, bold: true };
  projectCell.alignment = { vertical: 'middle', horizontal: 'left' };

  sheet.mergeCells(2, Math.floor(columnCount / 2) + 1, 2, columnCount);
  const dateCell = sheet.getCell(2, Math.floor(columnCount / 2) + 1);
  dateCell.value = `Generated: ${generatedAt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`;
  dateCell.font = { size: 10, color: { argb: COLORS.surface500 } };
  dateCell.alignment = { vertical: 'middle', horizontal: 'right' };
  sheet.getRow(2).height = 20;

  // Summary row
  sheet.mergeCells(3, 1, 3, columnCount);
  const summaryCell = sheet.getCell(3, 1);
  summaryCell.value = `Total Items: ${itemCount}`;
  summaryCell.font = { size: 10, color: { argb: COLORS.surface600 }, italic: true };
  summaryCell.alignment = { vertical: 'middle', horizontal: 'left' };
  summaryCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.surface100 },
  };
  sheet.getRow(3).height = 18;

  // Empty row for spacing
  sheet.getRow(4).height = 8;
}

/**
 * Style the column headers (row 5 after report header)
 */
function styleColumnHeaders(sheet: ExcelJS.Worksheet, headerRow: number, columnCount: number) {
  const row = sheet.getRow(headerRow);
  row.height = 30;
  row.font = {
    bold: true,
    size: 10,
    color: { argb: COLORS.white },
  };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.primary },
  };
  row.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };

  // Add borders
  for (let col = 1; col <= columnCount; col++) {
    const cell = row.getCell(col);
    cell.border = {
      top: { style: 'medium', color: { argb: COLORS.primaryDark } },
      bottom: { style: 'medium', color: { argb: COLORS.primaryDark } },
      left: { style: 'thin', color: { argb: COLORS.primaryDark } },
      right: { style: 'thin', color: { argb: COLORS.primaryDark } },
    };
  }
}

/**
 * Style a data row with borders and proper alignment
 */
function styleDataRow(
  row: ExcelJS.Row,
  rowIndex: number,
  columnCount: number,
  centerColumns: number[] = []
) {
  // Alternating row colors
  const isEvenRow = rowIndex % 2 === 0;

  row.alignment = {
    vertical: 'top',
    wrapText: true,
  };

  for (let col = 1; col <= columnCount; col++) {
    const cell = row.getCell(col);

    // Apply alternating background
    if (isEvenRow) {
      // Only apply fill if cell doesn't already have special fill (like severity colors)
      if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === undefined) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.surface50 },
        };
      }
    }

    // Center alignment for specific columns
    if (centerColumns.includes(col)) {
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
    } else {
      cell.alignment = {
        vertical: 'top',
        horizontal: 'left',
        wrapText: true,
        indent: 1,
      };
    }

    // Grid borders
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.surface200 } },
      bottom: { style: 'thin', color: { argb: COLORS.surface200 } },
      left: { style: 'thin', color: { argb: COLORS.surface200 } },
      right: { style: 'thin', color: { argb: COLORS.surface200 } },
    };
  }
}

/**
 * Add a summary footer row
 */
function addSummaryFooter(sheet: ExcelJS.Worksheet, dataRowCount: number, columnCount: number, summaryText: string) {
  const footerRowNum = sheet.rowCount + 1;
  sheet.mergeCells(footerRowNum, 1, footerRowNum, columnCount);
  const footerCell = sheet.getCell(footerRowNum, 1);
  footerCell.value = summaryText;
  footerCell.font = { size: 9, color: { argb: COLORS.surface500 }, italic: true };
  footerCell.alignment = { vertical: 'middle', horizontal: 'right' };
  footerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.surface100 },
  };
  footerCell.border = {
    top: { style: 'medium', color: { argb: COLORS.surface300 } },
  };
  sheet.getRow(footerRowNum).height = 22;
}

/**
 * Apply print settings to worksheet
 */
function applyPrintSettings(sheet: ExcelJS.Worksheet, title: string) {
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9, // A4
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    },
  };

  sheet.headerFooter = {
    oddHeader: `&L&B${title}&R&D`,
    oddFooter: '&LPage &P of &N&RGenerated by PMO Tool',
  };
}

/**
 * Generate Excel workbook with 3 sheets
 */
export async function generateProjectStatusExcel(
  data: ProjectStatusExportData
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMO Tool';
  workbook.created = data.generatedAt;
  workbook.modified = data.generatedAt;
  workbook.lastModifiedBy = 'PMO Tool';

  workbook.properties = {
    date1904: false,
  } as ExcelJS.WorkbookProperties;

  const HEADER_ROW = 5; // Data headers start at row 5 (after report header)
  const DATA_START_ROW = 6; // Data starts at row 6

  // =====================
  // SHEET 1: ACTION ITEMS
  // =====================
  const actionSheet = workbook.addWorksheet('Action Items', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: HEADER_ROW }],
  });

  const actionColumnWidths = [35, 45, 14, 14, 20, 20, 25, 14];
  actionSheet.columns = [
    { key: 'title', width: actionColumnWidths[0] },
    { key: 'description', width: actionColumnWidths[1] },
    { key: 'status', width: actionColumnWidths[2] },
    { key: 'due_date', width: actionColumnWidths[3] },
    { key: 'owner', width: actionColumnWidths[4] },
    { key: 'project', width: actionColumnWidths[5] },
    { key: 'source_meeting', width: actionColumnWidths[6] },
    { key: 'created_at', width: actionColumnWidths[7] },
  ];

  // Add report header
  addReportHeader(actionSheet, 'Action Items Log', data.projectName, data.generatedAt, data.actionItems.length, 8);

  // Add column headers at row 5
  const actionHeaders = ['Title', 'Description', 'Status', 'Due Date', 'Assigned To', 'Project', 'Source Meeting', 'Created'];
  const actionHeaderRow = actionSheet.getRow(HEADER_ROW);
  actionHeaders.forEach((header, index) => {
    actionHeaderRow.getCell(index + 1).value = header;
  });
  styleColumnHeaders(actionSheet, HEADER_ROW, 8);

  // Add data rows
  let actionRowNum = DATA_START_ROW;
  data.actionItems.forEach((item, index) => {
    const row = actionSheet.getRow(actionRowNum);

    row.getCell(1).value = item.title;
    row.getCell(2).value = item.description || '';
    row.getCell(3).value = item.status;
    row.getCell(4).value = item.due_date ? new Date(item.due_date) : null;
    row.getCell(5).value = getOwnerName(item);
    row.getCell(6).value = getProjectName(item);
    row.getCell(7).value = getMeetingTitle(item);
    row.getCell(8).value = new Date(item.created_at);

    // Calculate and set row height based on content
    const rowHeight = calculateRowHeight(
      [item.title, item.description, null, null, getOwnerName(item), getProjectName(item), getMeetingTitle(item)],
      actionColumnWidths
    );
    row.height = rowHeight;

    // Style the row (columns 3, 4, 8 are centered - status, due date, created)
    styleDataRow(row, index, 8, [3, 4, 8]);

    // Style status cell
    const statusCell = row.getCell(3);
    if (item.status === 'Open') {
      statusCell.font = { color: { argb: COLORS.primary }, bold: true, size: 10 };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } };
    } else if (item.status === 'In Progress') {
      statusCell.font = { color: { argb: COLORS.warning }, bold: true, size: 10 };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.warningLight } };
    }

    // Highlight overdue dates
    const overdue = isOverdue(item.due_date) && item.status !== 'Closed';
    if (overdue) {
      const dueDateCell = row.getCell(4);
      dueDateCell.font = { color: { argb: COLORS.danger }, bold: true, size: 10 };
      dueDateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.dangerLight } };
    }

    actionRowNum++;
  });

  // Format date columns
  actionSheet.getColumn(4).numFmt = 'mmm d, yyyy';
  actionSheet.getColumn(8).numFmt = 'mmm d, yyyy';

  // Add summary footer
  const openCount = data.actionItems.filter(i => i.status === 'Open').length;
  const inProgressCount = data.actionItems.filter(i => i.status === 'In Progress').length;
  addSummaryFooter(actionSheet, data.actionItems.length, 8,
    `Open: ${openCount} | In Progress: ${inProgressCount} | Total: ${data.actionItems.length}`);

  // Add auto-filter on header row
  if (data.actionItems.length > 0) {
    actionSheet.autoFilter = {
      from: { row: HEADER_ROW, column: 1 },
      to: { row: HEADER_ROW + data.actionItems.length, column: 8 },
    };
  }

  applyPrintSettings(actionSheet, 'Action Items Log');

  // =====================
  // SHEET 2: RISKS/ISSUES
  // =====================
  const riskSheet = workbook.addWorksheet('Risks-Issues', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: HEADER_ROW }],
  });

  const riskColumnWidths = [35, 40, 12, 12, 40, 12, 20, 20, 14];
  riskSheet.columns = [
    { key: 'title', width: riskColumnWidths[0] },
    { key: 'description', width: riskColumnWidths[1] },
    { key: 'probability', width: riskColumnWidths[2] },
    { key: 'impact', width: riskColumnWidths[3] },
    { key: 'mitigation', width: riskColumnWidths[4] },
    { key: 'status', width: riskColumnWidths[5] },
    { key: 'owner', width: riskColumnWidths[6] },
    { key: 'project', width: riskColumnWidths[7] },
    { key: 'created_at', width: riskColumnWidths[8] },
  ];

  addReportHeader(riskSheet, 'Risk/Issue Log', data.projectName, data.generatedAt, data.risks.length, 9);

  const riskHeaders = ['Risk/Issue', 'Description', 'Probability', 'Impact', 'Mitigation', 'Status', 'Owner', 'Project', 'Created'];
  const riskHeaderRow = riskSheet.getRow(HEADER_ROW);
  riskHeaders.forEach((header, index) => {
    riskHeaderRow.getCell(index + 1).value = header;
  });
  styleColumnHeaders(riskSheet, HEADER_ROW, 9);

  let riskRowNum = DATA_START_ROW;
  data.risks.forEach((item, index) => {
    const row = riskSheet.getRow(riskRowNum);

    row.getCell(1).value = item.title;
    row.getCell(2).value = item.description || '';
    row.getCell(3).value = item.probability;
    row.getCell(4).value = item.impact;
    row.getCell(5).value = item.mitigation || '';
    row.getCell(6).value = item.status;
    row.getCell(7).value = getOwnerName(item);
    row.getCell(8).value = getProjectName(item);
    row.getCell(9).value = new Date(item.created_at);

    const rowHeight = calculateRowHeight(
      [item.title, item.description, null, null, item.mitigation],
      riskColumnWidths
    );
    row.height = rowHeight;

    // Style row (columns 3, 4, 6, 9 are centered - probability, impact, status, created)
    styleDataRow(row, index, 9, [3, 4, 6, 9]);

    // Style probability cell
    const probCell = row.getCell(3);
    if (item.probability === 'High') {
      probCell.font = { color: { argb: COLORS.danger }, bold: true, size: 10 };
      probCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.dangerLight } };
    } else if (item.probability === 'Med') {
      probCell.font = { color: { argb: COLORS.warning }, bold: true, size: 10 };
      probCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.warningLight } };
    } else {
      probCell.font = { color: { argb: COLORS.success }, bold: true, size: 10 };
      probCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.successLight } };
    }

    // Style impact cell
    const impactCell = row.getCell(4);
    if (item.impact === 'High') {
      impactCell.font = { color: { argb: COLORS.danger }, bold: true, size: 10 };
      impactCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.dangerLight } };
    } else if (item.impact === 'Med') {
      impactCell.font = { color: { argb: COLORS.warning }, bold: true, size: 10 };
      impactCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.warningLight } };
    } else {
      impactCell.font = { color: { argb: COLORS.success }, bold: true, size: 10 };
      impactCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.successLight } };
    }

    // Style status cell
    const statusCell = row.getCell(6);
    statusCell.font = { color: { argb: COLORS.primary }, bold: true, size: 10 };
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } };

    riskRowNum++;
  });

  riskSheet.getColumn(9).numFmt = 'mmm d, yyyy';

  // Summary by severity
  const highRisks = data.risks.filter(r => r.probability === 'High' || r.impact === 'High').length;
  const medRisks = data.risks.filter(r => r.probability === 'Med' && r.impact !== 'High').length;
  addSummaryFooter(riskSheet, data.risks.length, 9,
    `High Severity: ${highRisks} | Medium: ${medRisks} | Total Open: ${data.risks.length}`);

  if (data.risks.length > 0) {
    riskSheet.autoFilter = {
      from: { row: HEADER_ROW, column: 1 },
      to: { row: HEADER_ROW + data.risks.length, column: 9 },
    };
  }

  applyPrintSettings(riskSheet, 'Risk/Issue Log');

  // =====================
  // SHEET 3: KEY DECISIONS
  // =====================
  const decisionSheet = workbook.addWorksheet('Key Decisions', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: HEADER_ROW }],
  });

  const decisionColumnWidths = [35, 40, 35, 20, 35, 20, 14, 25];
  decisionSheet.columns = [
    { key: 'title', width: decisionColumnWidths[0] },
    { key: 'rationale', width: decisionColumnWidths[1] },
    { key: 'impact', width: decisionColumnWidths[2] },
    { key: 'decision_maker', width: decisionColumnWidths[3] },
    { key: 'outcome', width: decisionColumnWidths[4] },
    { key: 'project', width: decisionColumnWidths[5] },
    { key: 'created_at', width: decisionColumnWidths[6] },
    { key: 'source_meeting', width: decisionColumnWidths[7] },
  ];

  addReportHeader(decisionSheet, 'Key Decisions Log', data.projectName, data.generatedAt, data.decisions.length, 8);

  const decisionHeaders = ['Decision', 'Rationale', 'Impact', 'Decision Maker', 'Outcome', 'Project', 'Date Made', 'Source Meeting'];
  const decisionHeaderRow = decisionSheet.getRow(HEADER_ROW);
  decisionHeaders.forEach((header, index) => {
    decisionHeaderRow.getCell(index + 1).value = header;
  });
  styleColumnHeaders(decisionSheet, HEADER_ROW, 8);

  let decisionRowNum = DATA_START_ROW;
  data.decisions.forEach((item, index) => {
    const row = decisionSheet.getRow(decisionRowNum);

    row.getCell(1).value = item.title;
    row.getCell(2).value = item.rationale || '';
    row.getCell(3).value = item.impact || '';
    row.getCell(4).value = getDecisionMakerName(item);
    row.getCell(5).value = item.outcome || '';
    row.getCell(6).value = getProjectName(item);
    row.getCell(7).value = new Date(item.created_at);
    row.getCell(8).value = getMeetingTitle(item);

    const rowHeight = calculateRowHeight(
      [item.title, item.rationale, item.impact, null, item.outcome],
      decisionColumnWidths
    );
    row.height = rowHeight;

    // Style row (columns 4, 6, 7 are centered - decision maker, project, date)
    styleDataRow(row, index, 8, [4, 6, 7]);

    decisionRowNum++;
  });

  decisionSheet.getColumn(7).numFmt = 'mmm d, yyyy';

  addSummaryFooter(decisionSheet, data.decisions.length, 8,
    `Total Decisions: ${data.decisions.length}`);

  if (data.decisions.length > 0) {
    decisionSheet.autoFilter = {
      from: { row: HEADER_ROW, column: 1 },
      to: { row: HEADER_ROW + data.decisions.length, column: 8 },
    };
  }

  applyPrintSettings(decisionSheet, 'Key Decisions Log');

  // Generate buffer and convert to Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
