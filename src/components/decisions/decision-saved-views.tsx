'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Server,
  Workflow,
  Shield,
  CheckCircle,
  Clock,
  LayoutGrid,
} from 'lucide-react';

interface SavedView {
  id: string;
  name: string;
  icon: typeof Server;
  params: Record<string, string>;
}

const SAVED_VIEWS: SavedView[] = [
  {
    id: 'all',
    name: 'All Decisions',
    icon: LayoutGrid,
    params: {},
  },
  {
    id: 'technical',
    name: 'Technical View',
    icon: Server,
    params: {
      categories: 'TECHNOLOGY_SYSTEMS,DATA_REPORTING',
    },
  },
  {
    id: 'business-process',
    name: 'Business Process',
    icon: Workflow,
    params: {
      categories: 'PROCESS_OP_MODEL,PEOPLE_CHANGE_MGMT',
    },
  },
  {
    id: 'governance',
    name: 'Governance',
    icon: Shield,
    params: {
      categories: 'GOVERNANCE_COMPLIANCE,STRATEGY_COMMERCIAL',
    },
  },
  {
    id: 'active',
    name: 'Active Decisions',
    icon: CheckCircle,
    params: {
      statuses: 'APPROVED',
    },
  },
  {
    id: 'pending',
    name: 'Pending Review',
    icon: Clock,
    params: {
      statuses: 'PROPOSED',
    },
  },
];

interface DecisionSavedViewsProps {
  className?: string;
}

export function DecisionSavedViews({ className }: DecisionSavedViewsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view') || 'all';

  const handleViewClick = (view: SavedView) => {
    const url = new URL(window.location.href);

    // Clear existing filter params
    url.searchParams.delete('categories');
    url.searchParams.delete('impacts');
    url.searchParams.delete('statuses');
    url.searchParams.delete('view');

    if (view.id !== 'all') {
      url.searchParams.set('view', view.id);
      Object.entries(view.params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    router.push(url.pathname + url.search);
  };

  return (
    <div className={cn('space-y-1', className)}>
      <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider px-2 mb-2">
        Saved Views
      </h3>
      {SAVED_VIEWS.map((view) => {
        const Icon = view.icon;
        const isActive = currentView === view.id;

        return (
          <button
            key={view.id}
            onClick={() => handleViewClick(view)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm',
              'transition-all duration-200',
              isActive
                ? 'bg-primary-50 text-primary-700 font-medium'
                : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{view.name}</span>
          </button>
        );
      })}
    </div>
  );
}
