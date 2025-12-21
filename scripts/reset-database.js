#!/usr/bin/env node
/**
 * Reset script to clear all data from the database for testing
 * Uses service role key to bypass RLS and authentication
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      env[key] = value;
    }
  });
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  console.error('\nPlease ensure .env.local is configured correctly.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function clearDatabase() {
  console.log('🔄 Starting database reset...\n');

  const deletionCounts = {
    audit_logs: 0,
    llm_metrics: 0,
    evidence: 0,
    action_items: 0,
    decisions: 0,
    risks: 0,
    meetings: 0,
  };

  try {
    // 1. Delete audit logs
    console.log('Deleting audit logs...');
    const { data: auditLogs } = await supabase.from('audit_logs').select('id');
    deletionCounts.audit_logs = auditLogs?.length || 0;
    const { error: auditLogsError } = await supabase
      .from('audit_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (auditLogsError) {
      console.error('  ⚠️  Error:', auditLogsError.message);
    } else {
      console.log(`  ✓ Deleted ${deletionCounts.audit_logs} audit logs`);
    }

    // 2. Delete LLM metrics
    console.log('Deleting LLM metrics...');
    const { data: llmMetrics } = await supabase.from('llm_metrics').select('id');
    deletionCounts.llm_metrics = llmMetrics?.length || 0;
    const { error: llmMetricsError } = await supabase
      .from('llm_metrics')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (llmMetricsError) {
      console.error('  ⚠️  Error:', llmMetricsError.message);
    } else {
      console.log(`  ✓ Deleted ${deletionCounts.llm_metrics} LLM metrics`);
    }

    // 3. Delete evidence records
    console.log('Deleting evidence records...');
    const { data: evidence } = await supabase.from('evidence').select('id');
    deletionCounts.evidence = evidence?.length || 0;
    const { error: evidenceError } = await supabase
      .from('evidence')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (evidenceError) {
      console.error('  ⚠️  Error:', evidenceError.message);
    } else {
      console.log(`  ✓ Deleted ${deletionCounts.evidence} evidence records`);
    }

    // 4. Delete action items
    console.log('Deleting action items...');
    const { data: actionItems } = await supabase.from('action_items').select('id');
    deletionCounts.action_items = actionItems?.length || 0;
    const { error: actionItemsError } = await supabase
      .from('action_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (actionItemsError) {
      console.error('  ⚠️  Error:', actionItemsError.message);
    } else {
      console.log(`  ✓ Deleted ${deletionCounts.action_items} action items`);
    }

    // 5. Delete decisions
    console.log('Deleting decisions...');
    const { data: decisions } = await supabase.from('decisions').select('id');
    deletionCounts.decisions = decisions?.length || 0;
    const { error: decisionsError } = await supabase
      .from('decisions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (decisionsError) {
      console.error('  ⚠️  Error:', decisionsError.message);
    } else {
      console.log(`  ✓ Deleted ${deletionCounts.decisions} decisions`);
    }

    // 6. Delete risks
    console.log('Deleting risks...');
    const { data: risks } = await supabase.from('risks').select('id');
    deletionCounts.risks = risks?.length || 0;
    const { error: risksError } = await supabase
      .from('risks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (risksError) {
      console.error('  ⚠️  Error:', risksError.message);
    } else {
      console.log(`  ✓ Deleted ${deletionCounts.risks} risks`);
    }

    // 7. Delete meetings
    console.log('Deleting meetings...');
    const { data: meetings } = await supabase.from('meetings').select('id');
    deletionCounts.meetings = meetings?.length || 0;
    const { error: meetingsError } = await supabase
      .from('meetings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (meetingsError) {
      console.error('  ⚠️  Error:', meetingsError.message);
    } else {
      console.log(`  ✓ Deleted ${deletionCounts.meetings} meetings`);
    }

    console.log('\n✅ Database reset complete!');
    console.log('\nSummary:');
    console.log(JSON.stringify(deletionCounts, null, 2));
  } catch (error) {
    console.error('\n❌ Error resetting database:', error);
    process.exit(1);
  }
}

clearDatabase();








