/**
 * Milestone Excel Template Generator
 * Creates a downloadable Excel template for bulk milestone management
 * - Pre-populates with existing milestones
 * - Includes data validation for status dropdown
 * - Includes instructions sheet
 */

import ExcelJS from 'exceljs';
import type { MilestoneWithPredecessor } from '@/types/database';
import { MilestoneStatus } from '@/types/enums';

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
  surface500: 'FF6B7280',
  surface700: 'FF374151',
  surface900: 'FF111827',
  white: 'FFFFFFFF',
};

export interface MilestoneTemplateData {
  projectId: string;
  projectName: string;
  milestones: MilestoneWithPredecessor[];
}

/**
 * Generate an Excel template for milestone bulk editing
 */
export async function generateMilestoneTemplate(
  data: MilestoneTemplateData
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMO Tool';
  workbook.created = new Date();

  // Create the main Milestones data sheet
  const dataSheet = workbook.addWorksheet('Milestones', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  // Define columns
  dataSheet.columns = [
    { header: 'ID', key: 'id', width: 38 },
    { header: 'Name *', key: 'name', width: 40 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Target Date', key: 'target_date', width: 15 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Predecessor ID', key: 'predecessor_id', width: 38 },
    { header: 'Predecessor Name', key: 'predecessor_name', width: 30 },
  ];

  // Style header row
  const headerRow = dataSheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = {
    bold: true,
    size: 11,
    color: { argb: COLORS.white },
  };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.primary },
  };
  headerRow.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };

  // Add borders to header
  for (let col = 1; col <= 7; col++) {
    const cell = headerRow.getCell(col);
    cell.border = {
      top: { style: 'medium', color: { argb: COLORS.primaryDark } },
      bottom: { style: 'medium', color: { argb: COLORS.primaryDark } },
      left: { style: 'thin', color: { argb: COLORS.primaryDark } },
      right: { style: 'thin', color: { argb: COLORS.primaryDark } },
    };
  }

  // Add column notes
  const idHeaderCell = dataSheet.getCell('A1');
  idHeaderCell.note = {
    texts: [
      { text: 'ID (Do Not Edit)\n', font: { bold: true } },
      { text: 'Leave blank for new milestones.\nDo not modify existing IDs.' },
    ],
    margins: { insetmode: 'auto' },
  };

  const predecessorIdCell = dataSheet.getCell('F1');
  predecessorIdCell.note = {
    texts: [
      { text: 'Predecessor ID\n', font: { bold: true } },
      { text: 'Copy an ID from column A to create a dependency.\nLeave blank if no dependency.' },
    ],
    margins: { insetmode: 'auto' },
  };

  // Add existing milestones
  const sortedMilestones = [...data.milestones].sort((a, b) => a.sort_order - b.sort_order);

  sortedMilestones.forEach((milestone, index) => {
    const rowNum = index + 2;
    const row = dataSheet.getRow(rowNum);

    row.values = {
      id: milestone.id,
      name: milestone.name,
      description: milestone.description || '',
      target_date: milestone.target_date || '',
      status: milestone.status,
      predecessor_id: milestone.predecessor_id || '',
      predecessor_name: milestone.predecessor?.name || '',
    };

    // Style data rows
    row.font = { size: 10 };
    row.alignment = { vertical: 'middle', wrapText: true };
    row.height = 22;

    // ID column is read-only styled
    const idCell = row.getCell(1);
    idCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.surface100 },
    };
    idCell.font = { size: 9, color: { argb: COLORS.surface500 } };

    // Predecessor name is read-only (for reference)
    const predecessorNameCell = row.getCell(7);
    predecessorNameCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.surface50 },
    };
    predecessorNameCell.font = { size: 9, color: { argb: COLORS.surface500 }, italic: true };

    // Add light borders
    for (let col = 1; col <= 7; col++) {
      row.getCell(col).border = {
        top: { style: 'thin', color: { argb: COLORS.surface200 } },
        bottom: { style: 'thin', color: { argb: COLORS.surface200 } },
        left: { style: 'thin', color: { argb: COLORS.surface200 } },
        right: { style: 'thin', color: { argb: COLORS.surface200 } },
      };
    }

    // Status cell styling based on value
    const statusCell = row.getCell(5);
    const statusColors = getStatusColors(milestone.status);
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: statusColors.bg },
    };
    statusCell.font = { size: 10, color: { argb: statusColors.text } };
  });

  // Add 20 empty rows for new milestones
  const emptyRowStart = data.milestones.length + 2;
  for (let i = 0; i < 20; i++) {
    const rowNum = emptyRowStart + i;
    const row = dataSheet.getRow(rowNum);

    row.values = {
      id: '',
      name: '',
      description: '',
      target_date: '',
      status: MilestoneStatus.NotStarted,
      predecessor_id: '',
      predecessor_name: '',
    };

    row.font = { size: 10 };
    row.alignment = { vertical: 'middle', wrapText: true };
    row.height = 22;

    // Alternating row colors for empty rows
    if (i % 2 === 0) {
      for (let col = 1; col <= 7; col++) {
        row.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.surface50 },
        };
      }
    }

    // Predecessor name is always read-only
    const predecessorNameCell = row.getCell(7);
    predecessorNameCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.surface100 },
    };
    predecessorNameCell.font = { size: 9, color: { argb: COLORS.surface500 }, italic: true };

    // Add light borders
    for (let col = 1; col <= 7; col++) {
      row.getCell(col).border = {
        top: { style: 'thin', color: { argb: COLORS.surface200 } },
        bottom: { style: 'thin', color: { argb: COLORS.surface200 } },
        left: { style: 'thin', color: { argb: COLORS.surface200 } },
        right: { style: 'thin', color: { argb: COLORS.surface200 } },
      };
    }
  }

  // Add data validation for Status column
  const statusValues = Object.values(MilestoneStatus);
  const statusValidation: ExcelJS.DataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: [`"${statusValues.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Invalid Status',
    error: `Please select a valid status: ${statusValues.join(', ')}`,
    showInputMessage: true,
    promptTitle: 'Status',
    prompt: 'Select a milestone status',
  };

  const lastDataRow = emptyRowStart + 19;
  for (let row = 2; row <= lastDataRow; row++) {
    dataSheet.getCell(`E${row}`).dataValidation = statusValidation;
  }

  // Add date format hint for target_date column
  const dateValidation: ExcelJS.DataValidation = {
    type: 'date',
    allowBlank: true,
    formulae: [new Date(1900, 0, 1), new Date(2100, 11, 31)],
    showInputMessage: true,
    promptTitle: 'Date Format',
    prompt: 'Enter date as YYYY-MM-DD or use date picker',
    showErrorMessage: false, // Allow various formats, parser will handle
  };

  for (let row = 2; row <= lastDataRow; row++) {
    const cell = dataSheet.getCell(`D${row}`);
    cell.dataValidation = dateValidation;
    cell.numFmt = 'yyyy-mm-dd';
  }

  // Create Instructions sheet
  const instructionsSheet = workbook.addWorksheet('Instructions');
  instructionsSheet.columns = [
    { header: '', key: 'col1', width: 80 },
  ];

  const instructions = [
    { text: 'Milestone Import Template - Instructions', style: 'title' },
    { text: '', style: 'normal' },
    { text: `Project: ${data.projectName}`, style: 'project' },
    { text: `Generated: ${new Date().toLocaleDateString()}`, style: 'date' },
    { text: '', style: 'normal' },
    { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', style: 'divider' },
    { text: '', style: 'normal' },
    { text: 'How to Use This Template:', style: 'heading' },
    { text: '', style: 'normal' },
    { text: '1. ADDING NEW MILESTONES', style: 'subheading' },
    { text: '   • Leave the ID column blank for new milestones', style: 'normal' },
    { text: '   • Fill in the Name (required) and other fields', style: 'normal' },
    { text: '   • New IDs will be generated automatically on import', style: 'normal' },
    { text: '', style: 'normal' },
    { text: '2. EDITING EXISTING MILESTONES', style: 'subheading' },
    { text: '   • DO NOT modify the ID column for existing milestones', style: 'normal' },
    { text: '   • Edit any other fields as needed', style: 'normal' },
    { text: '', style: 'normal' },
    { text: '3. DELETING MILESTONES', style: 'subheading' },
    { text: '   • To delete a milestone, remove the entire row', style: 'normal' },
    { text: '   • Or clear the Name field (milestones without names are ignored)', style: 'normal' },
    { text: '', style: 'normal' },
    { text: '4. SETTING DEPENDENCIES', style: 'subheading' },
    { text: '   • Copy an ID from the ID column into the Predecessor ID column', style: 'normal' },
    { text: '   • This creates a "Finish-to-Start" dependency', style: 'normal' },
    { text: '   • The predecessor must complete before this milestone starts', style: 'normal' },
    { text: '   • Warning: Circular dependencies will cause an error on import', style: 'normal' },
    { text: '', style: 'normal' },
    { text: '5. DATE FORMAT', style: 'subheading' },
    { text: '   • Use YYYY-MM-DD format (e.g., 2025-03-15)', style: 'normal' },
    { text: '   • Or use your spreadsheet\'s date picker', style: 'normal' },
    { text: '', style: 'normal' },
    { text: '6. STATUS VALUES', style: 'subheading' },
    { text: '   • Not Started (default)', style: 'normal' },
    { text: '   • In Progress', style: 'normal' },
    { text: '   • Behind Schedule', style: 'normal' },
    { text: '   • Complete', style: 'normal' },
    { text: '', style: 'normal' },
    { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', style: 'divider' },
    { text: '', style: 'normal' },
    { text: 'Column Reference:', style: 'heading' },
    { text: '', style: 'normal' },
    { text: 'ID                 - Unique identifier (do not edit for existing)', style: 'code' },
    { text: 'Name *             - Milestone name (REQUIRED)', style: 'code' },
    { text: 'Description        - Optional detailed description', style: 'code' },
    { text: 'Target Date        - Target completion date (YYYY-MM-DD)', style: 'code' },
    { text: 'Status             - Current status (dropdown)', style: 'code' },
    { text: 'Predecessor ID     - ID of milestone this depends on', style: 'code' },
    { text: 'Predecessor Name   - Read-only reference (auto-filled)', style: 'code' },
  ];

  instructions.forEach((item, index) => {
    const row = instructionsSheet.getRow(index + 1);
    row.getCell(1).value = item.text;

    switch (item.style) {
      case 'title':
        row.font = { bold: true, size: 16, color: { argb: COLORS.primary } };
        row.height = 28;
        break;
      case 'project':
        row.font = { bold: true, size: 12, color: { argb: COLORS.surface700 } };
        break;
      case 'date':
        row.font = { size: 10, color: { argb: COLORS.surface500 } };
        break;
      case 'heading':
        row.font = { bold: true, size: 12, color: { argb: COLORS.surface900 } };
        row.height = 22;
        break;
      case 'subheading':
        row.font = { bold: true, size: 11, color: { argb: COLORS.primary } };
        break;
      case 'code':
        row.font = { size: 10, name: 'Consolas' };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.surface50 },
        };
        break;
      case 'divider':
        row.font = { size: 10, color: { argb: COLORS.surface500 } };
        break;
      default:
        row.font = { size: 10 };
    }
  });

  // Create ID Reference sheet (for easy copy-paste of IDs)
  if (data.milestones.length > 0) {
    const referenceSheet = workbook.addWorksheet('ID Reference');
    referenceSheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Name', key: 'name', width: 50 },
      { header: 'Status', key: 'status', width: 16 },
    ];

    // Style header
    const refHeaderRow = referenceSheet.getRow(1);
    refHeaderRow.font = { bold: true, size: 11, color: { argb: COLORS.white } };
    refHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.surface700 },
    };
    refHeaderRow.height = 24;

    // Add milestone reference data
    sortedMilestones.forEach((milestone, index) => {
      const row = referenceSheet.getRow(index + 2);
      row.values = {
        id: milestone.id,
        name: milestone.name,
        status: milestone.status,
      };
      row.font = { size: 10 };
      row.height = 20;

      // Make ID copyable with mono font
      row.getCell(1).font = { size: 9, name: 'Consolas' };
    });
  }

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Get colors for milestone status
 */
function getStatusColors(status: string): { bg: string; text: string } {
  switch (status) {
    case MilestoneStatus.Complete:
      return { bg: COLORS.successLight, text: COLORS.success };
    case MilestoneStatus.InProgress:
      return { bg: COLORS.primaryLight, text: COLORS.primary };
    case MilestoneStatus.BehindSchedule:
      return { bg: COLORS.warningLight, text: COLORS.warning };
    case MilestoneStatus.NotStarted:
    default:
      return { bg: COLORS.surface100, text: COLORS.surface700 };
  }
}
