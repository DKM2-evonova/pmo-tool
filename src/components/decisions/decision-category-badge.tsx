'use client';

import { cn } from '@/lib/utils';
import {
  DecisionCategory,
  DecisionCategoryLabel,
  DecisionCategoryPrefix,
} from '@/types/enums';
import {
  Workflow,
  Server,
  Database,
  Users,
  Shield,
  TrendingUp,
} from 'lucide-react';

interface DecisionCategoryBadgeProps {
  category: DecisionCategory;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const categoryConfig: Record<
  DecisionCategory,
  {
    bg: string;
    text: string;
    border: string;
    icon: typeof Workflow;
  }
> = {
  [DecisionCategory.ProcessOpModel]: {
    bg: 'bg-blue-50/80',
    text: 'text-blue-700',
    border: 'border-blue-200/50',
    icon: Workflow,
  },
  [DecisionCategory.TechnologySystems]: {
    bg: 'bg-purple-50/80',
    text: 'text-purple-700',
    border: 'border-purple-200/50',
    icon: Server,
  },
  [DecisionCategory.DataReporting]: {
    bg: 'bg-cyan-50/80',
    text: 'text-cyan-700',
    border: 'border-cyan-200/50',
    icon: Database,
  },
  [DecisionCategory.PeopleChangeMgmt]: {
    bg: 'bg-orange-50/80',
    text: 'text-orange-700',
    border: 'border-orange-200/50',
    icon: Users,
  },
  [DecisionCategory.GovernanceCompliance]: {
    bg: 'bg-red-50/80',
    text: 'text-red-700',
    border: 'border-red-200/50',
    icon: Shield,
  },
  [DecisionCategory.StrategyCommercial]: {
    bg: 'bg-green-50/80',
    text: 'text-green-700',
    border: 'border-green-200/50',
    icon: TrendingUp,
  },
};

export function DecisionCategoryBadge({
  category,
  showLabel = false,
  size = 'md',
  className,
}: DecisionCategoryBadgeProps) {
  const config = categoryConfig[category];
  const Icon = config.icon;
  const prefix = DecisionCategoryPrefix[category];
  const label = DecisionCategoryLabel[category];

  const sizes = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        'transition-all duration-200 border',
        config.bg,
        config.text,
        config.border,
        sizes[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      <span className="font-semibold">{prefix}</span>
      {showLabel && <span className="opacity-80">- {label}</span>}
    </span>
  );
}
