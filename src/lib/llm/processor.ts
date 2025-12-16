/**
 * Meeting Processor - Orchestrates LLM processing pipeline
 */

import { getLLMClient } from './client';
import { buildProcessingPrompt } from './prompts';
import { resolveOwner, type ResolvedOwner } from './owner-resolution';
import {
  validateLLMOutput,
  validateFishboneForCategory,
  type LLMOutputContract,
} from '@/types/llm-contract';
import type {
  Meeting,
  ActionItem,
  Decision,
  Risk,
  Profile,
  ProjectContact,
  ProposedActionItem,
  ProposedDecision,
  ProposedRisk,
  ProposedItems,
} from '@/types/database';
import type { MeetingCategory } from '@/types/enums';
import { generateId } from '@/lib/utils';
import { loggers } from '@/lib/logger';

const log = loggers.llm;

/**
 * Raw LLM output structure before validation
 * This is a partial type for the cleanup process
 */
interface RawLLMOutput {
  meeting?: {
    date?: string;
    [key: string]: unknown;
  };
  action_items?: Array<{
    status?: string;
    due_date?: string;
    evidence?: Array<{ timestamp?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  }>;
  recap?: {
    action_items_summary?: Array<{
      status?: string;
      due_date?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  decisions?: Array<{
    evidence?: Array<{ timestamp?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  }>;
  risks?: Array<{
    status?: string;
    probability?: string;
    impact?: string;
    evidence?: Array<{ timestamp?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  }>;
  tone?: {
    participants?: Array<{
      happiness?: string;
      buy_in?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Clean up common LLM output issues before validation
 * This handles issues that LLMs commonly produce that don't match our schema
 */
function cleanupLLMOutput(data: unknown): RawLLMOutput | unknown {
  if (!data || typeof data !== 'object') return data;

  // Deep clone to avoid mutating original
  const cleaned = JSON.parse(JSON.stringify(data));

  // Fix date formats (convert various formats to YYYY-MM-DD)
  const fixDate = (dateStr: string | null | undefined): string | null => {
    if (!dateStr) return null;
    // Already in correct format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Try to parse and reformat
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Fall through
    }
    return null; // Invalid date, set to null
  };

  // Fix timestamp formats (convert to HH:MM:SS or null)
  const fixTimestamp = (ts: string | null | undefined): string | null => {
    if (!ts) return null;
    if (/^\d{2}:\d{2}:\d{2}$/.test(ts)) return ts;
    // Try to extract time from various formats
    const match = ts.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const h = match[1].padStart(2, '0');
      const m = match[2];
      const s = match[3] || '00';
      return `${h}:${m}:${s}`;
    }
    return null;
  };

  // Fix enum values (normalize casing)
  const fixStatus = (status: string): string => {
    const normalized = status?.toLowerCase();
    if (normalized === 'open') return 'Open';
    if (normalized === 'in progress' || normalized === 'in_progress' || normalized === 'inprogress')
      return 'In Progress';
    if (normalized === 'closed') return 'Closed';
    return status;
  };

  const fixLevel = (level: string): string => {
    const normalized = level?.toLowerCase();
    if (normalized === 'low') return 'Low';
    if (normalized === 'med' || normalized === 'medium') return 'Med';
    if (normalized === 'high') return 'High';
    return level;
  };

  // Fix meeting date
  if (cleaned.meeting?.date) {
    cleaned.meeting.date = fixDate(cleaned.meeting.date) || cleaned.meeting.date;
  }

  // Fix action items
  if (Array.isArray(cleaned.action_items)) {
    cleaned.action_items = cleaned.action_items.map((ai: any) => ({
      ...ai,
      status: fixStatus(ai.status),
      due_date: fixDate(ai.due_date),
      evidence: Array.isArray(ai.evidence)
        ? ai.evidence.map((e: any) => ({
            ...e,
            timestamp: fixTimestamp(e.timestamp),
          }))
        : ai.evidence,
    }));
  }

  // Fix action items summary in recap
  if (Array.isArray(cleaned.recap?.action_items_summary)) {
    cleaned.recap.action_items_summary = cleaned.recap.action_items_summary.map((ai: any) => ({
      ...ai,
      status: fixStatus(ai.status),
      due_date: fixDate(ai.due_date),
    }));
  }

  // Fix decisions
  if (Array.isArray(cleaned.decisions)) {
    cleaned.decisions = cleaned.decisions.map((d: any) => ({
      ...d,
      evidence: Array.isArray(d.evidence)
        ? d.evidence.map((e: any) => ({
            ...e,
            timestamp: fixTimestamp(e.timestamp),
          }))
        : d.evidence,
    }));
  }

  // Fix risks
  if (Array.isArray(cleaned.risks)) {
    cleaned.risks = cleaned.risks.map((r: any) => ({
      ...r,
      status: fixStatus(r.status),
      probability: fixLevel(r.probability),
      impact: fixLevel(r.impact),
      evidence: Array.isArray(r.evidence)
        ? r.evidence.map((e: any) => ({
            ...e,
            timestamp: fixTimestamp(e.timestamp),
          }))
        : r.evidence,
    }));
  }

  // Fix tone participant levels
  if (Array.isArray(cleaned.tone?.participants)) {
    cleaned.tone.participants = cleaned.tone.participants.map((p: any) => ({
      ...p,
      happiness: fixLevel(p.happiness),
      buy_in: fixLevel(p.buy_in),
    }));
  }

  return cleaned;
}

export interface ProcessingResult {
  success: boolean;
  output?: LLMOutputContract;
  proposedItems?: ProposedItems;
  error?: string;
  model: string;
  isFallback: boolean;
  latencyMs: number;
}

interface ProcessingContext {
  meeting: Meeting;
  projectMembers: Profile[];
  projectContacts: ProjectContact[];
  openActionItems: ActionItem[];
  openDecisions: Decision[];
  openRisks: Risk[];
}

/**
 * Process a meeting transcript and extract structured data
 */
export async function processMeeting(
  context: ProcessingContext
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const llm = getLLMClient();
  const { meeting, projectMembers, projectContacts, openActionItems, openDecisions, openRisks } =
    context;

  log.info('Starting meeting processing', {
    meetingId: meeting.id,
    category: meeting.category,
    transcriptLength: meeting.transcript_text?.length || 0,
    projectMemberCount: projectMembers.length,
    projectContactCount: projectContacts.length,
    openActionItemCount: openActionItems.length,
    openDecisionCount: openDecisions.length,
    openRiskCount: openRisks.length,
  });

  if (!meeting.transcript_text || !meeting.category) {
    log.warn('Meeting processing aborted - missing required data', {
      meetingId: meeting.id,
      hasTranscript: !!meeting.transcript_text,
      hasCategory: !!meeting.category,
    });
    return {
      success: false,
      error: 'Missing transcript or category',
      model: 'none',
      isFallback: false,
      latencyMs: 0,
    };
  }

  const prompt = buildProcessingPrompt({
    category: meeting.category as MeetingCategory,
    transcript: meeting.transcript_text,
    attendees: (meeting.attendees as any[]) || [],
    openActionItems,
    openDecisions,
    openRisks,
  });

  log.debug('Built processing prompt', {
    meetingId: meeting.id,
    promptLength: prompt.length,
  });

  try {
    // Generate with primary model (fallback handled internally)
    const response = await llm.generateJSON<LLMOutputContract>(prompt);

    // Apply programmatic cleanup before validation
    const cleanedData = cleanupLLMOutput(response.data);
    log.debug('Applied programmatic cleanup to LLM output', {
      meetingId: meeting.id,
    });

    // Validate the cleaned output
    const validation = validateLLMOutput(cleanedData);

    if (!validation.success) {
      // Log validation issues for debugging
      log.warn('LLM output validation failed after cleanup, attempting repair', {
        meetingId: meeting.id,
        issueCount: validation.errors?.issues.length || 0,
        issues: validation.errors?.issues.slice(0, 5).map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });

      // Format validation errors with paths for the repair prompt
      const errorDetails = validation.errors?.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        expected: i.code,
      }));
      const repairResponse = await llm.repairJSON(
        JSON.stringify(cleanedData), // Pass the already-cleaned data
        JSON.stringify(errorDetails, null, 2)
      );

      try {
        const repairedData = JSON.parse(repairResponse.content);
        // Apply cleanup to repaired data as well
        const cleanedRepairedData = cleanupLLMOutput(repairedData);
        const revalidation = validateLLMOutput(cleanedRepairedData);

        if (!revalidation.success) {
          log.error('JSON repair failed - validation still failing', {
            meetingId: meeting.id,
            issues: revalidation.errors?.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          });
          return {
            success: false,
            error: `JSON validation failed after repair: ${revalidation.errors?.issues.map((i) => i.message).join(', ')}`,
            model: response.model,
            isFallback: response.isFallback,
            latencyMs: response.latencyMs,
          };
        }

        log.info('JSON repair successful', { meetingId: meeting.id });
        // Update validation to use the repaired and validated data
        validation.data = revalidation.data;
      } catch (parseError) {
        log.error('JSON repair parsing failed', {
          meetingId: meeting.id,
          error: parseError instanceof Error ? parseError.message : 'Unknown error',
        });
        return {
          success: false,
          error: 'Failed to repair invalid JSON output',
          model: response.model,
          isFallback: response.isFallback,
          latencyMs: response.latencyMs,
        };
      }
    }

    // Use validated data from here on (either from initial validation or repair)
    const validatedData = validation.data!;

    // Validate fishbone for category
    const fishboneValidation = validateFishboneForCategory(
      validatedData.fishbone,
      meeting.category
    );
    if (!fishboneValidation.valid) {
      log.error('Fishbone validation failed', {
        meetingId: meeting.id,
        category: meeting.category,
        message: fishboneValidation.message,
      });
      return {
        success: false,
        error: fishboneValidation.message,
        model: response.model,
        isFallback: response.isFallback,
        latencyMs: response.latencyMs,
      };
    }

    // Transform to proposed items with owner resolution
    const proposedItems = transformToProposedItems(
      validatedData,
      projectMembers,
      projectContacts,
      (meeting.attendees as any[]) || []
    );

    const totalLatencyMs = Date.now() - startTime;
    log.info('Meeting processing completed successfully', {
      meetingId: meeting.id,
      model: response.model,
      isFallback: response.isFallback,
      llmLatencyMs: response.latencyMs,
      totalLatencyMs,
      extractedItems: {
        actionItems: proposedItems.action_items.length,
        decisions: proposedItems.decisions.length,
        risks: proposedItems.risks.length,
      },
    });

    return {
      success: true,
      output: validatedData,
      proposedItems,
      model: response.model,
      isFallback: response.isFallback,
      latencyMs: response.latencyMs,
    };
  } catch (error) {
    const totalLatencyMs = Date.now() - startTime;
    log.error('Meeting processing failed', {
      meetingId: meeting.id,
      totalLatencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      model: 'unknown',
      isFallback: false,
      latencyMs: 0,
    };
  }
}

/**
 * Transform LLM output to proposed items with owner resolution
 */
function transformToProposedItems(
  output: LLMOutputContract,
  projectMembers: Profile[],
  projectContacts: ProjectContact[],
  attendees: any[]
): ProposedItems {
  const resolutionContext = { projectMembers, projectContacts, attendees };

  // Transform action items
  const actionItems: ProposedActionItem[] = output.action_items.map((ai) => {
    const resolved = resolveOwner(ai.owner, resolutionContext);
    return {
      temp_id: generateId(),
      operation: ai.operation,
      external_id: ai.external_id,
      title: ai.title,
      description: ai.description,
      status: ai.status as any,
      owner: {
        name: resolved.name,
        email: resolved.email,
        resolved_user_id: resolved.resolvedUserId,
        resolved_contact_id: resolved.resolvedContactId,
      },
      owner_resolution_status: resolved.resolutionStatus,
      due_date: ai.due_date,
      evidence: ai.evidence,
      accepted: true,
      duplicate_of: null,
      similarity_score: null,
    };
  });

  // Transform decisions
  const decisions: ProposedDecision[] = output.decisions.map((d) => {
    const resolved = resolveOwner(d.decision_maker, resolutionContext);
    return {
      temp_id: generateId(),
      operation: d.operation,
      title: d.title,
      rationale: d.rationale,
      impact: d.impact,
      decision_maker: {
        name: resolved.name,
        email: resolved.email,
        resolved_user_id: resolved.resolvedUserId,
        resolved_contact_id: resolved.resolvedContactId,
      },
      decision_maker_resolution_status: resolved.resolutionStatus,
      outcome: d.outcome,
      evidence: d.evidence,
      accepted: true,
      duplicate_of: null,
      similarity_score: null,
    };
  });

  // Transform risks
  const risks: ProposedRisk[] = output.risks.map((r) => {
    const resolved = resolveOwner(r.owner, resolutionContext);
    return {
      temp_id: generateId(),
      operation: r.operation,
      external_id: null,
      title: r.title,
      description: r.description,
      probability: r.probability as any,
      impact: r.impact as any,
      mitigation: r.mitigation,
      owner: {
        name: resolved.name,
        email: resolved.email,
        resolved_user_id: resolved.resolvedUserId,
        resolved_contact_id: resolved.resolvedContactId,
      },
      owner_resolution_status: resolved.resolutionStatus,
      status: r.status as any,
      evidence: r.evidence,
      accepted: true,
      duplicate_of: null,
      similarity_score: null,
    };
  });

  return { action_items: actionItems, decisions, risks };
}

