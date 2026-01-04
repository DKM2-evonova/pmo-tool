import { z } from 'zod';
import {
  uuidSchema,
  optionalUuidSchema,
  entityStatusSchema,
  riskSeveritySchema,
  nonEmptyStringSchema,
} from './common';

/**
 * Schema for updating a risk
 */
export const updateRiskSchema = z
  .object({
    // For adding a status update
    content: z.string().min(1).optional(),

    // For updating risk fields
    title: nonEmptyStringSchema.optional(),
    description: z.string().optional().nullable(),
    probability: riskSeveritySchema.optional(),
    impact: riskSeveritySchema.optional(),
    mitigation: z.string().optional().nullable(),
    status: entityStatusSchema.optional(),
    owner_user_id: optionalUuidSchema,
  })
  .refine(
    (data) => {
      const hasContent = !!data.content;
      const hasFields =
        data.title !== undefined ||
        data.description !== undefined ||
        data.probability !== undefined ||
        data.impact !== undefined ||
        data.mitigation !== undefined ||
        data.status !== undefined ||
        data.owner_user_id !== undefined;

      return hasContent || hasFields;
    },
    {
      message: 'Request must include either content for a status update or fields to update',
    }
  );

export type UpdateRiskInput = z.infer<typeof updateRiskSchema>;

/**
 * Schema for creating a risk
 */
export const createRiskSchema = z.object({
  project_id: uuidSchema,
  title: nonEmptyStringSchema,
  description: z.string().optional().nullable(),
  probability: riskSeveritySchema.default('Med'),
  impact: riskSeveritySchema.default('Med'),
  mitigation: z.string().optional().nullable(),
  status: entityStatusSchema.default('Open'),
  owner_user_id: optionalUuidSchema,
});

export type CreateRiskInput = z.infer<typeof createRiskSchema>;
