import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/embeddings/client';
import type {
  ProposedActionItem,
  ProposedDecision,
  ProposedRisk,
} from '@/types/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const { meetingId } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Check lock
    if (changeSet.locked_by_user_id && changeSet.locked_by_user_id !== user.id) {
      const lockTime = new Date(changeSet.locked_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - lockTime.getTime()) / 1000 / 60;

      if (diffMinutes < 30) {
        return NextResponse.json(
          { error: 'Meeting is locked by another user' },
          { status: 409 }
        );
      }
    }

    const proposedItems = changeSet.proposed_items as {
      action_items: ProposedActionItem[];
      decisions: ProposedDecision[];
      risks: ProposedRisk[];
    };

    // Process accepted action items
    for (const item of proposedItems.action_items.filter((ai) => ai.accepted)) {
      const text = `${item.title}. ${item.description}`;
      let embedding: number[] | null = null;

      try {
        embedding = await generateEmbedding(text);
      } catch (e) {
        console.error('Failed to generate embedding:', e);
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
        // Get existing item for audit
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
        // Get existing item for audit
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
    for (const item of proposedItems.decisions.filter((d) => d.accepted)) {
      const text = `${item.title}. ${item.rationale}`;
      let embedding: number[] | null = null;

      try {
        embedding = await generateEmbedding(text);
      } catch (e) {
        console.error('Failed to generate embedding:', e);
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
    for (const item of proposedItems.risks.filter((r) => r.accepted)) {
      const text = `${item.title}. ${item.description}`;
      let embedding: number[] | null = null;

      try {
        embedding = await generateEmbedding(text);
      } catch (e) {
        console.error('Failed to generate embedding:', e);
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: 'Publish failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

