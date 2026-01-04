import { z } from 'zod';
import {
  uuidSchema,
  optionalUuidSchema,
  optionalDateStringSchema,
  entityStatusSchema,
  nonEmptyStringSchema,
} from './common';

/**
 * Schema for updating an action item
 */
export const updateActionItemSchema = z
  .object({
    // For adding a status update
    content: z.string().min(1).optional(),

    // For updating action item fields
    title: nonEmptyStringSchema.optional(),
    description: z.string().optional().nullable(),
    status: entityStatusSchema.optional(),
    owner_user_id: optionalUuidSchema,
    due_date: optionalDateStringSchema,
  })
  .refine(
    (data) => {
      // Must have either content (for status update) or at least one field to update
      const hasContent = !!data.content;
      const hasFields =
        data.title !== undefined ||
        data.description !== undefined ||
        data.status !== undefined ||
        data.owner_user_id !== undefined ||
        data.due_date !== undefined;

      return hasContent || hasFields;
    },
    {
      message: 'Request must include either content for a status update or fields to update',
    }
  );

export type UpdateActionItemInput = z.infer<typeof updateActionItemSchema>;

/**
 * Schema for creating an action item
 */
export const createActionItemSchema = z.object({
  project_id: uuidSchema,
  title: nonEmptyStringSchema,
  description: z.string().optional().nullable(),
  status: entityStatusSchema.default('Open'),
  owner_user_id: optionalUuidSchema,
  due_date: optionalDateStringSchema,
});

export type CreateActionItemInput = z.infer<typeof createActionItemSchema>;
