'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Input } from '@/components/ui';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { generateId } from '@/lib/utils';
import { MilestoneStatus } from '@/types/enums';
import type { Milestone } from '@/types/database';

interface ProjectFormProps {
  project?: {
    id: string;
    name: string;
    description: string | null;
    milestones: Milestone[] | null;
  };
}

export function ProjectForm({ project }: ProjectFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: project?.name || '',
    description: project?.description || '',
  });

  const [milestones, setMilestones] = useState<Milestone[]>(
    project?.milestones || []
  );

  const handleAddMilestone = () => {
    setMilestones([
      ...milestones,
      {
        id: generateId(),
        name: '',
        target_date: null,
        status: MilestoneStatus.NotStarted,
      },
    ]);
  };

  const handleRemoveMilestone = (id: string) => {
    setMilestones(milestones.filter((m) => m.id !== id));
  };

  const handleMilestoneChange = (
    id: string,
    field: keyof Milestone,
    value: string | boolean
  ) => {
    setMilestones(
      milestones.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const projectData = {
        name: formData.name,
        description: formData.description || null,
        milestones: milestones.filter((m) => m.name.trim() !== ''),
      };

      if (project) {
        // Update existing project
        console.log('Step 1: Updating project...');
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', project.id);

        if (error) {
          console.error('Update error:', error.message, error.code, error);
          throw new Error(error.message || 'Failed to update project');
        }
        router.push(`/projects/${project.id}`);
      } else {
        // Create new project
        console.log('Step 1: Creating project with data:', projectData);
        const { data: newProject, error: createError } = await supabase
          .from('projects')
          .insert(projectData)
          .select()
          .single();

        console.log('Step 2: Insert result:', { newProject, createError });

        if (createError) {
          console.error(
            'Create error:',
            createError.message,
            createError.code,
            createError.details,
            createError.hint
          );
          throw new Error(
            createError.message || 'Failed to create project'
          );
        }

        // Add current user as owner
        console.log('Step 3: Getting current user...');
        const {
          data: { user },
        } = await supabase.auth.getUser();
        console.log('Step 4: User:', user?.id, user?.email);

        if (user && newProject) {
          console.log('Step 5: Adding user as project owner...');
          const { error: memberError } = await supabase
            .from('project_members')
            .insert({
              project_id: newProject.id,
              user_id: user.id,
              project_role: 'owner',
            });

          if (memberError) {
            console.error(
              'Member insert error:',
              memberError.message,
              memberError.code,
              memberError.details
            );
            throw new Error(
              memberError.message || 'Failed to add you as project owner'
            );
          }
        }

        console.log('Step 6: Success! Redirecting...');
        router.push(`/projects/${newProject.id}`);
      }
      router.refresh();
    } catch (err: unknown) {
      console.error('Caught error:', err);

      let errorMessage = 'Failed to save project. Please try again.';

      if (err instanceof Error) {
        errorMessage = err.message;
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      {error && (
        <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-600">
          {error}
        </div>
      )}

      <Input
        label="Project Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Enter project name"
        required
      />

      <div>
        <label className="label">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Brief description of the project"
          rows={3}
          className="input resize-none"
        />
      </div>

      {/* Milestones */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <label className="label mb-0">Milestones</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddMilestone}
          >
            <Plus className="h-4 w-4" />
            Add Milestone
          </Button>
        </div>

        {milestones.length === 0 ? (
          <p className="text-sm text-surface-500">
            No milestones yet. Add milestones to track key project dates.
          </p>
        ) : (
          <div className="space-y-3">
            {milestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-center gap-3 rounded-lg border border-surface-200 p-3"
              >
                <select
                  value={milestone.status}
                  onChange={(e) =>
                    handleMilestoneChange(milestone.id, 'status', e.target.value)
                  }
                  className="input w-36"
                >
                  {Object.values(MilestoneStatus).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={milestone.name}
                  onChange={(e) =>
                    handleMilestoneChange(milestone.id, 'name', e.target.value)
                  }
                  placeholder="Milestone name"
                  className="input flex-1"
                />
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                  <input
                    type="date"
                    value={milestone.target_date || ''}
                    onChange={(e) =>
                      handleMilestoneChange(
                        milestone.id,
                        'target_date',
                        e.target.value
                      )
                    }
                    className="input w-40 pl-10"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMilestone(milestone.id)}
                  className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-danger-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-surface-200 pt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {project ? 'Save Changes' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}

