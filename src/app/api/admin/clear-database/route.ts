import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    if (profile?.global_role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Track deletion counts
    const deletionCounts = {
      audit_logs: 0,
      llm_metrics: 0,
      evidence: 0,
      action_items: 0,
      decisions: 0,
      risks: 0,
      meetings: 0,
    };

    // Delete in order of dependencies (child tables first)
    // Using service client to bypass RLS for admin operations

    // 1. Delete audit logs
    const { data: auditLogs } = await serviceClient
      .from('audit_logs')
      .select('id');
    deletionCounts.audit_logs = auditLogs?.length || 0;

    const { error: auditLogsError } = await serviceClient
      .from('audit_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (workaround for no .delete().all())

    if (auditLogsError) {
      console.error('Error deleting audit logs:', auditLogsError);
    }

    // 2. Delete LLM metrics
    const { data: llmMetrics } = await serviceClient
      .from('llm_metrics')
      .select('id');
    deletionCounts.llm_metrics = llmMetrics?.length || 0;

    const { error: llmMetricsError } = await serviceClient
      .from('llm_metrics')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (llmMetricsError) {
      console.error('Error deleting LLM metrics:', llmMetricsError);
    }

    // 3. Delete evidence records
    const { data: evidence } = await serviceClient
      .from('evidence')
      .select('id');
    deletionCounts.evidence = evidence?.length || 0;

    const { error: evidenceError } = await serviceClient
      .from('evidence')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (evidenceError) {
      console.error('Error deleting evidence:', evidenceError);
    }

    // 4. Delete action items
    const { data: actionItems } = await serviceClient
      .from('action_items')
      .select('id');
    deletionCounts.action_items = actionItems?.length || 0;

    const { error: actionItemsError } = await serviceClient
      .from('action_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (actionItemsError) {
      console.error('Error deleting action items:', actionItemsError);
    }

    // 5. Delete decisions
    const { data: decisions } = await serviceClient
      .from('decisions')
      .select('id');
    deletionCounts.decisions = decisions?.length || 0;

    const { error: decisionsError } = await serviceClient
      .from('decisions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (decisionsError) {
      console.error('Error deleting decisions:', decisionsError);
    }

    // 6. Delete risks
    const { data: risks } = await serviceClient
      .from('risks')
      .select('id');
    deletionCounts.risks = risks?.length || 0;

    const { error: risksError } = await serviceClient
      .from('risks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (risksError) {
      console.error('Error deleting risks:', risksError);
    }

    // 7. Delete meetings (hard delete all meetings)
    const { data: meetings } = await serviceClient
      .from('meetings')
      .select('id');
    deletionCounts.meetings = meetings?.length || 0;

    const { error: meetingsError } = await serviceClient
      .from('meetings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (meetingsError) {
      console.error('Error deleting meetings:', meetingsError);
    }

    // Create audit log for this operation
    await serviceClient.rpc('create_audit_log', {
      p_user_id: user.id,
      p_action_type: 'delete',
      p_entity_type: 'system',
      p_entity_id: user.id,
      p_project_id: null,
      p_before: { operation: 'clear_database', counts: deletionCounts },
      p_after: { cleared: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Database cleared successfully',
      deleted: deletionCounts,
    });
  } catch (error) {
    console.error('Database clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear database: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
