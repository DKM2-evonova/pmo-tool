'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  Download,
  Upload,
  Loader2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { MilestoneStatus } from '@/types/enums';
import type { MilestoneWithPredecessor, EditableMilestone } from '@/types/database';
import { cn, generateId } from '@/lib/utils';
import {
  validateMilestoneDependencies,
  getAvailablePredecessors,
} from '@/lib/validation/milestone-dependencies';

interface MilestoneSpreadsheetProps {
  projectId: string;
  initialMilestones: MilestoneWithPredecessor[];
  onUpdate?: () => void;
}

const statusOptions = Object.values(MilestoneStatus);
const statusColors: Record<string, string> = {
  'Not Started': 'bg-surface-100 text-surface-600',
  'In Progress': 'bg-primary-100 text-primary-700',
  'Behind Schedule': 'bg-warning-100 text-warning-700',
  Complete: 'bg-success-100 text-success-700',
};

export function MilestoneSpreadsheet({
  projectId,
  initialMilestones,
  onUpdate,
}: MilestoneSpreadsheetProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [milestones, setMilestones] = useState<EditableMilestone[]>(
    initialMilestones.map((m, i) => ({
      ...m,
      sort_order: m.sort_order ?? i,
      _isNew: false,
      _isDeleted: false,
      _isDirty: false,
    }))
  );
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Check if there are unsaved changes
  const hasChanges =
    milestones.some((m) => m._isDirty || m._isNew) || deletedIds.length > 0;

  // Validation
  const validation = validateMilestoneDependencies(
    milestones.filter((m) => !m._isDeleted).map((m) => ({
      id: m.id,
      name: m.name,
      predecessor_id: m.predecessor_id,
      target_date: m.target_date,
    }))
  );

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Add new milestone
  const handleAddRow = useCallback(() => {
    const newMilestone: EditableMilestone = {
      id: generateId(),
      project_id: projectId,
      name: '',
      description: null,
      target_date: null,
      status: MilestoneStatus.NotStarted,
      sort_order: milestones.length,
      predecessor_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _isNew: true,
      _isDirty: true,
    };
    setMilestones([...milestones, newMilestone]);
  }, [milestones, projectId]);

  // Update a field
  const handleFieldChange = useCallback(
    (id: string, field: keyof EditableMilestone, value: string | null) => {
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, [field]: value, _isDirty: true }
            : m
        )
      );
    },
    []
  );

  // Delete a milestone
  const handleDelete = useCallback((id: string, isNew: boolean) => {
    if (isNew) {
      // Just remove from list if it's a new unsaved milestone
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } else {
      // Mark for deletion
      setMilestones((prev) =>
        prev.map((m) => (m.id === id ? { ...m, _isDeleted: true } : m))
      );
      setDeletedIds((prev) => [...prev, id]);
    }
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const dragIdx = dragIndex;
      if (dragIdx === null || dragIdx === dropIndex) {
        handleDragEnd();
        return;
      }

      setMilestones((prev) => {
        const newList = [...prev];
        const [draggedItem] = newList.splice(dragIdx, 1);
        newList.splice(dropIndex, 0, draggedItem);

        // Update sort orders and mark as dirty
        return newList.map((m, i) => ({
          ...m,
          sort_order: i,
          _isDirty: m._isDirty || m.sort_order !== i,
        }));
      });

      handleDragEnd();
    },
    [dragIndex, handleDragEnd]
  );

  // Save all changes
  const handleSave = useCallback(async () => {
    if (!validation.valid) {
      setError('Please fix validation errors before saving');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const milestonesToSave = milestones
        .filter((m) => !m._isDeleted)
        .map((m) => ({
          id: m._isNew ? undefined : m.id,
          name: m.name,
          description: m.description,
          target_date: m.target_date,
          status: m.status,
          sort_order: m.sort_order,
          predecessor_id: m.predecessor_id,
        }));

      const response = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestones: milestonesToSave,
          deleted_ids: deletedIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save milestones');
      }

      // Update state with saved data
      setMilestones(
        data.milestones.map((m: MilestoneWithPredecessor, i: number) => ({
          ...m,
          sort_order: i,
          _isNew: false,
          _isDeleted: false,
          _isDirty: false,
        }))
      );
      setDeletedIds([]);
      setSuccessMessage('Milestones saved successfully');
      router.refresh();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [milestones, deletedIds, projectId, router, onUpdate, validation.valid]);

  // Download template
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/milestones/template`
      );
      if (!response.ok) throw new Error('Failed to download template');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        response.headers
          .get('Content-Disposition')
          ?.match(/filename="(.+)"/)?.[1] || 'milestones_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download template');
    }
  }, [projectId]);

  // Import from file
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsImporting(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(
          `/api/projects/${projectId}/milestones/import`,
          {
            method: 'POST',
            body: formData,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          const errorDetails = data.details
            ?.map((d: { row: number; message: string }) => `Row ${d.row}: ${d.message}`)
            .join('\n');
          throw new Error(data.error + (errorDetails ? `\n${errorDetails}` : ''));
        }

        // Update state with imported data
        setMilestones(
          data.milestones.map((m: MilestoneWithPredecessor, i: number) => ({
            ...m,
            sort_order: i,
            _isNew: false,
            _isDeleted: false,
            _isDirty: false,
          }))
        );
        setDeletedIds([]);
        setSuccessMessage(
          `Import complete: ${data.stats.created} created, ${data.stats.updated} updated, ${data.stats.deleted} deleted`
        );
        router.refresh();
        onUpdate?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import');
      } finally {
        setIsImporting(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [projectId, router, onUpdate]
  );

  // Get available predecessors for a milestone
  const getAvailablePredecessorsForMilestone = useCallback(
    (milestoneId: string) => {
      return getAvailablePredecessors(
        milestoneId,
        milestones.filter((m) => !m._isDeleted).map((m) => ({
          id: m.id,
          name: m.name,
          predecessor_id: m.predecessor_id,
        }))
      );
    },
    [milestones]
  );

  const visibleMilestones = milestones.filter((m) => !m._isDeleted);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-700 hover:bg-surface-50"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-700 hover:bg-surface-50"
          >
            <Download className="h-4 w-4" />
            Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-700 hover:bg-surface-50 disabled:opacity-50"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges || !validation.valid}
            className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save All
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="whitespace-pre-wrap">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-success-50 p-3 text-sm text-success-700">
          <Check className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {validation.errors.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-sm text-warning-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Validation Issues:</strong>
            <ul className="mt-1 list-disc list-inside">
              {validation.errors.map((err, i) => (
                <li key={i}>{err.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Spreadsheet Table */}
      <div className="overflow-x-auto rounded-lg border border-surface-200">
        <table className="w-full text-sm">
          <thead className="bg-surface-50">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="min-w-[200px] px-3 py-2 text-left font-medium text-surface-700">
                Name *
              </th>
              <th className="min-w-[250px] px-3 py-2 text-left font-medium text-surface-700">
                Description
              </th>
              <th className="w-36 px-3 py-2 text-left font-medium text-surface-700">
                Target Date
              </th>
              <th className="w-36 px-3 py-2 text-left font-medium text-surface-700">
                Status
              </th>
              <th className="w-48 px-3 py-2 text-left font-medium text-surface-700">
                Predecessor
              </th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visibleMilestones.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-surface-500"
                >
                  No milestones yet. Click "Add Row" to create one.
                </td>
              </tr>
            ) : (
              visibleMilestones.map((milestone, index) => (
                <tr
                  key={milestone.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  className={cn(
                    'border-t border-surface-200 transition-colors',
                    dragIndex === index && 'opacity-50',
                    dragOverIndex === index && 'bg-primary-50',
                    milestone._isNew && 'bg-primary-50/50',
                    milestone._isDirty && !milestone._isNew && 'bg-warning-50/30'
                  )}
                >
                  {/* Drag Handle */}
                  <td className="px-2 py-2">
                    <div className="cursor-grab text-surface-400 hover:text-surface-600">
                      <GripVertical className="h-4 w-4" />
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={milestone.name}
                      onChange={(e) =>
                        handleFieldChange(milestone.id, 'name', e.target.value)
                      }
                      placeholder="Milestone name"
                      className={cn(
                        'w-full rounded border border-transparent bg-transparent px-2 py-1 focus:border-primary-300 focus:bg-white focus:outline-none',
                        !milestone.name && 'border-danger-300 bg-danger-50'
                      )}
                    />
                  </td>

                  {/* Description */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={milestone.description || ''}
                      onChange={(e) =>
                        handleFieldChange(
                          milestone.id,
                          'description',
                          e.target.value || null
                        )
                      }
                      placeholder="Description (optional)"
                      className="w-full rounded border border-transparent bg-transparent px-2 py-1 focus:border-primary-300 focus:bg-white focus:outline-none"
                    />
                  </td>

                  {/* Target Date */}
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={milestone.target_date || ''}
                      onChange={(e) =>
                        handleFieldChange(
                          milestone.id,
                          'target_date',
                          e.target.value || null
                        )
                      }
                      className="w-full rounded border border-transparent bg-transparent px-2 py-1 focus:border-primary-300 focus:bg-white focus:outline-none"
                    />
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2">
                    <select
                      value={milestone.status}
                      onChange={(e) =>
                        handleFieldChange(milestone.id, 'status', e.target.value)
                      }
                      className={cn(
                        'w-full rounded border-0 px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-primary-300',
                        statusColors[milestone.status]
                      )}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Predecessor */}
                  <td className="px-3 py-2">
                    <select
                      value={milestone.predecessor_id || ''}
                      onChange={(e) =>
                        handleFieldChange(
                          milestone.id,
                          'predecessor_id',
                          e.target.value || null
                        )
                      }
                      className="w-full rounded border border-surface-200 bg-white px-2 py-1 text-sm focus:border-primary-300 focus:outline-none"
                    >
                      <option value="">No predecessor</option>
                      {getAvailablePredecessorsForMilestone(milestone.id).map(
                        (pred) => (
                          <option key={pred.id} value={pred.id}>
                            {pred.name}
                          </option>
                        )
                      )}
                    </select>
                  </td>

                  {/* Delete */}
                  <td className="px-2 py-2">
                    <button
                      onClick={() => handleDelete(milestone.id, milestone._isNew || false)}
                      className="rounded p-1 text-surface-400 hover:bg-surface-100 hover:text-danger-500"
                      title="Delete milestone"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between text-xs text-surface-500">
        <span>
          {visibleMilestones.length} milestone{visibleMilestones.length !== 1 && 's'}
          {hasChanges && ' (unsaved changes)'}
        </span>
        <span>Drag rows to reorder</span>
      </div>
    </div>
  );
}
