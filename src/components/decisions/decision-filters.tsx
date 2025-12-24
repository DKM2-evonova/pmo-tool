'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui';

interface Project {
  id: string;
  name: string;
}

interface DecisionMaker {
  id: string;
  name: string;
}

interface DecisionFiltersProps {
  projects: Project[];
  decisionMakers: DecisionMaker[];
}

export function DecisionFilters({ projects, decisionMakers }: DecisionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (filterName: string, value: string) => {
    const url = new URL(window.location.href);
    if (value && value !== '') {
      url.searchParams.set(filterName, value);
    } else {
      url.searchParams.delete(filterName);
    }
    router.push(url.toString());
  };

  const currentProject = searchParams.get('project') || '';
  const currentDecisionMaker = searchParams.get('decisionMaker') || '';
  const currentStatus = searchParams.get('status') || '';

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-surface-700">Project</label>
        <select
          className="input w-48"
          value={currentProject}
          onChange={(e) => handleFilterChange('project', e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-surface-700">Decision Maker</label>
        <select
          className="input w-48"
          value={currentDecisionMaker}
          onChange={(e) => handleFilterChange('decisionMaker', e.target.value)}
        >
          <option value="">All Decision Makers</option>
          {decisionMakers.map((dm) => (
            <option key={dm.id} value={dm.id}>
              {dm.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-surface-700">Status</label>
        <select
          className="input w-48"
          value={currentStatus}
          onChange={(e) => handleFilterChange('status', e.target.value)}
        >
          <option value="">All Status</option>
          <option value="implemented">Implemented</option>
          <option value="pending">Pending</option>
        </select>
      </div>
    </div>
  );
}




















