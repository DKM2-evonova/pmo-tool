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
 * Evidence record for batch insertion
 */
interface EvidenceRecord {
  entity_type: 'action_item' | 'decision' | 'risk';
  entity_id: string;
  meeting_id: string;
  quote: string;
  speaker: string | null;
  timestamp: string | null;
}

/**
 * Audit log record for batch insertion
 */
interface AuditRecord {
  user_id: string;
  action_type: 'create' | 'update' | 'close';
  entity_type: 'action_item' | 'decision' | 'risk';
  entity_id: string;
  project_id: string;
  before_data: unknown | null;
  after_data: unknown | null;
}

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

    let actionItemsCreated = 0;
    let actionItemsUpdated = 0;
    let actionItemsClosed = 0;
    let decisionsCreated = 0;
    let risksCreated = 0;
    let risksClosed = 0;
    let embeddingFailures = 0;

    // Collect evidence and audit records for batch insertion (PERFORMANCE OPTIMIZATION)
    const evidenceRecords: EvidenceRecord[] = [];
    const auditRecords: AuditRecord[] = [];

    // Helper function to queue evidence records
    const queueEvidence = (
      entityType: 'action_item' | 'decision' | 'risk',
      entityId: string,
      evidence: { quote: string; speaker: string | null; timestamp: string | null }[]
    ) => {
      for (const e of evidence) {
        evidenceRecords.push({
          entity_type: entityType,
          entity_id: entityId,
          meeting_id: meetingId,
          quote: e.quote,
          speaker: e.speaker,
          timestamp: e.timestamp,
        });
      }
    };

    // Helper function to queue audit records
    const queueAudit = (
      actionType: 'create' | 'update' | 'close',
      entityType: 'action_item' | 'decision' | 'risk',
      entityId: string,
      before: unknown | null,
      after: unknown | null
    ) => {
      auditRecords.push({
        user_id: user.id,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        project_id: meeting.project_id,
        before_data: before,
        after_data: after,
      });
    };

    // Process accepted action items
    log.debug('Processing action items', { count: acceptedActionItems.length });
    for (const item of acceptedActionItems) {
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
        // Create new action item
        const { data: newItem, error } = await supabase
          .from('action_items')
          .insert({
            project_id: meeting.project_id,
            title: item.title,
            description: item.description,
            status: item.status,
            owner_user_id: item.owner.resolved_user_id,
            owner_name: item.owner.name,
            owner_email: item.owner.email,
            due_date: item.due_date,
            embedding,
            source_meeting_id: meetingId,
          })
          .select()
          .single();

        if (error) throw error;
        actionItemsCreated++;

        // Queue evidence records for batch insertion
        queueEvidence('action_item', newItem.id, item.evidence);

        // Queue audit log for batch insertion
        queueAudit('create', 'action_item', newItem.id, null, newItem);
      } else if (item.operation === 'update' && item.external_id) {
        // Get existing item for audit and updates array
        const { data: existing } = await supabase
          .from('action_items')
          .select('*')
          .eq('id', item.external_id)
          .single();

        // Create AI update comment describing changes (using proposed values for comparison)
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
          existing: existing || {},
          updated: proposedUpdate,
          evidence: item.evidence,
          meetingId,
          meetingTitle: meeting.title,
          publisherUserId: user.id,
          publisherName,
        });

        // Append AI comment to updates array
        const currentUpdates = parseExistingUpdates(existing?.updates);
        currentUpdates.push(aiUpdate);

        // Update existing action item - ATOMIC: include updates in same query
        const { data: updated, error } = await supabase
          .from('action_items')
          .update({
            title: item.title,
            description: item.description,
            status: item.status,
            owner_user_id: item.owner.resolved_user_id,
            owner_name: item.owner.name,
            owner_email: item.owner.email,
            due_date: item.due_date,
            embedding,
            updates: JSON.stringify(currentUpdates),
          })
          .eq('id', item.external_id)
          .select()
          .single();

        if (error) throw error;
        actionItemsUpdated++;

        // Queue evidence records for batch insertion
        queueEvidence('action_item', item.external_id, item.evidence);

        // Queue audit log for batch insertion
        queueAudit('update', 'action_item', item.external_id, existing, updated);
      } else if (item.operation === 'close' && item.external_id) {
        // Get existing item for audit and updates array
        const { data: existing } = await supabase
          .from('action_items')
          .select('*')
          .eq('id', item.external_id)
          .single();

        // Create AI update comment for closure
        const aiUpdate = createAIUpdateComment({
          operation: 'close',
          entityType: 'action_item',
          existing: existing || {},
          updated: { status: 'Closed' },
          evidence: item.evidence,
          meetingId,
          meetingTitle: meeting.title,
          publisherUserId: user.id,
          publisherName,
        });

        // Append AI comment to updates array
        const currentUpdates = parseExistingUpdates(existing?.updates);
        currentUpdates.push(aiUpdate);

        // Close action item - ATOMIC: include updates in same query
        const { data: updated, error } = await supabase
          .from('action_items')
          .update({
            status: 'Closed',
            updates: JSON.stringify(currentUpdates),
          })
          .eq('id', item.external_id)
          .select()
          .single();

        if (error) throw error;
        actionItemsClosed++;

        // Queue evidence records for batch insertion
        queueEvidence('action_item', item.external_id, item.evidence);

        // Queue audit log for batch insertion
        queueAudit('close', 'action_item', item.external_id, existing, updated);
      }
    }

    // Process accepted decisions
    log.debug('Processing decisions', { count: acceptedDecisions.length });
    for (const item of acceptedDecisions) {
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

      if (item.operation === 'create') {
        const { data: newItem, error } = await supabase
          .from('decisions')
          .insert({
            project_id: meeting.project_id,
            title: item.title,
            rationale: item.rationale,
            impact: item.impact,
            decision_maker_user_id: item.decision_maker.resolved_user_id,
            decision_maker_name: item.decision_maker.name,
            decision_maker_email: item.decision_maker.email,
            outcome: item.outcome,
            embedding,
            source_meeting_id: meetingId,
          })
          .select()
          .single();

        if (error) throw error;
        decisionsCreated++;

        // Queue evidence records for batch insertion
        queueEvidence('decision', newItem.id, item.evidence);

        // Queue audit log for batch insertion
        queueAudit('create', 'decision', newItem.id, null, newItem);
      }
    }

    // Process accepted risks
    log.debug('Processing risks', { count: acceptedRisks.length });
    for (const item of acceptedRisks) {
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
        const { data: newItem, error } = await supabase
          .from('risks')
          .insert({
            project_id: meeting.project_id,
            title: item.title,
            description: item.description,
            probability: item.probability,
            impact: item.impact,
            mitigation: item.mitigation,
            status: item.status,
            owner_user_id: item.owner.resolved_user_id,
            owner_name: item.owner.name,
            owner_email: item.owner.email,
            embedding,
            source_meeting_id: meetingId,
          })
          .select()
          .single();

        if (error) throw error;
        risksCreated++;

        // Queue evidence records for batch insertion
        queueEvidence('risk', newItem.id, item.evidence);

        // Queue audit log for batch insertion
        queueAudit('create', 'risk', newItem.id, null, newItem);
      } else if (item.operation === 'close' && item.external_id) {
        // Get existing item for audit and updates array
        const { data: existing } = await supabase
          .from('risks')
          .select('*')
          .eq('id', item.external_id)
          .single();

        // Create AI update comment for closure
        const aiUpdate = createAIUpdateComment({
          operation: 'close',
          entityType: 'risk',
          existing: existing || {},
          updated: { status: 'Closed' },
          evidence: item.evidence,
          meetingId,
          meetingTitle: meeting.title,
          publisherUserId: user.id,
          publisherName,
        });

        // Append AI comment to updates array
        const currentUpdates = parseExistingUpdates(existing?.updates);
        currentUpdates.push(aiUpdate);

        // Close risk - ATOMIC: include updates in same query
        const { data: updated, error } = await supabase
          .from('risks')
          .update({
            status: 'Closed',
            updates: JSON.stringify(currentUpdates),
          })
          .eq('id', item.external_id)
          .select()
          .single();

        if (error) throw error;
        risksClosed++;

        // Queue evidence records for batch insertion
        queueEvidence('risk', item.external_id, item.evidence);

        // Queue audit log for batch insertion
        queueAudit('close', 'risk', item.external_id, existing, updated);
      }
    }

    // PERFORMANCE OPTIMIZATION: Batch insert all evidence records in a single query
    if (evidenceRecords.length > 0) {
      log.debug('Batch inserting evidence records', { count: evidenceRecords.length });
      const { error: evidenceError } = await serviceClient.rpc('batch_insert_evidence', {
        p_evidence_records: evidenceRecords,
      });

      if (evidenceError) {
        // Fall back to individual inserts if batch fails (for backwards compatibility)
        log.warn('Batch evidence insert failed, falling back to individual inserts', {
          error: evidenceError.message,
        });
        for (const record of evidenceRecords) {
          await supabase.from('evidence').insert(record);
        }
      }
    }

    // PERFORMANCE OPTIMIZATION: Batch insert all audit logs in a single query
    if (auditRecords.length > 0) {
      log.debug('Batch inserting audit logs', { count: auditRecords.length });
      const { error: auditError } = await serviceClient.rpc('batch_create_audit_logs', {
        p_audit_records: auditRecords,
      });

      if (auditError) {
        // Fall back to individual inserts if batch fails (for backwards compatibility)
        log.warn('Batch audit log insert failed, falling back to individual inserts', {
          error: auditError.message,
        });
        for (const record of auditRecords) {
          await serviceClient.rpc('create_audit_log', {
            p_user_id: record.user_id,
            p_action_type: record.action_type,
            p_entity_type: record.entity_type,
            p_entity_id: record.entity_id,
            p_project_id: record.project_id,
            p_before: record.before_data,
            p_after: record.after_data,
          });
        }
      }
    }

    // Update meeting status to Published
    await supabase
      .from('meetings')
      .update({ status: 'Published' })
      .eq('id', meetingId);

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
      batchOperations: {
        evidenceRecords: evidenceRecords.length,
        auditRecords: auditRecords.length,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Meeting publish failed', {
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
    });
    return NextResponse.json(
      { error: 'Publish failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

