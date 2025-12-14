/**
 * Duplicate Detection using pgvector
 */

import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from './client';
import type { EntityType } from '@/types/enums';
import { loggers } from '@/lib/logger';

const log = loggers.embedding;
const DEFAULT_THRESHOLD = 0.85;

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
 * Check for duplicates of an action item
 */
export async function checkActionItemDuplicate(
  title: string,
  description: string,
  projectId: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<DuplicateCheckResult> {
  const startTime = Date.now();
  log.debug('Checking action item for duplicates', { title, projectId, threshold });
  
  const supabase = await createClient();
  const text = `${title}. ${description}`;
  const embedding = await generateEmbedding(text);

  // Query similar items using pgvector
  const { data: similar, error } = await supabase.rpc('match_action_items', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 5,
    p_project_id: projectId,
  });

  if (error) {
    log.error('Duplicate check failed for action item', {
      title,
      projectId,
      error: error.message,
    });
  }

  const candidates: DuplicateCandidate[] = (similar || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    similarity: item.similarity,
  }));

  const durationMs = Date.now() - startTime;
  if (candidates.length > 0) {
    log.info('Potential duplicates found for action item', {
      title,
      candidateCount: candidates.length,
      topSimilarity: candidates[0]?.similarity,
      durationMs,
    });
  } else {
    log.debug('No duplicates found for action item', { title, durationMs });
  }

  return {
    isDuplicate: candidates.length > 0,
    candidates,
    embedding,
  };
}

/**
 * Check for duplicates of a decision
 */
export async function checkDecisionDuplicate(
  title: string,
  rationale: string,
  projectId: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<DuplicateCheckResult> {
  const startTime = Date.now();
  log.debug('Checking decision for duplicates', { title, projectId, threshold });
  
  const supabase = await createClient();
  const text = `${title}. ${rationale}`;
  const embedding = await generateEmbedding(text);

  const { data: similar, error } = await supabase.rpc('match_decisions', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 5,
    p_project_id: projectId,
  });

  if (error) {
    log.error('Duplicate check failed for decision', {
      title,
      projectId,
      error: error.message,
    });
  }

  const candidates: DuplicateCandidate[] = (similar || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    similarity: item.similarity,
  }));

  const durationMs = Date.now() - startTime;
  if (candidates.length > 0) {
    log.info('Potential duplicates found for decision', {
      title,
      candidateCount: candidates.length,
      topSimilarity: candidates[0]?.similarity,
      durationMs,
    });
  } else {
    log.debug('No duplicates found for decision', { title, durationMs });
  }

  return {
    isDuplicate: candidates.length > 0,
    candidates,
    embedding,
  };
}

/**
 * Check for duplicates of a risk
 */
export async function checkRiskDuplicate(
  title: string,
  description: string,
  projectId: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<DuplicateCheckResult> {
  const startTime = Date.now();
  log.debug('Checking risk for duplicates', { title, projectId, threshold });
  
  const supabase = await createClient();
  const text = `${title}. ${description}`;
  const embedding = await generateEmbedding(text);

  const { data: similar, error } = await supabase.rpc('match_risks', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 5,
    p_project_id: projectId,
  });

  if (error) {
    log.error('Duplicate check failed for risk', {
      title,
      projectId,
      error: error.message,
    });
  }

  const candidates: DuplicateCandidate[] = (similar || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    similarity: item.similarity,
  }));

  const durationMs = Date.now() - startTime;
  if (candidates.length > 0) {
    log.info('Potential duplicates found for risk', {
      title,
      candidateCount: candidates.length,
      topSimilarity: candidates[0]?.similarity,
      durationMs,
    });
  } else {
    log.debug('No duplicates found for risk', { title, durationMs });
  }

  return {
    isDuplicate: candidates.length > 0,
    candidates,
    embedding,
  };
}

/**
 * Batch check duplicates for proposed items
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
  
  log.info('Starting batch duplicate detection', {
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
  let duplicatesFound = 0;

  // Check action items
  for (const item of proposedItems.action_items) {
    const check = await checkActionItemDuplicate(
      item.title,
      item.description,
      projectId,
      threshold
    );
    if (check.isDuplicate && check.candidates[0]) {
      results.set(item.temp_id, {
        duplicate_of: check.candidates[0].id,
        similarity_score: check.candidates[0].similarity,
      });
      duplicatesFound++;
    } else {
      results.set(item.temp_id, { duplicate_of: null, similarity_score: null });
    }
  }

  // Check decisions
  for (const item of proposedItems.decisions) {
    const check = await checkDecisionDuplicate(
      item.title,
      item.rationale,
      projectId,
      threshold
    );
    if (check.isDuplicate && check.candidates[0]) {
      results.set(item.temp_id, {
        duplicate_of: check.candidates[0].id,
        similarity_score: check.candidates[0].similarity,
      });
      duplicatesFound++;
    } else {
      results.set(item.temp_id, { duplicate_of: null, similarity_score: null });
    }
  }

  // Check risks
  for (const item of proposedItems.risks) {
    const check = await checkRiskDuplicate(
      item.title,
      item.description,
      projectId,
      threshold
    );
    if (check.isDuplicate && check.candidates[0]) {
      results.set(item.temp_id, {
        duplicate_of: check.candidates[0].id,
        similarity_score: check.candidates[0].similarity,
      });
      duplicatesFound++;
    } else {
      results.set(item.temp_id, { duplicate_of: null, similarity_score: null });
    }
  }

  const durationMs = Date.now() - startTime;
  log.info('Batch duplicate detection complete', {
    projectId,
    totalItems,
    duplicatesFound,
    durationMs,
    avgTimePerItem: totalItems > 0 ? Math.round(durationMs / totalItems) : 0,
  });

  return results;
}

