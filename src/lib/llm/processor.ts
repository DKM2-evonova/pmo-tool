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
  ProposedActionItem,
  ProposedDecision,
  ProposedRisk,
  ProposedItems,
} from '@/types/database';
import type { MeetingCategory } from '@/types/enums';
import { generateId } from '@/lib/utils';
import { loggers } from '@/lib/logger';

const log = loggers.llm;

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
  const { meeting, projectMembers, openActionItems, openDecisions, openRisks } =
    context;

  log.info('Starting meeting processing', {
    meetingId: meeting.id,
    category: meeting.category,
    transcriptLength: meeting.transcript_text?.length || 0,
    projectMemberCount: projectMembers.length,
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

    // Validate the output
    const validation = validateLLMOutput(response.data);

    if (!validation.success) {
      // Try to repair with utility model
      log.warn('LLM output validation failed, attempting repair', {
        meetingId: meeting.id,
        issueCount: validation.errors?.issues.length || 0,
        issues: validation.errors?.issues.slice(0, 5).map((i) => i.message),
      });
      
      const schemaStr = JSON.stringify(validation.errors?.issues);
      const repairResponse = await llm.repairJSON(
        JSON.stringify(response.data),
        schemaStr
      );

      try {
        const repairedData = JSON.parse(repairResponse.content);
        const revalidation = validateLLMOutput(repairedData);

        if (!revalidation.success) {
          log.error('JSON repair failed - validation still failing', {
            meetingId: meeting.id,
            issues: revalidation.errors?.issues.map((i) => i.message),
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
        response.data = revalidation.data!;
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

    // Validate fishbone for category
    const fishboneValidation = validateFishboneForCategory(
      response.data.fishbone,
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
      response.data,
      projectMembers,
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
      output: response.data,
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
  attendees: any[]
): ProposedItems {
  const resolutionContext = { projectMembers, attendees };

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

