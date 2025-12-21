import { FilterSelect } from '@/components/ui/filter-select';

interface Project {
  id: string;
  name: string;
}

interface ProjectFilterProps {
  projects: Project[];
  currentProject?: string;
}

export function ProjectFilter({ projects, currentProject }: ProjectFilterProps) {
  const options = projects.map((p) => ({
    id: p.id,
    label: p.name,
  }));

  return (
    <FilterSelect
      paramName="project"
      options={options}
      currentValue={currentProject}
      placeholder="All Projects"
    />
  );
}


















