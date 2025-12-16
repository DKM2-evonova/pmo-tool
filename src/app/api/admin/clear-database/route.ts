import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';

const log = loggers.api;

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

    log.info('Starting database clear operation', { userId: user.id });

    // Track deletion counts and errors
    const deletionCounts = {
      audit_logs: 0,
      llm_metrics: 0,
      evidence: 0,
      action_items: 0,
      decisions: 0,
      risks: 0,
      meetings: 0,
    };

    const errors: string[] = [];

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
      log.error('Error deleting audit logs', { error: auditLogsError.message });
      errors.push(`audit_logs: ${auditLogsError.message}`);
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
      log.error('Error deleting LLM metrics', { error: llmMetricsError.message });
      errors.push(`llm_metrics: ${llmMetricsError.message}`);
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
      log.error('Error deleting evidence', { error: evidenceError.message });
      errors.push(`evidence: ${evidenceError.message}`);
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
      log.error('Error deleting action items', { error: actionItemsError.message });
      errors.push(`action_items: ${actionItemsError.message}`);
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
      log.error('Error deleting decisions', { error: decisionsError.message });
      errors.push(`decisions: ${decisionsError.message}`);
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
      log.error('Error deleting risks', { error: risksError.message });
      errors.push(`risks: ${risksError.message}`);
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
      log.error('Error deleting meetings', { error: meetingsError.message });
      errors.push(`meetings: ${meetingsError.message}`);
    }

    // Create audit log for this operation
    await serviceClient.rpc('create_audit_log', {
      p_user_id: user.id,
      p_action_type: 'delete',
      p_entity_type: 'system',
      p_entity_id: user.id,
      p_project_id: null,
      p_before: { operation: 'clear_database', counts: deletionCounts },
      p_after: { cleared: true, errors: errors.length > 0 ? errors : undefined },
    });

    // Return partial success if there were errors
    if (errors.length > 0) {
      log.warn('Database clear completed with errors', { errors, deletionCounts });
      return NextResponse.json({
        success: false,
        message: 'Database clear completed with errors',
        deleted: deletionCounts,
        errors,
      }, { status: 207 }); // 207 Multi-Status
    }

    log.info('Database clear completed successfully', { deletionCounts });
    return NextResponse.json({
      success: true,
      message: 'Database cleared successfully',
      deleted: deletionCounts,
    });
  } catch (error) {
    log.error('Database clear failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to clear database. Please try again.' },
      { status: 500 }
    );
  }
}
