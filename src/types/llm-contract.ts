/**
 * LLM Output Contract - Canonical JSON Schema (pmo_tool.v1)
 * Based on 04_LLM_OUTPUT_CONTRACT_SCHEMA.md
 */

import { z } from 'zod';

// Schema version constant
export const SCHEMA_VERSION = 'pmo_tool.v1' as const;

// Attendee schema
const AttendeeSchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
});

// Evidence schema
const EvidenceSchema = z.object({
  quote: z.string(),
  speaker: z.string().nullable(),
  timestamp: z
    .string()
    .regex(/^\d{2}:\d{2}:\d{2}$/)
    .nullable(),
});

// Owner schema
const OwnerSchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
});

// Meeting schema
const MeetingSchema = z.object({
  category: z.enum([
    'Project',
    'Governance',
    'Discovery',
    'Alignment',
    'Remediation',
  ]),
  title: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendees: z.array(AttendeeSchema),
});

// Key Discussion Topic schema
const KeyTopicSchema = z.object({
  topic: z.string(),
  discussion: z.string(),
  participants: z.array(z.string()),
  outcome: z.string().nullable(),
});

// Action Item Summary schema (for recap display, tied to extracted items)
const ActionItemSummarySchema = z.object({
  title: z.string(),
  owner: z.string(),
  due_date: z.string().nullable(),
  status: z.enum(['Open', 'In Progress', 'Closed']),
});

// Outstanding Topic schema
const OutstandingTopicSchema = z.object({
  topic: z.string(),
  context: z.string(),
  blockers: z.array(z.string()),
  suggested_next_steps: z.array(z.string()),
});

// Recap schema
const RecapSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  key_topics: z.array(KeyTopicSchema),
  action_items_summary: z.array(ActionItemSummarySchema),
  outstanding_topics: z.array(OutstandingTopicSchema),
});

// Tone schema
const ParticipantToneSchema = z.object({
  name: z.string(),
  tone: z.string(),
  happiness: z.enum(['Low', 'Med', 'High']),
  buy_in: z.enum(['Low', 'Med', 'High']),
});

const ToneSchema = z.object({
  overall: z.string(),
  participants: z.array(ParticipantToneSchema),
});

// Action Item schema
const ActionItemSchema = z.object({
  operation: z.enum(['create', 'update', 'close']),
  external_id: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['Open', 'In Progress', 'Closed']),
  owner: OwnerSchema,
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  evidence: z.array(EvidenceSchema).min(1),
});

// Decision Category enum
const DecisionCategoryEnum = z.enum([
  'PROCESS_OP_MODEL',
  'TECHNOLOGY_SYSTEMS',
  'DATA_REPORTING',
  'PEOPLE_CHANGE_MGMT',
  'GOVERNANCE_COMPLIANCE',
  'STRATEGY_COMMERCIAL',
]);

// Decision Impact Area enum
const DecisionImpactAreaEnum = z.enum([
  'SCOPE',
  'COST_BUDGET',
  'TIME_SCHEDULE',
  'RISK',
  'CUSTOMER_EXP',
]);

// Decision Status enum
const DecisionStatusEnum = z.enum([
  'PROPOSED',
  'APPROVED',
  'REJECTED',
]);

// Decision schema
const DecisionSchema = z.object({
  operation: z.enum(['create', 'update']),
  external_id: z.string().nullable().optional(),
  title: z.string(),
  rationale: z.string(),
  impact: z.string(),
  category: DecisionCategoryEnum,
  impact_areas: z.array(DecisionImpactAreaEnum).min(1),
  status: DecisionStatusEnum,
  decision_maker: OwnerSchema,
  outcome: z.string(),
  evidence: z.array(EvidenceSchema).min(1),
});

// Risk schema
const RiskSchema = z.object({
  operation: z.enum(['create', 'update', 'close']),
  title: z.string(),
  description: z.string(),
  probability: z.enum(['Low', 'Med', 'High']),
  impact: z.enum(['Low', 'Med', 'High']),
  mitigation: z.string(),
  owner: OwnerSchema,
  status: z.enum(['Open', 'In Progress', 'Closed']),
  evidence: z.array(EvidenceSchema).min(1),
});

// Fishbone schema
const FishboneCategorySchema = z.object({
  name: z.string(),
  causes: z.array(z.string()),
});

const FishboneOutlineSchema = z.object({
  problem_statement: z.string(),
  categories: z.array(FishboneCategorySchema),
});

const FishboneRenderedSchema = z.object({
  format: z.literal('svg'),
  payload: z.string(),
});

const FishboneSchema = z.object({
  enabled: z.boolean(),
  outline: FishboneOutlineSchema.nullable().optional(),
  rendered: FishboneRenderedSchema.nullable().optional(),
});

// Complete LLM Output Contract
export const LLMOutputContractSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  meeting: MeetingSchema,
  recap: RecapSchema,
  tone: ToneSchema,
  action_items: z.array(ActionItemSchema),
  decisions: z.array(DecisionSchema),
  risks: z.array(RiskSchema),
  fishbone: FishboneSchema,
});

// Type inference
export type LLMOutputContract = z.infer<typeof LLMOutputContractSchema>;
export type LLMActionItem = z.infer<typeof ActionItemSchema>;
export type LLMDecision = z.infer<typeof DecisionSchema>;
export type LLMRisk = z.infer<typeof RiskSchema>;
export type LLMEvidence = z.infer<typeof EvidenceSchema>;
export type LLMOwner = z.infer<typeof OwnerSchema>;
export type LLMMeeting = z.infer<typeof MeetingSchema>;
export type LLMRecap = z.infer<typeof RecapSchema>;
export type LLMTone = z.infer<typeof ToneSchema>;
export type LLMFishbone = z.infer<typeof FishboneSchema>;
export type LLMKeyTopic = z.infer<typeof KeyTopicSchema>;
export type LLMActionItemSummary = z.infer<typeof ActionItemSummarySchema>;
export type LLMOutstandingTopic = z.infer<typeof OutstandingTopicSchema>;

// Validation function
export function validateLLMOutput(data: unknown): {
  success: boolean;
  data?: LLMOutputContract;
  errors?: z.ZodError;
} {
  const result = LLMOutputContractSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

// Fishbone validation (category-specific)
export function validateFishboneForCategory(
  fishbone: LLMFishbone,
  category: string
): { valid: boolean; message?: string } {
  if (category === 'Remediation') {
    if (!fishbone.enabled) {
      return {
        valid: false,
        message: 'Fishbone must be enabled for Remediation meetings',
      };
    }
    if (!fishbone.outline) {
      return {
        valid: false,
        message: 'Fishbone outline is required for Remediation meetings',
      };
    }
  } else {
    if (fishbone.enabled) {
      return {
        valid: false,
        message: 'Fishbone must be disabled for non-Remediation meetings',
      };
    }
  }
  return { valid: true };
}

