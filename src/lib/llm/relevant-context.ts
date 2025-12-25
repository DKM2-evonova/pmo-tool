/**
 * Relevant Context Filter for LLM Prompts
 * 
 * Filters open items to only include those semantically relevant to the transcript,
 * reducing token usage and improving LLM focus.
 */

import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/embeddings/client';
import type { ActionItem, Decision, Risk } from '@/types/database';
import { loggers } from '@/lib/logger';

const log = loggers.llm;

// Configuration
const MAX_CONTEXT_ITEMS = 25; // Maximum items to include in context
const SIMILARITY_THRESHOLD = 0.3; // Lower threshold for relevance (we want broader matches)
const RECENT_DAYS = 14; // Include items updated within this many days regardless of similarity
const TRANSCRIPT_SAMPLE_LENGTH = 8000; // Sample first N chars for embedding (cost optimization)

export interface RelevantContextResult {
  actionItems: ActionItem[];
  decisions: Decision[];
  risks: Risk[];
  stats: {
    totalOpen: { actionItems: number; decisions: number; risks: number };
    included: { actionItems: number; decisions: number; risks: number };
    filterMethod: 'similarity' | 'passthrough';
    embeddingLatencyMs?: number;
    queryLatencyMs?: number;
  };
}

/**
 * Get relevant open items for a project based on transcript content.
 * Uses vector similarity to filter items, falling back to recency.
 *
 * OPTIMIZATION: Fetches data with limit to avoid N+1 count-then-fetch pattern.
 * If total items <= MAX_CONTEXT_ITEMS, returns all (passthrough mode).
 * Otherwise, uses similarity filtering.
 */
