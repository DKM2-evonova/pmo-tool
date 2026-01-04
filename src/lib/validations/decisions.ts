import { z } from 'zod';
import {
  uuidSchema,
  optionalUuidSchema,
  optionalDateStringSchema,
  decisionCategorySchema,
  decisionImpactAreaSchema,
  decisionStatusSchema,
  nonEmptyStringSchema,
} from './common';

/**
 * Schema for updating a decision
 */
export const updateDecisionSchema = z.object({
  title: nonEmptyStringSchema.optional(),
  rationale: z.string().optional().nullable(),
  impact: z.string().optional().nullable(),
  category: decisionCategorySchema.optional(),
  impact_areas: z.array(decisionImpactAreaSchema).min(1).optional(),
  status: decisionStatusSchema
    .refine((val) => val !== 'SUPERSEDED', {
      message: 'Use the /supersede endpoint to mark a decision as superseded',
    })
    .optional(),
  decision_maker_user_id: optionalUuidSchema,
  decision_maker_name: z.string().optional().nullable(),
  decision_maker_email: z.string().email().optional().nullable(),
  outcome: z.string().optional().nullable(),
  decision_date: optionalDateStringSchema,
});

export type UpdateDecisionInput = z.infer<typeof updateDecisionSchema>;

/**
 * Schema for creating a decision
 */
export const createDecisionSchema = z.object({
  project_id: uuidSchema,
  title: nonEmptyStringSchema,
  rationale: z.string().optional().nullable(),
  impact: z.string().optional().nullable(),
  category: decisionCategorySchema,
  impact_areas: z.array(decisionImpactAreaSchema).min(1),
  status: decisionStatusSchema.default('PROPOSED'),
  decision_maker_user_id: optionalUuidSchema,
  decision_maker_name: z.string().optional().nullable(),
  decision_maker_email: z.string().email().optional().nullable(),
  outcome: z.string().optional().nullable(),
  decision_date: optionalDateStringSchema,
});

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;

/**
 * Schema for superseding a decision
 */
export const supersedeDecisionSchema = z.object({
  new_decision_id: uuidSchema,
  reason: z.string().optional(),
});

export type SupersedeDecisionInput = z.infer<typeof supersedeDecisionSchema>;
