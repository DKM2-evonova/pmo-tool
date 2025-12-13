'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Select } from '@/components/ui';
import type { Profile } from '@/types/database';
import type { EntityStatus } from '@/types/enums';

interface ActionItemFormProps {
  projects: Array<{ id: string; name: string }>;
  initialProjectId?: string;
}

export function ActionItemForm({
  projects,
  initialProjectId,
}: ActionItemFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectMembers, setProjectMembers] = useState<Profile[]>([]);

  const [formData, setFormData] = useState({
    project_id: initialProjectId || '',
    title: '',
    description: '',
    status: 'Open' as EntityStatus,
    owner_user_id: '',
    due_date: '',
  });

  // Load project members when project changes
  useEffect(() => {
    const loadMembers = async () => {
      if (!formData.project_id) {
        setProjectMembers([]);
        return;
      }

      const { data: members } = await supabase
        .from('project_members')
        .select('user_id, profile:profiles(*)')
        .eq('project_id', formData.project_id);

      const profiles: Profile[] = [];
      if (members) {
        for (const m of members) {
          const p = m.profile as unknown as Profile | Profile[] | null;
          if (p) {
            if (Array.isArray(p)) {
              if (p[0]) profiles.push(p[0]);
            } else {
              profiles.push(p);
            }
          }
        }
      }
      setProjectMembers(profiles);
    };

    loadMembers();
  }, [formData.project_id, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const owner = projectMembers.find(
        (m) => m.id === formData.owner_user_id
      );

      const { error } = await supabase.from('action_items').insert({
        project_id: formData.project_id,
        title: formData.title,
        description: formData.description || null,
        status: formData.status,
        owner_user_id: formData.owner_user_id || null,
        owner_name: owner?.full_name || null,
        owner_email: owner?.email || null,
        due_date: formData.due_date || null,
      });

      if (error) throw error;

      router.push('/action-items');
      router.refresh();
    } catch (error) {
      console.error('Error creating action item:', error);
      alert('Failed to create action item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      <Select
        label="Project"
        value={formData.project_id}
        onChange={(e) =>
          setFormData({ ...formData, project_id: e.target.value })
        }
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        placeholder="Select project"
      />

      <Input
        label="Title"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="Action item title"
        required
      />

      <div>
        <label className="label">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Detailed description"
          rows={3}
          className="input resize-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Status"
          value={formData.status}
          onChange={(e) =>
            setFormData({ ...formData, status: e.target.value as EntityStatus })
          }
          options={[
            { value: 'Open', label: 'Open' },
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Closed', label: 'Closed' },
          ]}
        />

        <Select
          label="Owner"
          value={formData.owner_user_id}
          onChange={(e) =>
            setFormData({ ...formData, owner_user_id: e.target.value })
          }
          options={projectMembers.map((m) => ({
            value: m.id,
            label: m.full_name || m.email,
          }))}
          placeholder="Select owner"
        />
      </div>

      <Input
        label="Due Date"
        type="date"
        value={formData.due_date}
        onChange={(e) =>
          setFormData({ ...formData, due_date: e.target.value })
        }
      />

      <div className="flex justify-end gap-3 border-t border-surface-200 pt-6">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={!formData.project_id || !formData.title}
        >
          Create Action Item
        </Button>
      </div>
    </form>
  );
}

