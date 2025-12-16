'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Calendar, Loader2 } from 'lucide-react';
import { generateId, formatDateReadable } from '@/lib/utils';
import { MilestoneStatus } from '@/types/enums';
import type { Milestone } from '@/types/database';

interface MilestoneListProps {
  projectId: string;
  milestones: Milestone[];
}

const statusColors: Record<string, string> = {
  'Not Started': 'bg-surface-100 text-surface-600',
  'In Progress': 'bg-primary-100 text-primary-700',
  'Behind Schedule': 'bg-warning-100 text-warning-700',
  'Complete': 'bg-success-100 text-success-700',
};

export function MilestoneList({ projectId, milestones: initialMilestones }: MilestoneListProps) {
  const router = useRouter();
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [isAdding, setIsAdding] = useState(false);
  const [newMilestone, setNewMilestone] = useState<Milestone | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveMilestones = async (updated: Milestone[]) => {
    const response = await fetch(`/api/projects/${projectId}/milestones`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestones: updated }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save milestones');
    }

    return response.json();
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setNewMilestone({
      id: generateId(),
      name: '',
      target_date: null,
      status: MilestoneStatus.NotStarted,
    });
    setError(null);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewMilestone(null);
    setError(null);
  };

  const handleSaveNew = async () => {
    if (!newMilestone || !newMilestone.name.trim()) {
      setError('Milestone name is required');
      return;
    }

    setSavingId(newMilestone.id);
    setError(null);

    try {
      const updated = [...milestones, newMilestone];
      await saveMilestones(updated);
      setMilestones(updated);
      setIsAdding(false);
      setNewMilestone(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save milestone');
    } finally {
      setSavingId(null);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setSavingId(id);
    setError(null);

    try {
      const updated = milestones.map((m) =>
        m.id === id ? { ...m, status: status as Milestone['status'] } : m
      );
      await saveMilestones(updated);
      setMilestones(updated);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) {
      return;
    }

    setDeletingId(id);
    setError(null);

    try {
      const updated = milestones.filter((m) => m.id !== id);
      await saveMilestones(updated);
      setMilestones(updated);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete milestone');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-surface-900">Milestones</h2>
        {!isAdding && (
          <button
            onClick={handleAddClick}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-4 w-4" />
            Add Milestone
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {milestones.map((milestone) => (
          <div
            key={milestone.id}
            className="flex items-center justify-between rounded-lg border border-surface-200 p-3"
          >
            <div className="flex flex-1 items-center gap-3">
              <select
                value={milestone.status}
                onChange={(e) => handleStatusChange(milestone.id, e.target.value)}
                disabled={savingId === milestone.id || deletingId === milestone.id}
                className={`rounded-md border-0 py-1 pl-2 pr-8 text-sm font-medium ${statusColors[milestone.status] || statusColors['Not Started']}`}
              >
                {Object.values(MilestoneStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <span
                className={
                  milestone.status === 'Complete'
                    ? 'text-surface-400 line-through'
                    : 'text-surface-900'
                }
              >
                {milestone.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {milestone.target_date && (
                <span className="text-sm text-surface-500">
                  {formatDateReadable(milestone.target_date)}
                </span>
              )}
              {savingId === milestone.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-surface-400" />
              ) : (
                <button
                  onClick={() => handleDelete(milestone.id)}
                  disabled={deletingId === milestone.id}
                  className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-danger-500 disabled:opacity-50"
                >
                  {deletingId === milestone.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {isAdding && newMilestone && (
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-3">
            <div className="flex items-center gap-3">
              <select
                value={newMilestone.status}
                onChange={(e) =>
                  setNewMilestone({ ...newMilestone, status: e.target.value as Milestone['status'] })
                }
                className={`rounded-md border-0 py-1 pl-2 pr-8 text-sm font-medium ${statusColors[newMilestone.status]}`}
              >
                {Object.values(MilestoneStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newMilestone.name}
                onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
                placeholder="Milestone name"
                className="input flex-1"
                autoFocus
              />
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  type="date"
                  value={newMilestone.target_date || ''}
                  onChange={(e) =>
                    setNewMilestone({ ...newMilestone, target_date: e.target.value || null })
                  }
                  className="input w-40 pl-10"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={handleCancelAdd}
                className="rounded-lg px-3 py-1.5 text-sm text-surface-600 hover:bg-surface-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNew}
                disabled={savingId !== null}
                className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {savingId === newMilestone.id && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                Save
              </button>
            </div>
          </div>
        )}

        {milestones.length === 0 && !isAdding && (
          <div className="py-6 text-center">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-surface-300" />
            <p className="text-surface-500">No milestones yet</p>
            <button
              onClick={handleAddClick}
              className="mt-2 text-sm text-primary-600 hover:text-primary-700"
            >
              Add your first milestone
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
