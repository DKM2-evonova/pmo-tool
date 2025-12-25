/**
 * Milestone Excel Parser
 * Parses uploaded Excel files containing milestone data
 * Validates structure and returns structured data for import
 */

import ExcelJS from 'exceljs';
import { MilestoneStatus } from '@/types/enums';

export interface ParsedMilestone {
  id: string | null; // null = new milestone
  name: string;
  description: string | null;
  target_date: string | null;
  status: string;
  predecessor_id: string | null;
  row_number: number; // For error reporting
}

export interface ParseError {
  row: number;
  column: string;
  message: string;
  value?: string;
}

export interface ParseWarning {
  row: number;
  column: string;
  message: string;
}

export interface ParseResult {
  success: boolean;
  milestones: ParsedMilestone[];
  errors: ParseError[];
  warnings: ParseWarning[];
  stats: {
    totalRows: number;
    validRows: number;
    newMilestones: number;
    existingMilestones: number;
    skippedRows: number;
  };
}

// Valid status values
const VALID_STATUSES = Object.values(MilestoneStatus);

// UUID regex pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse an Excel file buffer containing milestone data
 */
export async function parseMilestoneExcel(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Find the Milestones sheet
  const sheet = workbook.getWorksheet('Milestones');
  if (!sheet) {
    return {
      success: false,
      milestones: [],
      errors: [
        {
          row: 0,
          column: 'Sheet',
          message: 'Sheet named "Milestones" not found. Please use the template provided.',
        },
      ],
      warnings: [],
      stats: { totalRows: 0, validRows: 0, newMilestones: 0, existingMilestones: 0, skippedRows: 0 },
    };
  }

  const milestones: ParsedMilestone[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  let totalRows = 0;
  let skippedRows = 0;

  // Get column indices from header row
  const headerRow = sheet.getRow(1);
  const columnMap = getColumnMapping(headerRow);

  if (!columnMap.name) {
    return {
      success: false,
      milestones: [],
      errors: [
        {
          row: 1,
          column: 'Header',
          message: 'Required column "Name" not found in header row.',
        },
      ],
      warnings: [],
      stats: { totalRows: 0, validRows: 0, newMilestones: 0, existingMilestones: 0, skippedRows: 0 },
    };
  }

  // Process each data row (starting from row 2)
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    totalRows++;

    // Get cell values
    const idValue = getCellValue(row, columnMap.id);
    const nameValue = getCellValue(row, columnMap.name);
    const descriptionValue = getCellValue(row, columnMap.description);
    const targetDateValue = getCellValue(row, columnMap.target_date);
    const statusValue = getCellValue(row, columnMap.status);
    const predecessorIdValue = getCellValue(row, columnMap.predecessor_id);

    // Skip empty rows (no name)
    if (!nameValue || nameValue.trim() === '') {
      skippedRows++;
      return;
    }

    const rowErrors: ParseError[] = [];
    const rowWarnings: ParseWarning[] = [];

    // Validate ID if present
    let id: string | null = null;
    if (idValue && idValue.trim() !== '') {
      const trimmedId = idValue.trim();
      if (UUID_PATTERN.test(trimmedId)) {
        id = trimmedId.toLowerCase();
      } else {
        // Non-UUID IDs (like "1", "2", etc.) are treated as new milestones
        // Add a warning but don't fail - user likely wants to create new milestone
        rowWarnings.push({
          row: rowNumber,
          column: 'ID',
          message: `ID "${trimmedId}" is not a valid UUID. This will be treated as a new milestone.`,
        });
        id = null; // Treat as new milestone
      }
    }

    // Validate and parse name
    const name = nameValue.trim();
    if (name.length > 500) {
      rowWarnings.push({
        row: rowNumber,
        column: 'Name',
        message: 'Name is very long and will be truncated to 500 characters.',
      });
    }

    // Parse description
    const description = descriptionValue?.trim() || null;

    // Parse and validate target date
    let target_date: string | null = null;
    if (targetDateValue && targetDateValue.trim() !== '') {
      const parsed = parseDate(targetDateValue);
      if (parsed) {
        target_date = parsed;
      } else {
        rowWarnings.push({
          row: rowNumber,
          column: 'Target Date',
          message: `Could not parse date "${targetDateValue}". Date will be ignored.`,
        });
      }
    }

    // Validate status
    let status: string = MilestoneStatus.NotStarted;
    if (statusValue && statusValue.trim() !== '') {
      const normalizedStatus = normalizeStatus(statusValue.trim());
      if (VALID_STATUSES.includes(normalizedStatus as typeof VALID_STATUSES[number])) {
        status = normalizedStatus;
      } else {
        rowErrors.push({
          row: rowNumber,
          column: 'Status',
          message: `Invalid status "${statusValue}". Valid values: ${VALID_STATUSES.join(', ')}`,
          value: statusValue,
        });
      }
    }

    // Validate predecessor ID if present
    let predecessor_id: string | null = null;
    if (predecessorIdValue && predecessorIdValue.trim() !== '') {
      const trimmedPredecessorId = predecessorIdValue.trim();
      if (UUID_PATTERN.test(trimmedPredecessorId)) {
        predecessor_id = trimmedPredecessorId.toLowerCase();
      } else {
        rowErrors.push({
          row: rowNumber,
          column: 'Predecessor ID',
          message: 'Invalid predecessor ID format. Must be a valid UUID or left blank.',
          value: trimmedPredecessorId,
        });
      }
    }

    errors.push(...rowErrors);
    warnings.push(...rowWarnings);

    // Only add milestone if no critical errors
    if (rowErrors.length === 0) {
      milestones.push({
        id,
        name: name.substring(0, 500),
        description: description?.substring(0, 2000) || null,
        target_date,
        status,
        predecessor_id,
        row_number: rowNumber,
      });
    }
  });

  const newMilestones = milestones.filter((m) => m.id === null).length;
  const existingMilestones = milestones.filter((m) => m.id !== null).length;

  return {
    success: errors.length === 0,
    milestones,
    errors,
    warnings,
    stats: {
      totalRows,
      validRows: milestones.length,
      newMilestones,
      existingMilestones,
      skippedRows,
    },
  };
}

