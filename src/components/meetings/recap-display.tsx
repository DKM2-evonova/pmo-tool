'use client';

import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  MessageSquare, 
  CheckSquare, 
  AlertCircle,
  Users,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import type { MeetingRecap, MeetingTone } from '@/types/database';
import type { ToneLevel, EntityStatus } from '@/types/enums';

interface RecapDisplayProps {
  recap: MeetingRecap;
  tone?: MeetingTone | null;
  showTone?: boolean;
}

export function RecapDisplay({ recap, tone, showTone = false }: RecapDisplayProps) {
  const toneIcon = (level: ToneLevel) => {
    switch (level) {
      case 'High':
        return <TrendingUp className="h-4 w-4 text-success-500" />;
      case 'Med':
        return <Minus className="h-4 w-4 text-warning-500" />;
      case 'Low':
        return <TrendingDown className="h-4 w-4 text-danger-500" />;
    }
  };

  const toneColor = (level: ToneLevel) => {
    switch (level) {
      case 'High':
        return 'text-success-600 bg-success-50';
      case 'Med':
        return 'text-warning-600 bg-warning-50';
      case 'Low':
        return 'text-danger-600 bg-danger-50';
    }
  };

  const statusVariant = (status: EntityStatus): 'default' | 'success' | 'warning' | 'danger' => {
    switch (status) {
      case 'Closed':
        return 'success';
      case 'In Progress':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="card">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-900">
          <FileText className="h-5 w-5" />
          Executive Summary
        </h2>
        <p className="whitespace-pre-wrap text-surface-700">{recap.summary}</p>

        {recap.highlights && recap.highlights.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 font-medium text-surface-900">Key Highlights</h3>
            <ul className="space-y-2">
              {recap.highlights.map((highlight, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 rounded-lg bg-surface-50 p-3"
                >
                  <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                    {index + 1}
                  </span>
                  <span className="text-surface-700">{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Key Discussion Topics */}
      {recap.key_topics && recap.key_topics.length > 0 && (
        <div className="card">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-900">
            <MessageSquare className="h-5 w-5" />
            Key Discussion Topics
          </h2>
          <div className="space-y-4">
            {recap.key_topics.map((topic, index) => (
              <div
                key={index}
                className="rounded-lg border border-surface-200 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-medium text-surface-900">{topic.topic}</h3>
                  {topic.outcome ? (
                    <Badge variant="success">Resolved</Badge>
                  ) : (
                    <Badge variant="warning">Open</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-surface-600">{topic.discussion}</p>
                {topic.participants && topic.participants.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-surface-500">
                    <Users className="h-3 w-3" />
                    <span>{topic.participants.join(', ')}</span>
                  </div>
                )}
                {topic.outcome && (
                  <div className="mt-3 rounded-md bg-success-50 p-2">
                    <p className="text-sm text-success-700">
                      <strong>Outcome:</strong> {topic.outcome}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items Summary */}
      {recap.action_items_summary && recap.action_items_summary.length > 0 && (
        <div className="card">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-900">
            <CheckSquare className="h-5 w-5" />
            Meeting Action Items
          </h2>
          <div className="overflow-hidden rounded-lg border border-surface-200">
            <table className="min-w-full divide-y divide-surface-200">
              <thead className="bg-surface-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
                    Action Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 bg-white">
                {recap.action_items_summary.map((item, index) => (
                  <tr key={index} className="hover:bg-surface-50">
                    <td className="px-4 py-3 text-sm text-surface-900">
                      {item.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-600">
                      {item.owner}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-600">
                      {item.due_date ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(item.due_date).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-surface-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(item.status as EntityStatus)}>
                        {item.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Outstanding Topics */}
      {recap.outstanding_topics && recap.outstanding_topics.length > 0 && (
        <div className="card">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-900">
            <AlertCircle className="h-5 w-5 text-warning-500" />
            Outstanding Topics (Unresolved)
          </h2>
          <div className="space-y-4">
            {recap.outstanding_topics.map((topic, index) => (
              <div
                key={index}
                className="rounded-lg border border-warning-200 bg-warning-50/50 p-4"
              >
                <h3 className="font-medium text-surface-900">{topic.topic}</h3>
                <p className="mt-2 text-sm text-surface-600">{topic.context}</p>
                
                {topic.blockers && topic.blockers.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-medium uppercase tracking-wider text-danger-600">
                      Blockers
                    </h4>
                    <ul className="mt-1 space-y-1">
                      {topic.blockers.map((blocker, bIndex) => (
                        <li
                          key={bIndex}
                          className="flex items-start gap-2 text-sm text-surface-600"
                        >
                          <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-danger-400" />
                          {blocker}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {topic.suggested_next_steps && topic.suggested_next_steps.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-medium uppercase tracking-wider text-primary-600">
                      Suggested Next Steps
                    </h4>
                    <ul className="mt-1 space-y-1">
                      {topic.suggested_next_steps.map((step, sIndex) => (
                        <li
                          key={sIndex}
                          className="flex items-start gap-2 text-sm text-surface-600"
                        >
                          <ChevronRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary-500" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tone Analysis */}
      {showTone && tone && (
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-surface-900">
            Tone Analysis
          </h2>

          {/* Overall Tone */}
          <div className="mb-6 rounded-lg bg-surface-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-surface-500">
              Overall Meeting Tone
            </h3>
            <p className="text-surface-900">{tone.overall}</p>
          </div>

          {/* Participant Breakdown */}
          {tone.participants && tone.participants.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-surface-500">
                Participant Analysis
              </h3>
              <div className="space-y-3">
                {tone.participants.map((participant, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-surface-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-surface-900">
                        {participant.name}
                      </h4>
                      <div className="flex gap-2">
                        <span
                          className={cn(
                            'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                            toneColor(participant.happiness as ToneLevel)
                          )}
                        >
                          {toneIcon(participant.happiness as ToneLevel)}
                          Happiness: {participant.happiness}
                        </span>
                        <span
                          className={cn(
                            'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                            toneColor(participant.buy_in as ToneLevel)
                          )}
                        >
                          {toneIcon(participant.buy_in as ToneLevel)}
                          Buy-in: {participant.buy_in}
                        </span>
                      </div>
                    </div>
                    {participant.tone && (
                      <p className="mt-2 text-sm text-surface-600">
                        {participant.tone}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

