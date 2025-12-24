'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  DecisionCategory,
  DecisionCategoryLabel,
  DecisionCategoryPrefix,
  DecisionImpactArea,
  DecisionImpactAreaLabel,
  DecisionStatus,
  DecisionStatusLabel,
} from '@/types/enums';
import { Check, X } from 'lucide-react';

interface FacetCounts {
  categories: Record<DecisionCategory, number>;
  impactAreas: Record<DecisionImpactArea, number>;
  statuses: Record<DecisionStatus, number>;
}

interface DecisionFacetedFiltersProps {
  counts: FacetCounts;
  className?: string;
}

const ALL_CATEGORIES = Object.values(DecisionCategory) as DecisionCategory[];
const ALL_IMPACT_AREAS = Object.values(DecisionImpactArea) as DecisionImpactArea[];
const ALL_STATUSES = Object.values(DecisionStatus) as DecisionStatus[];

export function DecisionFacetedFilters({
  counts,
  className,
}: DecisionFacetedFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse current selections from URL
  const selectedCategories = new Set(
    searchParams.get('categories')?.split(',').filter(Boolean) || []
  );
  const selectedImpacts = new Set(
    searchParams.get('impacts')?.split(',').filter(Boolean) || []
  );
  const selectedStatuses = new Set(
    searchParams.get('statuses')?.split(',').filter(Boolean) || []
  );

  const hasActiveFilters =
    selectedCategories.size > 0 ||
    selectedImpacts.size > 0 ||
    selectedStatuses.size > 0;

  const updateFilter = (
    param: 'categories' | 'impacts' | 'statuses',
    value: string,
    isSelected: boolean
  ) => {
    const url = new URL(window.location.href);
    const current = url.searchParams.get(param)?.split(',').filter(Boolean) || [];

    let updated: string[];
    if (isSelected) {
      updated = current.filter((v) => v !== value);
    } else {
      updated = [...current, value];
    }

    // Clear the view param when manually filtering
    url.searchParams.delete('view');

    if (updated.length === 0) {
      url.searchParams.delete(param);
    } else {
      url.searchParams.set(param, updated.join(','));
    }

    router.push(url.pathname + url.search);
  };

  const clearAllFilters = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('categories');
    url.searchParams.delete('impacts');
    url.searchParams.delete('statuses');
    url.searchParams.delete('view');
    router.push(url.pathname + url.search);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearAllFilters}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5
                     text-sm text-surface-600 hover:text-surface-900
                     bg-surface-50 hover:bg-surface-100 rounded-md
                     transition-colors duration-200"
        >
          <X className="h-3.5 w-3.5" />
          Clear Filters
        </button>
      )}

      {/* Category Filter */}
      <FilterSection title="Category">
        {ALL_CATEGORIES.map((category) => {
          const isSelected = selectedCategories.has(category);
          const count = counts.categories[category] || 0;

          return (
            <FilterCheckbox
              key={category}
              label={DecisionCategoryPrefix[category]}
              fullLabel={DecisionCategoryLabel[category]}
              count={count}
              isSelected={isSelected}
              onClick={() => updateFilter('categories', category, isSelected)}
            />
          );
        })}
      </FilterSection>

      {/* Impact Area Filter */}
      <FilterSection title="Impact Area">
        {ALL_IMPACT_AREAS.map((impact) => {
          const isSelected = selectedImpacts.has(impact);
          const count = counts.impactAreas[impact] || 0;

          return (
            <FilterCheckbox
              key={impact}
              label={DecisionImpactAreaLabel[impact]}
              count={count}
              isSelected={isSelected}
              onClick={() => updateFilter('impacts', impact, isSelected)}
            />
          );
        })}
      </FilterSection>

      {/* Status Filter */}
      <FilterSection title="Status">
        {ALL_STATUSES.map((status) => {
          const isSelected = selectedStatuses.has(status);
          const count = counts.statuses[status] || 0;

          return (
            <FilterCheckbox
              key={status}
              label={DecisionStatusLabel[status]}
              count={count}
              isSelected={isSelected}
              onClick={() => updateFilter('statuses', status, isSelected)}
            />
          );
        })}
      </FilterSection>
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider px-2 mb-2">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function FilterCheckbox({
  label,
  fullLabel,
  count,
  isSelected,
  onClick,
}: {
  label: string;
  fullLabel?: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={fullLabel || label}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm',
        'transition-all duration-200',
        isSelected
          ? 'bg-primary-50 text-primary-700'
          : 'text-surface-600 hover:bg-surface-50'
      )}
    >
      <span
        className={cn(
          'h-4 w-4 rounded border flex items-center justify-center',
          'transition-colors duration-200',
          isSelected
            ? 'bg-primary-500 border-primary-500'
            : 'border-surface-300 bg-white'
        )}
      >
        {isSelected && <Check className="h-3 w-3 text-white" />}
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
      <span className="text-xs text-surface-400">{count}</span>
    </button>
  );
}
