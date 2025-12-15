'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

type SortField = 'date' | 'title' | 'decisionMaker';
type SortDirection = 'asc' | 'desc';

interface DecisionSortProps {
  currentSort?: { field: SortField; direction: SortDirection };
}

export function DecisionSort({ currentSort }: DecisionSortProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSortChange = (field: SortField) => {
    const url = new URL(window.location.href);

    if (currentSort?.field === field) {
      // Toggle direction
      const newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
      url.searchParams.set('sort', `${field}:${newDirection}`);
    } else {
      // New field, default to ascending
      url.searchParams.set('sort', `${field}:asc`);
    }

    router.push(url.toString());
  };

  const getSortIcon = (field: SortField) => {
    if (currentSort?.field !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return currentSort.direction === 'asc'
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  return (
    <div className="flex gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-surface-700">Sort by</label>
        <div className="flex gap-1">
          <button
            onClick={() => handleSortChange('date')}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors ${
              currentSort?.field === 'date'
                ? 'bg-primary-50 border-primary-200 text-primary-700'
                : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
            }`}
          >
            Date {getSortIcon('date')}
          </button>
          <button
            onClick={() => handleSortChange('title')}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors ${
              currentSort?.field === 'title'
                ? 'bg-primary-50 border-primary-200 text-primary-700'
                : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
            }`}
          >
            Title {getSortIcon('title')}
          </button>
          <button
            onClick={() => handleSortChange('decisionMaker')}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors ${
              currentSort?.field === 'decisionMaker'
                ? 'bg-primary-50 border-primary-200 text-primary-700'
                : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
            }`}
          >
            Decision Maker {getSortIcon('decisionMaker')}
          </button>
        </div>
      </div>
    </div>
  );
}






