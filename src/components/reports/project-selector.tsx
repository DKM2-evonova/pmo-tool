'use client';

import { ChevronDown } from 'lucide-react';

interface Project {
  id: string;
  name: string;
}

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
}

export function ProjectSelector({
  projects,
  selectedProjectId,
  onProjectChange,
}: ProjectSelectorProps) {
  return (
    <div className="relative w-full sm:w-72">
      <select
        value={selectedProjectId}
        onChange={(e) => onProjectChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-surface-300 bg-white px-4 py-2.5 pr-10 text-sm font-medium text-surface-900 shadow-sm transition-colors hover:border-surface-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      >
        <option value="">Select a project...</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
    </div>
  );
}
