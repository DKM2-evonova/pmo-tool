import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/embeddings/client';
import { loggers } from '@/lib/logger';
import type {
  ProposedActionItem,
  ProposedDecision,
  ProposedRisk,
  ActionItemUpdate,
  RiskUpdate,
} from '@/types/database';

const log = loggers.publish;

/**
 * Creates an AI-generated update comment for action items or risks
 * when they are updated or closed via meeting processing.
 */
interface AIUpdateParams {
  operation: 'update' | 'close';
  entityType: 'action_item' | 'risk';
  existing: Record<string, unknown>;
  updated: Record<string, unknown>;
  evidence: { quote: string; speaker: string | null; timestamp: string | null }[];
  meetingId: string;
  meetingTitle: string | null;
  publisherUserId: string;
  publisherName: string;
}

function createAIUpdateComment(params: AIUpdateParams): ActionItemUpdate | RiskUpdate {
  const {
    operation,
    entityType,
    existing,
    updated,
    evidence,
    meetingId,
    meetingTitle,
    publisherUserId,
    publisherName,
  } = params;

  // Build content describing what changed
  let content: string;

  if (operation === 'close') {
    content = 'Closed via meeting processing.';
  } else {
    // Build list of changes for update operation
    const changes: string[] = [];

    if (existing.status !== updated.status) {
      changes.push(`Status: ${existing.status} → ${updated.status}`);
    }
    if (existing.title !== updated.title) {
      changes.push('Title updated');
    }
    if (existing.description !== updated.description) {
      changes.push('Description updated');
    }

    if (entityType === 'action_item') {
      if (existing.due_date !== updated.due_date) {
        changes.push(`Due date: ${existing.due_date || 'None'} → ${updated.due_date || 'None'}`);
      }
      if (existing.owner_name !== updated.owner_name) {
        changes.push(`Owner: ${existing.owner_name || 'Unassigned'} → ${updated.owner_name || 'Unassigned'}`);
      }
    }

    if (entityType === 'risk') {
      if (existing.probability !== updated.probability) {
        changes.push(`Probability: ${existing.probability} → ${updated.probability}`);
      }
      if (existing.impact !== updated.impact) {
        changes.push(`Impact: ${existing.impact} → ${updated.impact}`);
      }
      if (existing.mitigation !== updated.mitigation) {
        changes.push('Mitigation updated');
      }
    }

    content = changes.length > 0
      ? `Updated via meeting processing: ${changes.join('; ')}.`
      : 'Reviewed in meeting (no changes to core fields).';
  }

  // Get the primary evidence quote (first one, truncated if too long)
  const primaryEvidence = evidence[0];
  const maxQuoteLength = 300;
  let evidenceQuote: string | undefined = primaryEvidence?.quote || undefined;
  if (evidenceQuote && evidenceQuote.length > maxQuoteLength) {
    evidenceQuote = evidenceQuote.substring(0, maxQuoteLength) + '...';
  }

  return {
    id: crypto.randomUUID(),
    content,
    created_at: new Date().toISOString(),
    created_by_user_id: publisherUserId,
    created_by_name: `${publisherName} (via AI)`,
    source: 'ai_meeting_processing',
    meeting_id: meetingId,
    meeting_title: meetingTitle || 'Untitled Meeting',
    evidence_quote: evidenceQuote,
  };
}

/**
 * Parses the existing updates array from an item, handling null/malformed data
 * Handles both TEXT (JSON string) and JSONB (already parsed object) formats for compatibility
 */
