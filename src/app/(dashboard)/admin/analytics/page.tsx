import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  BarChart3,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default async function AdminAnalyticsPage() {
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

  // Get LLM metrics
  const { data: fallbackRate } = await supabase.rpc('get_fallback_rate_24h');

  // Get recent LLM requests
  const { data: recentMetrics } = await supabase
    .from('llm_metrics')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);

  // Get meeting processing stats
  const { data: meetings } = await supabase.from('meetings').select('status');

  const meetingStats = {
    total: meetings?.length || 0,
    published: meetings?.filter((m) => m.status === 'Published').length || 0,
    review: meetings?.filter((m) => m.status === 'Review').length || 0,
    failed: meetings?.filter((m) => m.status === 'Failed').length || 0,
    processing: meetings?.filter((m) => m.status === 'Processing').length || 0,
  };

  const fallbackData = fallbackRate?.[0] || {
    total_requests: 0,
    fallback_requests: 0,
    fallback_percentage: 0,
  };

  const isAboveThreshold = fallbackData.fallback_percentage > 15;

  // Calculate average latency
  const avgLatency =
    recentMetrics && recentMetrics.length > 0
      ? Math.round(
          recentMetrics.reduce((sum, m) => sum + m.latency_ms, 0) /
            recentMetrics.length
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Analytics</h1>
        <p className="mt-1 text-surface-500">
          Monitor LLM usage and system performance
        </p>
      </div>

      {/* Alert Banner */}
      {isAboveThreshold && (
        <div className="card border-danger-200 bg-danger-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-danger-600" />
            <div>
              <p className="font-semibold text-danger-700">
                High Fallback Usage Alert
              </p>
              <p className="text-sm text-danger-600">
                Fallback model usage is {fallbackData.fallback_percentage}% in
                the last 24 hours, exceeding the 15% threshold.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* LLM Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
              <BarChart3 className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900">
                {fallbackData.total_requests}
              </p>
              <p className="text-sm text-surface-500">LLM Requests (24h)</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                isAboveThreshold ? 'bg-danger-50' : 'bg-success-50'
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 ${
                  isAboveThreshold ? 'text-danger-600' : 'text-success-600'
                }`}
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900">
                {fallbackData.fallback_percentage}%
              </p>
              <p className="text-sm text-surface-500">Fallback Rate</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100">
              <Clock className="h-5 w-5 text-surface-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900">
                {avgLatency}ms
              </p>
              <p className="text-sm text-surface-500">Avg Latency</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-50">
              <CheckCircle className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900">
                {recentMetrics?.filter((m) => m.success).length || 0}/
                {recentMetrics?.length || 0}
              </p>
              <p className="text-sm text-surface-500">Success Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Meeting Processing Stats */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-surface-900">
          Meeting Processing
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg bg-surface-50 p-4 text-center">
            <p className="text-2xl font-bold text-surface-900">
              {meetingStats.total}
            </p>
            <p className="text-sm text-surface-500">Total</p>
          </div>
          <div className="rounded-lg bg-success-50 p-4 text-center">
            <p className="text-2xl font-bold text-success-700">
              {meetingStats.published}
            </p>
            <p className="text-sm text-success-600">Published</p>
          </div>
          <div className="rounded-lg bg-warning-50 p-4 text-center">
            <p className="text-2xl font-bold text-warning-700">
              {meetingStats.review}
            </p>
            <p className="text-sm text-warning-600">In Review</p>
          </div>
          <div className="rounded-lg bg-primary-50 p-4 text-center">
            <p className="text-2xl font-bold text-primary-700">
              {meetingStats.processing}
            </p>
            <p className="text-sm text-primary-600">Processing</p>
          </div>
          <div className="rounded-lg bg-danger-50 p-4 text-center">
            <p className="text-2xl font-bold text-danger-700">
              {meetingStats.failed}
            </p>
            <p className="text-sm text-danger-600">Failed</p>
          </div>
        </div>
      </div>

      {/* Recent LLM Requests */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-surface-900">
          Recent LLM Requests
        </h2>
        {recentMetrics && recentMetrics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 text-left">
                  <th className="pb-3 text-sm font-medium text-surface-500">
                    Time
                  </th>
                  <th className="pb-3 text-sm font-medium text-surface-500">
                    Model
                  </th>
                  <th className="pb-3 text-sm font-medium text-surface-500">
                    Status
                  </th>
                  <th className="pb-3 text-sm font-medium text-surface-500">
                    Latency
                  </th>
                  <th className="pb-3 text-sm font-medium text-surface-500">
                    Fallback
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {recentMetrics.slice(0, 20).map((metric) => (
                  <tr key={metric.id}>
                    <td className="py-3 text-sm text-surface-600">
                      {new Date(metric.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 text-sm text-surface-900">
                      {metric.model}
                    </td>
                    <td className="py-3">
                      {metric.success ? (
                        <span className="badge-success">Success</span>
                      ) : (
                        <span className="badge-danger">Failed</span>
                      )}
                    </td>
                    <td className="py-3 text-sm text-surface-600">
                      {metric.latency_ms}ms
                    </td>
                    <td className="py-3">
                      {metric.is_fallback ? (
                        <span className="badge-warning">Yes</span>
                      ) : (
                        <span className="badge-neutral">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-surface-500">No LLM requests recorded yet</p>
        )}
      </div>
    </div>
  );
}