export async function getRelevantContext(
  projectId: string,
  transcript: string
): Promise<RelevantContextResult> {
  const startTime = Date.now();
  const supabase = await createClient();

  // OPTIMIZATION: Fetch data with limit instead of count-then-fetch
  // Using MAX_CONTEXT_ITEMS + 1 to detect if we need filtering
  const fetchLimit = MAX_CONTEXT_ITEMS + 1;

  const [actionItemsResult, decisionsResult, risksResult] = await Promise.all([
    supabase
      .from('action_items')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'Closed')
      .order('updated_at', { ascending: false })
      .limit(fetchLimit),
    supabase
      .from('decisions')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(fetchLimit),
    supabase
      .from('risks')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'Closed')
      .order('updated_at', { ascending: false })
      .limit(fetchLimit),
  ]);

  const actionItems = actionItemsResult.data || [];
  const decisions = decisionsResult.data || [];
  const risks = risksResult.data || [];

  // Check if any entity type exceeded limit (needs filtering)
  const needsFiltering =
    actionItems.length > MAX_CONTEXT_ITEMS ||
    decisions.length > MAX_CONTEXT_ITEMS ||
    risks.length > MAX_CONTEXT_ITEMS ||
    actionItems.length + decisions.length + risks.length > MAX_CONTEXT_ITEMS;

  // If total items is small, just return everything (no need to filter)
  if (!needsFiltering) {
    const totalOpen = {
      actionItems: actionItems.length,
      decisions: decisions.length,
      risks: risks.length,
    };

    log.debug('Context items below threshold, returning all', {
      projectId,
      totalItems: actionItems.length + decisions.length + risks.length,
      threshold: MAX_CONTEXT_ITEMS,
    });

    return {
      actionItems,
      decisions,
      risks,
      stats: {
        totalOpen,
        included: {
          actionItems: actionItems.length,
          decisions: decisions.length,
          risks: risks.length,
        },
        filterMethod: 'passthrough',
      },
    };
  }

  // Get actual counts for logging (since we have more than limit)
  const totalOpen = {
    actionItems: actionItems.length >= fetchLimit ? fetchLimit : actionItems.length,
    decisions: decisions.length >= fetchLimit ? fetchLimit : decisions.length,
    risks: risks.length >= fetchLimit ? fetchLimit : risks.length,
  };

  // Large number of items - use similarity filtering
  const totalItems = totalOpen.actionItems + totalOpen.decisions + totalOpen.risks;
  log.info('Using similarity filter for context', {
    projectId,
    totalItems,
    maxItems: MAX_CONTEXT_ITEMS,
  });

  // Generate embedding for transcript (use sample for cost efficiency)
  const transcriptSample = transcript.slice(0, TRANSCRIPT_SAMPLE_LENGTH);
  const embeddingStart = Date.now();
  
  let embedding: number[];
  try {
    embedding = await generateEmbedding(transcriptSample);
  } catch (error) {
    // If embedding fails, fall back to recency-based filtering
    log.warn('Embedding generation failed, falling back to recency filter', {
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return getRecentContext(projectId, supabase, totalOpen);
  }
  
  const embeddingLatencyMs = Date.now() - embeddingStart;

  // Query similar items across all entity types
  const queryStart = Date.now();
  const { data: similarItems, error: similarError } = await supabase.rpc(
    'search_similar_items',
    {
      query_embedding: embedding,
      p_project_id: projectId,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: MAX_CONTEXT_ITEMS,
    }
  );

  if (similarError) {
    log.error('Similarity search failed, falling back to recency filter', {
      projectId,
      error: similarError.message,
    });
    return getRecentContext(projectId, supabase, totalOpen);
  }

  const queryLatencyMs = Date.now() - queryStart;

  // Get IDs by entity type
  const actionItemIds: string[] = [];
  const decisionIds: string[] = [];
  const riskIds: string[] = [];

  for (const item of similarItems || []) {
    if (item.entity_type === 'action_item') {
      actionItemIds.push(item.id);
    } else if (item.entity_type === 'decision') {
      decisionIds.push(item.id);
    } else if (item.entity_type === 'risk') {
      riskIds.push(item.id);
    }
  }

  // Also include recently updated items (within RECENT_DAYS)
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - RECENT_DAYS);
  const recentCutoffStr = recentCutoff.toISOString();

  // Build OR conditions (handle empty ID arrays gracefully)
  const buildOrCondition = (ids: string[], recentDate: string) => {
    if (ids.length === 0) {
      return `updated_at.gte.${recentDate}`;
    }
    return `id.in.(${ids.join(',')}),updated_at.gte.${recentDate}`;
  };

  // Fetch the actual items (similar + recent)
  const [filteredActionItems, filteredDecisions, filteredRisks] = await Promise.all([
    supabase
      .from('action_items')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'Closed')
      .or(buildOrCondition(actionItemIds, recentCutoffStr)),
    supabase
      .from('decisions')
      .select('*')
      .eq('project_id', projectId)
      .or(buildOrCondition(decisionIds, recentCutoffStr)),
    supabase
      .from('risks')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'Closed')
      .or(buildOrCondition(riskIds, recentCutoffStr)),
  ]);

  const totalLatencyMs = Date.now() - startTime;
  const included = {
    actionItems: filteredActionItems.data?.length || 0,
    decisions: filteredDecisions.data?.length || 0,
    risks: filteredRisks.data?.length || 0,
  };

  log.info('Relevant context filtered', {
    projectId,
    totalOpen,
    included,
    reduction: `${Math.round((1 - (included.actionItems + included.decisions + included.risks) / totalItems) * 100)}%`,
    embeddingLatencyMs,
    queryLatencyMs,
    totalLatencyMs,
  });

  return {
    actionItems: filteredActionItems.data || [],
    decisions: filteredDecisions.data || [],
    risks: filteredRisks.data || [],
    stats: {
      totalOpen,
      included,
      filterMethod: 'similarity',
      embeddingLatencyMs,
      queryLatencyMs,
    },
  };
}

/**
 * Fallback: Get recently updated items when similarity search fails
 */
async function getRecentContext(
  projectId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  totalOpen: { actionItems: number; decisions: number; risks: number }
): Promise<RelevantContextResult> {
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - RECENT_DAYS);
  const recentCutoffStr = recentCutoff.toISOString();

  // Get items updated in the last RECENT_DAYS, capped
  const [actionItems, decisions, risks] = await Promise.all([
    supabase
      .from('action_items')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'Closed')
      .gte('updated_at', recentCutoffStr)
      .order('updated_at', { ascending: false })
      .limit(Math.floor(MAX_CONTEXT_ITEMS / 3)),
    supabase
      .from('decisions')
      .select('*')
      .eq('project_id', projectId)
      .gte('updated_at', recentCutoffStr)
      .order('updated_at', { ascending: false })
      .limit(Math.floor(MAX_CONTEXT_ITEMS / 3)),
    supabase
      .from('risks')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'Closed')
      .gte('updated_at', recentCutoffStr)
      .order('updated_at', { ascending: false })
      .limit(Math.floor(MAX_CONTEXT_ITEMS / 3)),
  ]);

  return {
    actionItems: actionItems.data || [],
    decisions: decisions.data || [],
    risks: risks.data || [],
    stats: {
      totalOpen,
      included: {
        actionItems: actionItems.data?.length || 0,
        decisions: decisions.data?.length || 0,
        risks: risks.data?.length || 0,
      },
      filterMethod: 'passthrough', // Indicate this was a fallback
    },
  };
}
