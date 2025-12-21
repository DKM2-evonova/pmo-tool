/**
 * Database Performance Monitoring Utilities
 *
 * Provides tools for tracking query performance, identifying slow queries,
 * and monitoring database health.
 */

import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('db');

/**
 * Query performance tracking wrapper
 * Logs queries that exceed the threshold
 */
export async function trackQueryPerformance<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  thresholdMs: number = 100
): Promise<{ result: T; durationMs: number }> {
  const startTime = Date.now();
  const result = await queryFn();
  const durationMs = Date.now() - startTime;

  if (durationMs > thresholdMs) {
    log.warn('Slow query detected', {
      queryName,
      durationMs,
      thresholdMs,
    });
  } else {
    log.debug('Query completed', {
      queryName,
      durationMs,
    });
  }

  return { result, durationMs };
}

/**
 * Get database statistics for monitoring
 */
export async function getDatabaseStats() {
  const supabase = await createClient();

  // Get table row counts (approximate for performance)
  const { data: tableStats } = await supabase.rpc('get_table_stats');

  return tableStats;
}

/**
 * Get items missing embeddings for data quality monitoring
 */
export async function getItemsMissingEmbeddings(projectId?: string): Promise<{
  actionItems: number;
  decisions: number;
  risks: number;
  items: Array<{ entity_type: string; entity_id: string; title: string; created_at: string }>;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_items_missing_embeddings', {
    p_project_id: projectId || null,
  });

  if (error) {
    log.error('Failed to get items missing embeddings', { error: error.message });
    return { actionItems: 0, decisions: 0, risks: 0, items: [] };
  }

  const items = data || [];
  const actionItems = items.filter((i: { entity_type: string }) => i.entity_type === 'action_item').length;
  const decisions = items.filter((i: { entity_type: string }) => i.entity_type === 'decision').length;
  const risks = items.filter((i: { entity_type: string }) => i.entity_type === 'risk').length;

  return { actionItems, decisions, risks, items };
}

/**
 * Get project statistics from the materialized view
 * This is much faster than computing statistics on-demand
 */
export async function getProjectStatistics(projectId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('project_statistics')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (error) {
    // If materialized view is stale or doesn't exist, compute directly
    log.warn('Project statistics not available, computing directly', {
      projectId,
      error: error.message,
    });
    return null;
  }

  return data;
}

/**
 * Refresh project statistics (call after significant data changes)
 */
export async function refreshProjectStatistics() {
  const supabase = await createClient();

  const { error } = await supabase.rpc('refresh_project_statistics');

  if (error) {
    log.error('Failed to refresh project statistics', { error: error.message });
    return false;
  }

  log.info('Project statistics refreshed successfully');
  return true;
}

/**
 * Get dashboard data optimized for performance
 * Uses a single database function call instead of multiple queries
 */
export async function getDashboardDataOptimized(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_dashboard_data', {
    p_user_id: userId,
  });

  if (error) {
    log.error('Failed to get optimized dashboard data', { error: error.message });
    return null;
  }

  return data?.[0] || null;
}

/**
 * Performance report for admin dashboard
 */
export interface PerformanceReport {
  llmMetrics: {
    totalCalls: number;
    successRate: number;
    avgLatencyMs: number;
    fallbackRate: number;
  };
  embeddings: {
    missingCount: number;
    coveragePercent: number;
  };
  queries: {
    slowQueryCount24h: number;
  };
}

/**
 * Generate a performance report for the admin dashboard
 */
export async function generatePerformanceReport(): Promise<PerformanceReport | null> {
  const supabase = await createClient();

  try {
    // Get LLM metrics from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: llmData } = await supabase
      .from('llm_metrics')
      .select('success, is_fallback, latency_ms')
      .gte('created_at', oneDayAgo);

    const llmMetrics = llmData || [];
    const totalCalls = llmMetrics.length;
    const successfulCalls = llmMetrics.filter(m => m.success).length;
    const fallbackCalls = llmMetrics.filter(m => m.is_fallback).length;
    const totalLatency = llmMetrics.reduce((sum, m) => sum + (m.latency_ms || 0), 0);

    // Get embedding coverage
    const embeddingData = await getItemsMissingEmbeddings();
    const missingCount = embeddingData.actionItems + embeddingData.decisions + embeddingData.risks;

    // Get total entity counts for coverage calculation
    const [actionItemCount, decisionCount, riskCount] = await Promise.all([
      supabase.from('action_items').select('id', { count: 'exact', head: true }),
      supabase.from('decisions').select('id', { count: 'exact', head: true }),
      supabase.from('risks').select('id', { count: 'exact', head: true }),
    ]);

    const totalEntities = (actionItemCount.count || 0) + (decisionCount.count || 0) + (riskCount.count || 0);
    const coveragePercent = totalEntities > 0
      ? Math.round(((totalEntities - missingCount) / totalEntities) * 100)
      : 100;

    return {
      llmMetrics: {
        totalCalls,
        successRate: totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 100,
        avgLatencyMs: totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0,
        fallbackRate: totalCalls > 0 ? Math.round((fallbackCalls / totalCalls) * 100) : 0,
      },
      embeddings: {
        missingCount,
        coveragePercent,
      },
      queries: {
        slowQueryCount24h: 0, // Would need log analysis to populate
      },
    };
  } catch (error) {
    log.error('Failed to generate performance report', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
