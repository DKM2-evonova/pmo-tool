'use client';

import { CheckSquare, AlertTriangle, FileText, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'action-items' | 'risks' | 'decisions' | 'milestones';

interface ReportTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  counts: {
    'action-items': number;
    'risks': number;
    'decisions': number;
    'milestones': number;
  };
}

export function ReportTabs({ activeTab, onTabChange, counts }: ReportTabsProps) {
  const tabs = [
    {
      id: 'action-items' as TabType,
      label: 'Action Items',
      icon: CheckSquare,
      count: counts['action-items'],
    },
    {
      id: 'risks' as TabType,
      label: 'Risks/Issues',
      icon: AlertTriangle,
      count: counts['risks'],
    },
    {
      id: 'decisions' as TabType,
      label: 'Key Decisions',
      icon: FileText,
      count: counts['decisions'],
    },
    {
      id: 'milestones' as TabType,
      label: 'Milestones',
      icon: Flag,
      count: counts['milestones'],
    },
  ];

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-surface-200 bg-white p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-primary-50 text-primary-700'
              : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700'
          )}
        >
          <tab.icon className="h-4 w-4" />
          <span>{tab.label}</span>
          <span
            className={cn(
              'ml-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              activeTab === tab.id
                ? 'bg-primary-100 text-primary-700'
                : 'bg-surface-100 text-surface-500'
            )}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}
