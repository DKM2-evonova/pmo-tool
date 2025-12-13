'use client';

import {
  Briefcase,
  Shield,
  Search,
  Users,
  AlertTriangle,
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
  description: string;
  outputs: string[];
  icon: typeof Briefcase;
  color: string;
}> = [
  {
    id: 'Project',
    name: 'Project',
    description: 'Regular project meetings, status updates, and working sessions',
    outputs: ['Recap', 'Action Items', 'Risks/Issues'],
    icon: Briefcase,
    color: 'bg-primary-50 text-primary-600 border-primary-200',
  },
  {
    id: 'Governance',
    name: 'Governance',
    description: 'Steering committee, board meetings, and strategic reviews',
    outputs: ['Recap', 'Decisions (with outcomes)', 'Strategic Risks'],
    icon: Shield,
    color: 'bg-success-50 text-success-600 border-success-200',
  },
  {
    id: 'Discovery',
    name: 'Discovery',
    description: 'Requirements gathering, interviews, and exploration sessions',
    outputs: ['Detailed Recap', 'Action Items', 'Decisions'],
    icon: Search,
    color: 'bg-warning-50 text-warning-600 border-warning-200',
  },
  {
    id: 'Alignment',
    name: 'Alignment',
    description: 'Stakeholder alignment, team retrospectives, and feedback sessions',
    outputs: ['Recap', 'Tone Analysis (overall + per participant)'],
    icon: Users,
    color: 'bg-surface-100 text-surface-600 border-surface-300',
  },
  {
    id: 'Remediation',
    name: 'Remediation',
    description: 'Incident reviews, root cause analysis, and corrective actions',
    outputs: ['Detailed Recap', 'Fishbone Diagram', 'RAID Items'],
    icon: AlertTriangle,
    color: 'bg-danger-50 text-danger-600 border-danger-200',
  },
];

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => {
        const isSelected = value === category.id;
        return (
          <button
            key={category.id}
            onClick={() => onChange(category.id)}
            className={cn(
              'flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all',
              isSelected
                ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                category.color
              )}
            >
              <category.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-semibold text-surface-900">
              {category.name}
            </h3>
            <p className="mt-1 text-sm text-surface-500">
              {category.description}
            </p>
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
        );
      })}
    </div>
  );
}