/**
 * Get column index mapping from header row
 */
function getColumnMapping(
  headerRow: ExcelJS.Row
): Record<string, number | undefined> {
  const mapping: Record<string, number | undefined> = {};

  headerRow.eachCell((cell, colNumber) => {
    const value = String(cell.value || '').toLowerCase().trim();

    // Map various header names to our expected fields
    if (value.includes('id') && !value.includes('predecessor')) {
      mapping.id = colNumber;
    } else if (value.includes('name') && !value.includes('predecessor')) {
      mapping.name = colNumber;
    } else if (value.includes('description') || value.includes('desc')) {
      mapping.description = colNumber;
    } else if (value.includes('date') || value.includes('target')) {
      mapping.target_date = colNumber;
    } else if (value.includes('status')) {
      mapping.status = colNumber;
    } else if (value.includes('predecessor')) {
      if (value.includes('id')) {
        mapping.predecessor_id = colNumber;
      }
    }
  });

  return mapping;
}

/**
 * Get cell value as string
 */
function getCellValue(row: ExcelJS.Row, colNumber?: number): string {
  if (!colNumber) return '';

  const cell = row.getCell(colNumber);
  if (!cell || cell.value === null || cell.value === undefined) {
    return '';
  }

  // Handle different cell value types
  const value = cell.value;

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value instanceof Date) {
    return formatDateToISO(value);
  }

  // Handle rich text
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: Array<{ text: string }> }).richText
      .map((rt) => rt.text)
      .join('');
  }

  // Handle formula results
  if (typeof value === 'object' && 'result' in value) {
    const result = (value as { result: unknown }).result;
    if (result instanceof Date) {
      return formatDateToISO(result);
    }
    return String(result ?? '');
  }

  // Handle hyperlinks
  if (typeof value === 'object' && 'text' in value) {
    return String((value as { text: unknown }).text);
  }

  return String(value);
}

/**
 * Parse date from various formats
 */
function parseDate(value: string): string | null {
  const trimmed = value.trim();

  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return trimmed;
    }
  }

  // Try common date formats
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return formatDateToISO(date);
  }

  // Try MM/DD/YYYY format
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return formatDateToISO(date);
    }
  }

  // Try DD/MM/YYYY format
  const euMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return formatDateToISO(date);
    }
  }

  return null;
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalize status value to match enum
 */
function normalizeStatus(value: string): string {
  const lower = value.toLowerCase().trim();

  // Map common variations
  if (lower === 'not started' || lower === 'notstarted' || lower === 'new') {
    return MilestoneStatus.NotStarted;
  }
  if (lower === 'in progress' || lower === 'inprogress' || lower === 'active' || lower === 'started') {
    return MilestoneStatus.InProgress;
  }
  if (lower === 'behind schedule' || lower === 'behindschedule' || lower === 'behind' || lower === 'delayed' || lower === 'late') {
    return MilestoneStatus.BehindSchedule;
  }
  if (lower === 'complete' || lower === 'completed' || lower === 'done' || lower === 'finished') {
    return MilestoneStatus.Complete;
  }

  // Return original value if no match (will fail validation)
  return value;
}

/**
 * Validate parsed milestones for import readiness
 * Checks cross-references between milestones (predecessor validation)
 */
export function validateParsedMilestones(
  milestones: ParsedMilestone[],
  existingIds: string[] = []
): { valid: boolean; errors: ParseError[] } {
  const errors: ParseError[] = [];

  // Build set of all available IDs (existing + new with IDs)
  const allIds = new Set([
    ...existingIds,
    ...milestones.filter((m) => m.id).map((m) => m.id!),
  ]);

  // Check predecessor references
  for (const milestone of milestones) {
    if (milestone.predecessor_id) {
      // Check if predecessor ID exists
      if (!allIds.has(milestone.predecessor_id)) {
        errors.push({
          row: milestone.row_number,
          column: 'Predecessor ID',
          message: `Predecessor ID "${milestone.predecessor_id}" does not match any milestone in this import or existing milestones.`,
          value: milestone.predecessor_id,
        });
      }

      // Check for self-reference
      if (milestone.id && milestone.predecessor_id === milestone.id) {
        errors.push({
          row: milestone.row_number,
          column: 'Predecessor ID',
          message: 'A milestone cannot depend on itself.',
          value: milestone.predecessor_id,
        });
      }
    }
  }

  // Note: Circular dependency detection is handled by the database trigger
  // for complex cases. Simple cases are caught here.

  return {
    valid: errors.length === 0,
    errors,
  };
}
