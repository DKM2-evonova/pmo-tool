'use client';

import { cn } from '@/lib/utils';
import { DecisionImpactArea, DecisionImpactAreaLabel } from '@/types/enums';
import {
  Target,
  DollarSign,
  Clock,
  AlertTriangle,
  Heart,
} from 'lucide-react';

interface DecisionImpactChipsProps {
  impactAreas: DecisionImpactArea[];
  size?: 'sm' | 'md';
  maxDisplay?: number;
  className?: string;
}

const impactConfig: Record<
  DecisionImpactArea,
  {
    bg: string;
    text: string;
    icon: typeof Target;
    shortLabel: string;
  }
> = {
  [DecisionImpactArea.Scope]: {
    bg: 'bg-indigo-50/80',
    text: 'text-indigo-600',
    icon: Target,
    shortLabel: 'Scope',
  },
  [DecisionImpactArea.CostBudget]: {
    bg: 'bg-emerald-50/80',
    text: 'text-emerald-600',
    icon: DollarSign,
    shortLabel: 'Cost',
  },
  [DecisionImpactArea.TimeSchedule]: {
    bg: 'bg-amber-50/80',
    text: 'text-amber-600',
    icon: Clock,
    shortLabel: 'Time',
  },
  [DecisionImpactArea.Risk]: {
    bg: 'bg-rose-50/80',
    text: 'text-rose-600',
    icon: AlertTriangle,
    shortLabel: 'Risk',
  },
  [DecisionImpactArea.CustomerExp]: {
    bg: 'bg-pink-50/80',
    text: 'text-pink-600',
    icon: Heart,
    shortLabel: 'CX',
  },
};

export function DecisionImpactChips({
  impactAreas,
  size = 'md',
  maxDisplay = 5,
  className,
}: DecisionImpactChipsProps) {
  const displayAreas = impactAreas.slice(0, maxDisplay);
  const remaining = impactAreas.length - maxDisplay;

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px] gap-0.5',
    md: 'px-2 py-0.5 text-xs gap-1',
  };

  const iconSizes = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
  };

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {displayAreas.map((area) => {
        const config = impactConfig[area];
        const Icon = config.icon;
        return (
          <span
            key={area}
            title={DecisionImpactAreaLabel[area]}
            className={cn(
              'inline-flex items-center rounded font-medium',
              'transition-all duration-200',
              config.bg,
              config.text,
              sizes[size]
            )}
          >
            <Icon className={iconSizes[size]} />
            <span>{config.shortLabel}</span>
          </span>
        );
      })}
      {remaining > 0 && (
        <span
          className={cn(
            'inline-flex items-center rounded font-medium',
            'bg-surface-100/80 text-surface-500',
            sizes[size]
          )}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}
