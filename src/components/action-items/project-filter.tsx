'use client';

interface Project {
  id: string;
  name: string;
}

interface ProjectFilterProps {
  projects: Project[];
  currentProject?: string;
}

export function ProjectFilter({ projects, currentProject }: ProjectFilterProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = new URL(window.location.href);
    if (e.target.value) {
      url.searchParams.set('project', e.target.value);
    } else {
      url.searchParams.delete('project');
    }
    window.location.href = url.toString();
  };

  return (
    <select
      className="input w-48"
      defaultValue={currentProject || ''}
      onChange={handleChange}
    >
      <option value="">All Projects</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}





