'use client';

import { useState } from 'react';
import {
  Briefcase,
  Shield,
  Search,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingCategory } from '@/types/enums';

interface CategorySelectorProps {
  value: MeetingCategory | '';
  onChange: (category: MeetingCategory) => void;
}

const categories: Array<{
  id: MeetingCategory;
  name: string;
  bestFor: string;
  description: string;
  uniqueFeature: string;
  outputs: string[];
  examples: string[];
  icon: typeof Briefcase;
  color: string;
  selectedColor: string;
}> = [
  {
    id: 'Project',
    name: 'Project',
    bestFor: 'Tracking tasks and progress',
    description: 'Standard project meetings where work gets assigned and tracked.',
    uniqueFeature: 'Focuses on action items with owners and due dates',
    outputs: ['Meeting Recap', 'Action Items', 'Risks & Issues'],
    examples: ['Sprint planning', 'Status updates', 'Working sessions'],
    icon: Briefcase,
    color: 'bg-primary-50 text-primary-600 border-primary-200',
    selectedColor: 'border-primary-500 bg-primary-50 ring-2 ring-primary-200',
  },
  {
    id: 'Governance',
    name: 'Governance',
    bestFor: 'Formal decisions that need documentation',
    description: 'Executive or steering meetings where key decisions are made.',
    uniqueFeature: 'Requires documented outcomes for every decision',
    outputs: ['Executive Summary', 'Decisions with Outcomes', 'Strategic Risks'],
    examples: ['Board meetings', 'Steering committees', 'Budget reviews'],
    icon: Shield,
    color: 'bg-success-50 text-success-600 border-success-200',
    selectedColor: 'border-success-500 bg-success-50 ring-2 ring-success-200',
  },
  {
    id: 'Discovery',
    name: 'Discovery',
    bestFor: 'Gathering requirements and insights',
    description: 'Exploratory meetings to understand needs and capture learnings.',
    uniqueFeature: 'Captures detailed insights and preliminary decisions',
    outputs: ['Comprehensive Recap', 'Key Findings', 'Follow-up Actions'],
    examples: ['Stakeholder interviews', 'Requirements sessions', 'Research debriefs'],
    icon: Search,
    color: 'bg-warning-50 text-warning-600 border-warning-200',
    selectedColor: 'border-warning-500 bg-warning-50 ring-2 ring-warning-200',
  },
  {
    id: 'Alignment',
    name: 'Alignment',
    bestFor: 'Understanding how people feel about changes',
    description: 'Meetings focused on getting buy-in and gauging sentiment.',
    uniqueFeature: 'Analyzes participant sentiment and buy-in levels',
    outputs: ['Discussion Recap', 'Tone Analysis', 'Participant Sentiment'],
    examples: ['Retrospectives', 'Change management', 'Feedback sessions'],
    icon: Users,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    selectedColor: 'border-purple-500 bg-purple-50 ring-2 ring-purple-200',
  },
  {
    id: 'Remediation',
    name: 'Remediation',
    bestFor: 'Analyzing problems and finding root causes',
    description: 'Post-incident or problem-solving meetings.',
    uniqueFeature: 'Generates fishbone diagram for root cause analysis',
    outputs: ['Incident Recap', 'Fishbone Diagram', 'Corrective Actions'],
    examples: ['Incident reviews', 'Post-mortems', 'Problem resolution'],
    icon: AlertTriangle,
    color: 'bg-danger-50 text-danger-600 border-danger-200',
    selectedColor: 'border-danger-500 bg-danger-50 ring-2 ring-danger-200',
  },
];

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const [expandedId, setExpandedId] = useState<MeetingCategory | null>(null);

  const toggleDetails = (e: React.MouseEvent, categoryId: MeetingCategory) => {
    e.stopPropagation();
    setExpandedId(expandedId === categoryId ? null : categoryId);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => {
        const isSelected = value === category.id;
        const isExpanded = expandedId === category.id;

        return (
          <div
            key={category.id}
            className={cn(
              'flex flex-col rounded-lg border-2 transition-all',
              isSelected
                ? category.selectedColor
                : 'border-surface-200 hover:border-surface-300'
            )}
          >
            {/* Main clickable area */}
            <button
              onClick={() => onChange(category.id)}
              className={cn(
                'flex flex-col items-start p-4 text-left transition-all rounded-t-lg',
                !isSelected && 'hover:bg-surface-50'
              )}
            >
              {/* Header row with icon and name */}
              <div className="flex items-center gap-3 w-full">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
                    category.color
                  )}
                >
                  <category.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-surface-900">
                    {category.name}
                  </h3>
                  <p className="text-sm text-primary-600 font-medium">
                    {category.bestFor}
                  </p>
                </div>
              </div>

              {/* Unique feature callout */}
              <div className="mt-3 flex items-start gap-2 w-full">
                <Sparkles className="h-4 w-4 text-warning-500 shrink-0 mt-0.5" />
                <p className="text-sm text-surface-600">
                  {category.uniqueFeature}
                </p>
              </div>

              {/* Output badges */}
              <div className="mt-3 flex flex-wrap gap-1">
                {category.outputs.map((output) => (
                  <span
                    key={output}
                    className="rounded bg-surface-100 px-2 py-0.5 text-xs text-surface-600"
                  >
                    {output}
                  </span>
                ))}
              </div>
            </button>

            {/* Show more toggle */}
            <button
              onClick={(e) => toggleDetails(e, category.id)}
              className="flex items-center justify-center gap-1 py-2 text-xs text-surface-500 hover:text-surface-700 hover:bg-surface-50 border-t border-surface-100 transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Less details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  More details
                </>
              )}
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-surface-100 bg-surface-50/50 rounded-b-lg">
                <p className="text-sm text-surface-600 mb-3">
                  {category.description}
                </p>
                <div>
                  <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-1">
                    Examples
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {category.examples.map((example) => (
                      <span
                        key={example}
                        className="rounded-full bg-surface-200 px-2 py-0.5 text-xs text-surface-700"
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

