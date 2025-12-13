import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Settings, Shield, Bell, Database } from 'lucide-react';

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', user?.id)
    .single();

  if (profile?.global_role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Settings</h1>
        <p className="mt-1 text-surface-500">
          Configure system-wide settings
        </p>
      </div>

      {/* LLM Configuration */}
      <div className="card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
            <Shield className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900">
              LLM Configuration
            </h2>
            <p className="text-sm text-surface-500">
              Configure AI model settings
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-surface-200 p-4">
            <div>
              <p className="font-medium text-surface-900">Primary Model</p>
              <p className="text-sm text-surface-500">
                Gemini 1.5 Pro (recaps, decisions, risk analysis)
              </p>
            </div>
            <span className="badge-success">Active</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-surface-200 p-4">
            <div>
              <p className="font-medium text-surface-900">Fallback Model</p>
              <p className="text-sm text-surface-500">
                GPT-4o (used if Gemini fails)
              </p>
            </div>
            <span className="badge-neutral">Standby</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-surface-200 p-4">
            <div>
              <p className="font-medium text-surface-900">Utility Model</p>
              <p className="text-sm text-surface-500">
                Gemini Flash (JSON validation/repair)
              </p>
            </div>
            <span className="badge-success">Active</span>
          </div>
        </div>
      </div>

      {/* Alert Thresholds */}
      <div className="card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-50">
            <Bell className="h-5 w-5 text-warning-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900">
              Alert Thresholds
            </h2>
            <p className="text-sm text-surface-500">
              Configure monitoring alerts
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-900">
                Fallback Usage Alert
              </p>
              <p className="text-sm text-surface-500">
                Alert when fallback exceeds threshold in 24h
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={15}
                className="input w-20 text-center"
                disabled
              />
              <span className="text-surface-500">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-surface-900">
                Processing Timeout
              </p>
              <p className="text-sm text-surface-500">
                Maximum time for transcript processing
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={60}
                className="input w-20 text-center"
                disabled
              />
              <span className="text-surface-500">seconds</span>
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Detection */}
      <div className="card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100">
            <Database className="h-5 w-5 text-surface-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900">
              Duplicate Detection
            </h2>
            <p className="text-sm text-surface-500">
              Configure semantic matching
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-surface-900">Similarity Threshold</p>
            <p className="text-sm text-surface-500">
              Flag as duplicate when similarity exceeds threshold
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              defaultValue={0.85}
              step={0.05}
              min={0.5}
              max={1.0}
              className="input w-24 text-center"
              disabled
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-surface-100 p-4 text-center text-sm text-surface-500">
        Settings configuration requires environment variable changes.
        <br />
        See deployment documentation for details.
      </div>
    </div>
  );
}

