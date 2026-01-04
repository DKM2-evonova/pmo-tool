import { z } from 'zod';

/**
 * Common Zod schemas for API validation
 */

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Optional UUID (can be null or empty string)
export const optionalUuidSchema = z
  .string()
  .optional()
  .nullable()
  .transform((val) => (val === '' ? null : val))
  .pipe(z.string().uuid().nullable().optional());

// Date string validation (YYYY-MM-DD)
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// Optional date string
export const optionalDateStringSchema = z
  .string()
  .optional()
  .nullable()
  .transform((val) => (val === '' ? null : val))
  .pipe(dateStringSchema.nullable().optional());

// Non-empty string
export const nonEmptyStringSchema = z.string().min(1, 'This field is required');

// Email validation
export const emailSchema = z.string().email('Invalid email address');

// Entity status enum
export const entityStatusSchema = z.enum(['Open', 'In Progress', 'Closed']);

// Risk severity enum
export const riskSeveritySchema = z.enum(['Low', 'Med', 'High']);

// Decision category enum
export const decisionCategorySchema = z.enum([
  'PROCESS_OP_MODEL',
  'TECHNOLOGY_SYSTEMS',
  'DATA_REPORTING',
  'PEOPLE_CHANGE_MGMT',
  'GOVERNANCE_COMPLIANCE',
  'STRATEGY_COMMERCIAL',
]);

// Decision impact areas
export const decisionImpactAreaSchema = z.enum([
  'SCOPE',
  'COST_BUDGET',
  'TIME_SCHEDULE',
  'RISK',
  'CUSTOMER_EXP',
]);

// Decision status enum
export const decisionStatusSchema = z.enum([
  'PROPOSED',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
]);

// Meeting category enum
export const meetingCategorySchema = z.enum([
  'Status',
  'Planning',
  'Review',
  'Discovery',
  'Decision',
  'Stakeholder',
]);

/**
 * Helper to validate and parse request data with Zod schema
 * Returns either the parsed data or an error response
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError['errors'] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error.errors };
}

/**
 * Format Zod errors into a user-friendly object
 */
export function formatZodErrors(errors: z.ZodError['errors']): Record<string, string> {
  const formatted: Record<string, string> = {};

  for (const error of errors) {
    const path = error.path.join('.');
    formatted[path || 'root'] = error.message;
  }

  return formatted;
}
