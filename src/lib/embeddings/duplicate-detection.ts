/**
 * Duplicate Detection using pgvector
 */

import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from './client';
import { loggers } from '@/lib/logger';

const log = loggers.embedding;
const DEFAULT_THRESHOLD = 0.85;

/**
 * Response type from pgvector match RPC functions
 */
interface MatchRpcResult {
  id: string;
  title: string;
  similarity: number;
}

export interface DuplicateCandidate {
  id: string;
  title: string;
  similarity: number;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  candidates: DuplicateCandidate[];
  embedding: number[];
}

/**
 * Entity type for duplicate checking
 */
type DuplicateEntityType = 'action_item' | 'decision' | 'risk';

/**
 * RPC function names for each entity type
 */
const RPC_FUNCTIONS: Record<DuplicateEntityType, string> = {
  action_item: 'match_action_items',
  decision: 'match_decisions',
  risk: 'match_risks',
};

/**
 * Generic duplicate check function for any entity type
 */
async function checkDuplicate(
  entityType: DuplicateEntityType,
  title: string,
  content: string,
  projectId: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<DuplicateCheckResult> {
  const startTime = Date.now();
  log.debug(`Checking ${entityType} for duplicates`, { title, projectId, threshold });

  const supabase = await createClient();
  const text = `${title}. ${content}`;
  const embedding = await generateEmbedding(text);

  const rpcFunction = RPC_FUNCTIONS[entityType];
  const { data: similar, error } = await supabase.rpc(rpcFunction, {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 5,
    p_project_id: projectId,
  });

  if (error) {
    log.error(`Duplicate check failed for ${entityType}`, {
      title,
      projectId,
      error: error.message,
    });
  }

  const candidates: DuplicateCandidate[] = ((similar as MatchRpcResult[] | null) || []).map((item) => ({
    id: item.id,
    title: item.title,
    similarity: item.similarity,
  }));

  const durationMs = Date.now() - startTime;
  if (candidates.length > 0) {
    log.info(`Potential duplicates found for ${entityType}`, {
      title,
      candidateCount: candidates.length,
      topSimilarity: candidates[0]?.similarity,
      durationMs,
    });
  } else {
    log.debug(`No duplicates found for ${entityType}`, { title, durationMs });
  }

  return {
    isDuplicate: candidates.length > 0,
    candidates,
    embedding,
  };
}

/**
 * Check for duplicates of an action item
 */
export function checkActionItemDuplicate(
  title: string,
  description: string,
  projectId: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<DuplicateCheckResult> {
  return checkDuplicate('action_item', title, description, projectId, threshold);
}

/**
 * Check for duplicates of a decision
 */
export function checkDecisionDuplicate(
  title: string,
  rationale: string,
  projectId: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<DuplicateCheckResult> {
  return checkDuplicate('decision', title, rationale, projectId, threshold);
}

/**
 * Check for duplicates of a risk
 */
export function checkRiskDuplicate(
  title: string,
  description: string,
  projectId: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<DuplicateCheckResult> {
  return checkDuplicate('risk', title, description, projectId, threshold);
}

/**
 * Batch check duplicates for proposed items
 * Uses Promise.all for parallel processing to improve performance
 */
export async function checkProposedItemsDuplicates(
  proposedItems: {
    action_items: Array<{ temp_id: string; title: string; description: string }>;
    decisions: Array<{ temp_id: string; title: string; rationale: string }>;
    risks: Array<{ temp_id: string; title: string; description: string }>;
  },
  projectId: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<
  Map<string, { duplicate_of: string | null; similarity_score: number | null }>
> {
  const startTime = Date.now();
  const totalItems =
    proposedItems.action_items.length +
    proposedItems.decisions.length +
    proposedItems.risks.length;

  log.info('Starting batch duplicate detection (parallel)', {
    projectId,
    actionItemCount: proposedItems.action_items.length,
    decisionCount: proposedItems.decisions.length,
    riskCount: proposedItems.risks.length,
    threshold,
  });

  const results = new Map<
    string,
    { duplicate_of: string | null; similarity_score: number | null }
  >();

  // Create all check promises in parallel
  const actionItemChecks = proposedItems.action_items.map(async (item) => {
    const check = await checkActionItemDuplicate(
      item.title,
      item.description,
      projectId,
      threshold
    );
    return { temp_id: item.temp_id, check };
  });

  const decisionChecks = proposedItems.decisions.map(async (item) => {
    const check = await checkDecisionDuplicate(
      item.title,
      item.rationale,
      projectId,
      threshold
    );
    return { temp_id: item.temp_id, check };
  });

  const riskChecks = proposedItems.risks.map(async (item) => {
    const check = await checkRiskDuplicate(
      item.title,
      item.description,
      projectId,
      threshold
    );
    return { temp_id: item.temp_id, check };
  });

  // Execute all checks in parallel
  const [actionItemResults, decisionResults, riskResults] = await Promise.all([
    Promise.all(actionItemChecks),
    Promise.all(decisionChecks),
    Promise.all(riskChecks),
  ]);

  let duplicatesFound = 0;

  // Helper to process results
  const processResults = (
    items: Array<{ temp_id: string; check: DuplicateCheckResult }>
  ) => {
    for (const { temp_id, check } of items) {
      if (check.isDuplicate && check.candidates[0]) {
        results.set(temp_id, {
          duplicate_of: check.candidates[0].id,
          similarity_score: check.candidates[0].similarity,
        });
        duplicatesFound++;
      } else {
        results.set(temp_id, { duplicate_of: null, similarity_score: null });
      }
    }
  };

  processResults(actionItemResults);
  processResults(decisionResults);
  processResults(riskResults);

  const durationMs = Date.now() - startTime;
  log.info('Batch duplicate detection complete (parallel)', {
    projectId,
    totalItems,
    duplicatesFound,
    durationMs,
    avgTimePerItem: totalItems > 0 ? Math.round(durationMs / totalItems) : 0,
  });

  return results;
}
