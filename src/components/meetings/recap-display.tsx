'use client';

import { FileText, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingRecap, MeetingTone, ParticipantTone } from '@/types/database';
import type { ToneLevel } from '@/types/enums';

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

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="card">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-surface-900">
          <FileText className="h-5 w-5" />
          Meeting Recap
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

