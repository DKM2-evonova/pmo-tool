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
 */
function parseExistingUpdates(updatesJson: string | null | undefined): unknown[] {
  if (!updatesJson) return [];
  try {
    const parsed = JSON.parse(updatesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

        // Create evidence records
        for (const evidence of item.evidence) {
          await supabase.from('evidence').insert({
            entity_type: 'action_item',
            entity_id: newItem.id,
            meeting_id: meetingId,
            quote: evidence.quote,
            speaker: evidence.speaker,
            timestamp: evidence.timestamp,
          });
        }

        // Audit log
        await serviceClient.rpc('create_audit_log', {
          p_user_id: user.id,
          p_action_type: 'create',
          p_entity_type: 'action_item',
          p_entity_id: newItem.id,
          p_project_id: meeting.project_id,
          p_before: null,
          p_after: newItem,
        });
      } else if (item.operation === 'update' && item.external_id) {
        // Get existing item for audit and updates array
        const { data: existing } = await supabase
          .from('action_items')
          .select('*')
          .eq('id', item.external_id)
          .single();

        // Update existing action item
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
          })
          .eq('id', item.external_id)
          .select()
          .single();

        if (error) throw error;
        actionItemsUpdated++;

        // Create AI update comment describing changes
        const aiUpdate = createAIUpdateComment({
          operation: 'update',
          entityType: 'action_item',
          existing: existing || {},
          updated: updated || {},
          evidence: item.evidence,
          meetingId,
          meetingTitle: meeting.title,
          publisherUserId: user.id,
          publisherName,
        });

        // Append AI comment to updates array
        const currentUpdates = parseExistingUpdates(existing?.updates);
        currentUpdates.push(aiUpdate);

        await supabase
          .from('action_items')
          .update({ updates: JSON.stringify(currentUpdates) })
          .eq('id', item.external_id);

        // Create evidence records
        for (const evidence of item.evidence) {
          await supabase.from('evidence').insert({
            entity_type: 'action_item',
            entity_id: item.external_id,
            meeting_id: meetingId,
            quote: evidence.quote,
            speaker: evidence.speaker,
            timestamp: evidence.timestamp,
          });
        }

        // Audit log
        await serviceClient.rpc('create_audit_log', {
          p_user_id: user.id,
          p_action_type: 'update',
          p_entity_type: 'action_item',
          p_entity_id: item.external_id,
          p_project_id: meeting.project_id,
          p_before: existing,
          p_after: updated,
        });
      } else if (item.operation === 'close' && item.external_id) {
        // Get existing item for audit and updates array
        const { data: existing } = await supabase
          .from('action_items')
          .select('*')
          .eq('id', item.external_id)
          .single();

        // Close action item
        const { data: updated, error } = await supabase
          .from('action_items')
          .update({ status: 'Closed' })
          .eq('id', item.external_id)
          .select()
          .single();

        if (error) throw error;
        actionItemsClosed++;

        // Create AI update comment for closure
        const aiUpdate = createAIUpdateComment({
          operation: 'close',
          entityType: 'action_item',
          existing: existing || {},
          updated: updated || {},
          evidence: item.evidence,
          meetingId,
          meetingTitle: meeting.title,
          publisherUserId: user.id,
          publisherName,
        });

        // Append AI comment to updates array
        const currentUpdates = parseExistingUpdates(existing?.updates);
        currentUpdates.push(aiUpdate);

        await supabase
          .from('action_items')
          .update({ updates: JSON.stringify(currentUpdates) })
          .eq('id', item.external_id);

        // Create evidence records for the close action
        for (const evidence of item.evidence) {
          await supabase.from('evidence').insert({
            entity_type: 'action_item',
            entity_id: item.external_id,
            meeting_id: meetingId,
            quote: evidence.quote,
            speaker: evidence.speaker,
            timestamp: evidence.timestamp,
          });
        }

        // Audit log
        await serviceClient.rpc('create_audit_log', {
          p_user_id: user.id,
          p_action_type: 'close',
          p_entity_type: 'action_item',
          p_entity_id: item.external_id,
          p_project_id: meeting.project_id,
          p_before: existing,
          p_after: updated,
        });
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

        // Create evidence records
        for (const evidence of item.evidence) {
          await supabase.from('evidence').insert({
            entity_type: 'decision',
            entity_id: newItem.id,
            meeting_id: meetingId,
            quote: evidence.quote,
            speaker: evidence.speaker,
            timestamp: evidence.timestamp,
          });
        }

        // Audit log
        await serviceClient.rpc('create_audit_log', {
          p_user_id: user.id,
          p_action_type: 'create',
          p_entity_type: 'decision',
          p_entity_id: newItem.id,
          p_project_id: meeting.project_id,
          p_before: null,
          p_after: newItem,
        });
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

        // Create evidence records
        for (const evidence of item.evidence) {
          await supabase.from('evidence').insert({
            entity_type: 'risk',
            entity_id: newItem.id,
            meeting_id: meetingId,
            quote: evidence.quote,
            speaker: evidence.speaker,
            timestamp: evidence.timestamp,
          });
        }

        // Audit log
        await serviceClient.rpc('create_audit_log', {
          p_user_id: user.id,
          p_action_type: 'create',
          p_entity_type: 'risk',
          p_entity_id: newItem.id,
          p_project_id: meeting.project_id,
          p_before: null,
          p_after: newItem,
        });
      } else if (item.operation === 'close' && item.external_id) {
        // Get existing item for audit and updates array
        const { data: existing } = await supabase
          .from('risks')
          .select('*')
          .eq('id', item.external_id)
          .single();

        const { data: updated, error } = await supabase
          .from('risks')
          .update({ status: 'Closed' })
          .eq('id', item.external_id)
          .select()
          .single();

        if (error) throw error;
        risksClosed++;

        // Create AI update comment for closure
        const aiUpdate = createAIUpdateComment({
          operation: 'close',
          entityType: 'risk',
          existing: existing || {},
          updated: updated || {},
          evidence: item.evidence,
          meetingId,
          meetingTitle: meeting.title,
          publisherUserId: user.id,
          publisherName,
        });

        // Append AI comment to updates array
        const currentUpdates = parseExistingUpdates(existing?.updates);
        currentUpdates.push(aiUpdate);

        await supabase
          .from('risks')
          .update({ updates: JSON.stringify(currentUpdates) })
          .eq('id', item.external_id);

        // Create evidence records for the close action
        for (const evidence of item.evidence) {
          await supabase.from('evidence').insert({
            entity_type: 'risk',
            entity_id: item.external_id,
            meeting_id: meetingId,
            quote: evidence.quote,
            speaker: evidence.speaker,
            timestamp: evidence.timestamp,
          });
        }

        // Audit log
        await serviceClient.rpc('create_audit_log', {
          p_user_id: user.id,
          p_action_type: 'close',
          p_entity_type: 'risk',
          p_entity_id: item.external_id,
          p_project_id: meeting.project_id,
          p_before: existing,
          p_after: updated,
        });
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