function parseExistingUpdates(updates: string | unknown[] | null | undefined): unknown[] {
  if (!updates) return [];
  // Already an array (JSONB from database)
  if (Array.isArray(updates)) return updates;
  // String (TEXT from database) - parse as JSON
  if (typeof updates === 'string') {
    try {
      const parsed = JSON.parse(updates);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const { meetingId } = await params;
    
    log.info('Starting meeting publish', { meetingId });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get publisher's profile for AI update attribution
    const { data: publisherProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    const publisherName = publisherProfile?.full_name || user.email || 'Unknown';

    // Get meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (meeting.status === 'Deleted') {
      return NextResponse.json(
        { error: 'Cannot publish a deleted meeting' },
        { status: 400 }
      );
    }

    if (meeting.status !== 'Review') {
      return NextResponse.json(
        { error: 'Meeting is not in Review status' },
        { status: 400 }
      );
    }

    // Get proposed change set
    const { data: changeSet, error: changeSetError } = await supabase
      .from('proposed_change_sets')
      .select('*')
      .eq('meeting_id', meetingId)
      .single();

    if (changeSetError || !changeSet) {
      return NextResponse.json(
        { error: 'No proposed changes found' },
        { status: 404 }
      );
    }

    // Lock timeout in minutes (configurable via env)
    const LOCK_TIMEOUT_MINUTES = parseInt(
      process.env.LOCK_TIMEOUT_MINUTES || '30',
      10
    );

    // Check if another user holds a valid lock
    if (changeSet.locked_by_user_id && changeSet.locked_by_user_id !== user.id) {
      // Handle case where locked_at might be null (data integrity edge case)
      if (changeSet.locked_at) {
        const lockTime = new Date(changeSet.locked_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - lockTime.getTime()) / 1000 / 60;

        if (diffMinutes < LOCK_TIMEOUT_MINUTES) {
          return NextResponse.json(
            { error: 'Meeting is locked by another user' },
            { status: 409 }
          );
        }
      }
      // If locked_at is null but there's a lock holder, treat as expired lock
      // and proceed to acquire
    }

    // Acquire lock atomically to prevent race conditions
    const { data: lockAcquired, error: lockError } = await supabase.rpc(
      'acquire_change_set_lock',
      {
        p_change_set_id: changeSet.id,
        p_user_id: user.id,
        p_expected_version: changeSet.lock_version,
      }
    );

    if (lockError) {
      log.error('Failed to acquire lock', {
        meetingId,
        changeSetId: changeSet.id,
        error: lockError.message,
      });
      return NextResponse.json(
        { error: 'Failed to acquire lock for publishing' },
        { status: 500 }
      );
    }

    if (!lockAcquired) {
      log.warn('Lock acquisition failed - concurrent modification', {
        meetingId,
        changeSetId: changeSet.id,
        currentLockHolder: changeSet.locked_by_user_id,
      });
      return NextResponse.json(
        { error: 'Could not acquire lock - meeting may have been modified by another user' },
        { status: 409 }
      );
    }

    log.debug('Lock acquired successfully', { meetingId, changeSetId: changeSet.id });

    const proposedItems = changeSet.proposed_items as {
      action_items: ProposedActionItem[];
      decisions: ProposedDecision[];
      risks: ProposedRisk[];
    };

    const acceptedActionItems = proposedItems.action_items.filter((ai) => ai.accepted);
    const acceptedDecisions = proposedItems.decisions.filter((d) => d.accepted);
    const acceptedRisks = proposedItems.risks.filter((r) => r.accepted);
    
    log.info('Processing proposed items', {
      meetingId,
      totalActionItems: proposedItems.action_items.length,
      acceptedActionItems: acceptedActionItems.length,
      totalDecisions: proposedItems.decisions.length,
      acceptedDecisions: acceptedDecisions.length,
      totalRisks: proposedItems.risks.length,
      acceptedRisks: acceptedRisks.length,
    });

    let embeddingFailures = 0;

    // Collect all data for transactional publish
    // Using temp_id to correlate new items with their evidence/audit records
    interface ActionItemData {
      temp_id: string;
      operation: string;
      external_id?: string;
      project_id: string;
      title: string;
      description: string;
      status: string;
      owner_user_id: string | null;
      owner_name: string;
      owner_email: string | null;
      due_date: string | null;
      embedding: number[] | null;
      source_meeting_id: string;
      updates_json?: string;
    }

    interface DecisionData {
      temp_id: string;
      operation: string;
      project_id: string;
      title: string;
      rationale: string;
      impact: string;
      category: string | null;
      impact_areas: string[] | null;
      status: string;
      decision_maker_user_id: string | null;
      decision_maker_name: string;
      decision_maker_email: string | null;
      outcome: string | null;
      decision_date: string;
      embedding: number[] | null;
      source_meeting_id: string;
    }

    interface RiskData {
      temp_id: string;
      operation: string;
      external_id?: string;
      project_id: string;
      title: string;
      description: string;
      probability: string;
      impact: string;
      mitigation: string | null;
      status: string;
      owner_user_id: string | null;
      owner_name: string;
      owner_email: string | null;
      embedding: number[] | null;
      source_meeting_id: string;
      updates_json?: string;
    }

    interface EvidenceData {
      temp_id: string;
      entity_type: 'action_item' | 'decision' | 'risk';
      entity_id: string; // Will be filled in by transaction for new items
      meeting_id: string;
      quote: string;
      speaker: string | null;
      timestamp: string | null;
    }

    interface AuditData {
      temp_id: string;
      user_id: string;
      action_type: 'create' | 'update' | 'close';
      entity_type: 'action_item' | 'decision' | 'risk';
      entity_id: string; // Will be filled in by transaction for new items
      project_id: string;
      before_data: unknown | null;
      after_data: unknown | null;
    }

    const actionItemsData: ActionItemData[] = [];
    const decisionsData: DecisionData[] = [];
    const risksData: RiskData[] = [];
    const evidenceData: EvidenceData[] = [];
    const auditData: AuditData[] = [];

    // Helper to queue evidence
    const queueEvidence = (
      tempId: string,
      entityType: 'action_item' | 'decision' | 'risk',
      entityId: string, // For updates/closes this is real ID, for creates it's temp_id
      evidence: { quote: string; speaker: string | null; timestamp: string | null }[]
    ) => {
      for (const e of evidence) {
        evidenceData.push({
          temp_id: tempId,
          entity_type: entityType,
          entity_id: entityId,
          meeting_id: meetingId,
          quote: e.quote,
          speaker: e.speaker,
          timestamp: e.timestamp,
        });
      }
    };

    // Helper to queue audit
    const queueAudit = (
      tempId: string,
      actionType: 'create' | 'update' | 'close',
      entityType: 'action_item' | 'decision' | 'risk',
      entityId: string,
      before: unknown | null,
      after: unknown | null
    ) => {
      auditData.push({
        temp_id: tempId,
        user_id: user.id,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        project_id: meeting.project_id,
        before_data: before,
        after_data: after,
      });
    };

    // For update/close operations, we need to fetch existing items first
    const existingItemsCache = new Map<string, Record<string, unknown>>();

    // Pre-fetch existing action items that will be updated/closed
    const actionItemsToFetch = acceptedActionItems
      .filter((ai) => ai.operation !== 'create' && ai.external_id)
      .map((ai) => ai.external_id as string);

    if (actionItemsToFetch.length > 0) {
      const { data: existingAIs } = await supabase
        .from('action_items')
        .select('*')
        .in('id', actionItemsToFetch);
      for (const ai of existingAIs || []) {
        existingItemsCache.set(`action_item:${ai.id}`, ai);
      }
    }

    // Pre-fetch existing risks that will be closed
    const risksToFetch = acceptedRisks
      .filter((r) => r.operation === 'close' && r.external_id)
      .map((r) => r.external_id as string);

    if (risksToFetch.length > 0) {
      const { data: existingRisks } = await supabase
        .from('risks')
        .select('*')
        .in('id', risksToFetch);
      for (const r of existingRisks || []) {
        existingItemsCache.set(`risk:${r.id}`, r);
      }
    }

    // Process action items - generate embeddings and prepare data
    log.debug('Preparing action items', { count: acceptedActionItems.length });
    for (const item of acceptedActionItems) {
      const tempId = crypto.randomUUID();
      const text = `${item.title}. ${item.description}`;
      let embedding: number[] | null = null;

      try {
        embedding = await generateEmbedding(text);
      } catch (e) {
        embeddingFailures++;
        log.warn('Embedding generation failed for action item', {
          title: item.title,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }

      if (item.operation === 'create') {
        actionItemsData.push({
          temp_id: tempId,
          operation: 'create',
          project_id: meeting.project_id,
          title: item.title,
          description: item.description,
          status: item.status,
          owner_user_id: item.owner.resolved_user_id || null,
          owner_name: item.owner.name,
          owner_email: item.owner.email || null,
          due_date: item.due_date || null,
          embedding,
          source_meeting_id: meetingId,
        });

        queueEvidence(tempId, 'action_item', tempId, item.evidence);
        queueAudit(tempId, 'create', 'action_item', tempId, null, {
          title: item.title,
          description: item.description,
          status: item.status,
        });
      } else if (item.operation === 'update' && item.external_id) {
        const existing = existingItemsCache.get(`action_item:${item.external_id}`) || {};

        const proposedUpdate = {
          title: item.title,
          description: item.description,
          status: item.status,
          owner_name: item.owner.name,
          due_date: item.due_date,
        };

        const aiUpdate = createAIUpdateComment({
          operation: 'update',
          entityType: 'action_item',
          existing,
          updated: proposedUpdate,
          evidence: item.evidence,
          meetingId,
          meetingTitle: meeting.title,
          publisherUserId: user.id,
          publisherName,
        });

        const currentUpdates = parseExistingUpdates(
          (existing as Record<string, unknown>).updates as string | unknown[] | null | undefined
        );
        currentUpdates.push(aiUpdate);

        actionItemsData.push({
          temp_id: tempId,
          operation: 'update',
          external_id: item.external_id,
          project_id: meeting.project_id,
          title: item.title,
          description: item.description,
          status: item.status,
          owner_user_id: item.owner.resolved_user_id || null,
          owner_name: item.owner.name,
          owner_email: item.owner.email || null,
          due_date: item.due_date || null,
          embedding,
          source_meeting_id: meetingId,
          updates_json: JSON.stringify(currentUpdates),
        });

        queueEvidence(tempId, 'action_item', item.external_id, item.evidence);
        queueAudit(tempId, 'update', 'action_item', item.external_id, existing, proposedUpdate);
      } else if (item.operation === 'close' && item.external_id) {
        const existing = existingItemsCache.get(`action_item:${item.external_id}`) || {};

        const aiUpdate = createAIUpdateComment({
          operation: 'close',
          entityType: 'action_item',
          existing,
          updated: { status: 'Closed' },
          evidence: item.evidence,
          meetingId,
          meetingTitle: meeting.title,
          publisherUserId: user.id,
          publisherName,
        });

        const currentUpdates = parseExistingUpdates(
          (existing as Record<string, unknown>).updates as string | unknown[] | null | undefined
        );
        currentUpdates.push(aiUpdate);

        actionItemsData.push({
          temp_id: tempId,
          operation: 'close',
          external_id: item.external_id,
          project_id: meeting.project_id,
          title: item.title,
          description: item.description,
          status: 'Closed',
          owner_user_id: item.owner.resolved_user_id || null,
          owner_name: item.owner.name,
          owner_email: item.owner.email || null,
          due_date: item.due_date || null,
          embedding: null,
          source_meeting_id: meetingId,
          updates_json: JSON.stringify(currentUpdates),
        });

        queueEvidence(tempId, 'action_item', item.external_id, item.evidence);
        queueAudit(tempId, 'close', 'action_item', item.external_id, existing, { status: 'Closed' });
      }
    }

    // Process decisions - generate embeddings and prepare data
    log.debug('Preparing decisions', { count: acceptedDecisions.length });
    for (const item of acceptedDecisions) {
      if (item.operation !== 'create') continue;

      const tempId = crypto.randomUUID();
      const text = `${item.title}. ${item.rationale}`;
      let embedding: number[] | null = null;

      try {
        embedding = await generateEmbedding(text);
      } catch (e) {
        embeddingFailures++;
        log.warn('Embedding generation failed for decision', {
          title: item.title,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }

      decisionsData.push({
        temp_id: tempId,
        operation: 'create',
        project_id: meeting.project_id,
        title: item.title,
        rationale: item.rationale,
        impact: item.impact,
        category: item.category || null,
        impact_areas: item.impact_areas || null,
        status: item.status,
        decision_maker_user_id: item.decision_maker.resolved_user_id || null,
        decision_maker_name: item.decision_maker.name,
        decision_maker_email: item.decision_maker.email || null,
        outcome: item.outcome || null,
        decision_date: meeting.date,
        embedding,
        source_meeting_id: meetingId,
      });

      queueEvidence(tempId, 'decision', tempId, item.evidence);
      queueAudit(tempId, 'create', 'decision', tempId, null, {
        title: item.title,
        rationale: item.rationale,
      });
    }

    // Process risks - generate embeddings and prepare data
    log.debug('Preparing risks', { count: acceptedRisks.length });
    for (const item of acceptedRisks) {
      const tempId = crypto.randomUUID();
      const text = `${item.title}. ${item.description}`;
      let embedding: number[] | null = null;

      try {
        embedding = await generateEmbedding(text);
      } catch (e) {
        embeddingFailures++;
        log.warn('Embedding generation failed for risk', {
          title: item.title,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }

      if (item.operation === 'create') {
        risksData.push({
          temp_id: tempId,
          operation: 'create',
          project_id: meeting.project_id,
          title: item.title,
          description: item.description,
          probability: item.probability,
          impact: item.impact,
          mitigation: item.mitigation || null,
          status: item.status,
          owner_user_id: item.owner.resolved_user_id || null,
          owner_name: item.owner.name,
          owner_email: item.owner.email || null,
          embedding,
          source_meeting_id: meetingId,
        });

        queueEvidence(tempId, 'risk', tempId, item.evidence);
        queueAudit(tempId, 'create', 'risk', tempId, null, {
          title: item.title,
          description: item.description,
        });
      } else if (item.operation === 'close' && item.external_id) {
        const existing = existingItemsCache.get(`risk:${item.external_id}`) || {};

        const aiUpdate = createAIUpdateComment({
          operation: 'close',
          entityType: 'risk',
          existing,
          updated: { status: 'Closed' },
          evidence: item.evidence,
          meetingId,
          meetingTitle: meeting.title,
          publisherUserId: user.id,
          publisherName,
        });

        const currentUpdates = parseExistingUpdates(
          (existing as Record<string, unknown>).updates as string | unknown[] | null | undefined
        );
        currentUpdates.push(aiUpdate);

        risksData.push({
          temp_id: tempId,
          operation: 'close',
          external_id: item.external_id,
          project_id: meeting.project_id,
          title: item.title,
          description: item.description,
          probability: item.probability,
          impact: item.impact,
          mitigation: item.mitigation || null,
          status: 'Closed',
          owner_user_id: item.owner.resolved_user_id || null,
          owner_name: item.owner.name,
          owner_email: item.owner.email || null,
          embedding: null,
          source_meeting_id: meetingId,
          updates_json: JSON.stringify(currentUpdates),
        });

        queueEvidence(tempId, 'risk', item.external_id, item.evidence);
        queueAudit(tempId, 'close', 'risk', item.external_id, existing, { status: 'Closed' });
      }
    }

    // Execute all operations in a single transaction
    log.info('Executing transactional publish', {
      meetingId,
      actionItems: actionItemsData.length,
      decisions: decisionsData.length,
      risks: risksData.length,
      evidence: evidenceData.length,
      audits: auditData.length,
    });

    const { data: txResult, error: txError } = await serviceClient.rpc(
      'publish_meeting_transaction',
      {
        p_meeting_id: meetingId,
        p_action_items: actionItemsData,
        p_decisions: decisionsData,
        p_risks: risksData,
        p_evidence_records: evidenceData,
        p_audit_records: auditData,
      }
    );

    if (txError) {
      log.error('Transaction failed', {
        meetingId,
        error: txError.message,
      });
      throw new Error(`Transaction failed: ${txError.message}`);
    }

    const actionItemsCreated = txResult?.action_items_created || 0;
    const actionItemsUpdated = txResult?.action_items_updated || 0;
    const actionItemsClosed = txResult?.action_items_closed || 0;
    const decisionsCreated = txResult?.decisions_created || 0;
    const risksCreated = txResult?.risks_created || 0;
    const risksClosed = txResult?.risks_closed || 0;

    // Release lock
    await supabase.rpc('release_change_set_lock', {
      p_change_set_id: changeSet.id,
      p_user_id: user.id,
    });

    const durationMs = Date.now() - startTime;
    log.info('Meeting published successfully', {
      meetingId,
      projectId: meeting.project_id,
      durationMs,
      actionItems: {
        created: actionItemsCreated,
        updated: actionItemsUpdated,
        closed: actionItemsClosed,
      },
      decisions: {
        created: decisionsCreated,
      },
      risks: {
        created: risksCreated,
        closed: risksClosed,
      },
      embeddingFailures,
      transactionalPublish: {
        evidenceRecords: evidenceData.length,
        auditRecords: auditData.length,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Extract error details - handle both Error objects and Supabase error objects
    let errorMessage = 'Unknown error';
    let errorDetails: Record<string, unknown> = {};

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        stack: error.stack?.substring(0, 500),
      };
    } else if (error && typeof error === 'object') {
      // Supabase errors and other object errors
      errorMessage = (error as { message?: string }).message || JSON.stringify(error);
      errorDetails = error as Record<string, unknown>;
    }

    log.error('Meeting publish failed', {
      durationMs,
      error: errorMessage,
      errorDetails,
    });

    // Also log to console for immediate visibility
    console.error('[PUBLISH ERROR]', {
      message: errorMessage,
      details: errorDetails,
      rawError: error,
    });

    return NextResponse.json(
      { error: 'Publish failed: ' + errorMessage },
      { status: 500 }
    );
  }
}

