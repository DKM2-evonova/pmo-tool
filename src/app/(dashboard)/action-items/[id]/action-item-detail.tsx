'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, Badge, Input, Select } from '@/components/ui';
import { formatDateReadable, isOverdue, getInitials, cn } from '@/lib/utils';
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  Clock,
  User,
  Calendar,
  AlertCircle,
  MessageSquare,
  Plus,
  UserCheck,
  UserPlus,
  Zap,
  ExternalLink
} from 'lucide-react';
import type { ActionItemUpdate } from '@/types/database';
import type { EntityStatus } from '@/types/enums';

interface ActionItemDetailProps {
  actionItem: {
    id: string;
    title: string;
    description: string | null;
    status: EntityStatus;
    owner_user_id: string | null;
    owner_name: string | null;
    owner_email: string | null;
    due_date: string | null;
    created_at: string;
    updated_at: string;
    project_id: string;
    source_meeting_id: string | null;
    updates: ActionItemUpdate[];
    owner?: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
    project?: { id: string; name: string } | null;
    source_meeting?: { id: string; title: string } | null;
  };
  projectMembers: Array<{ id: string; full_name: string; email: string }>;
  currentUserId: string;
}

export function ActionItemDetail({ actionItem: initialActionItem, projectMembers, currentUserId }: ActionItemDetailProps) {
  const router = useRouter();
  const supabase = createClient();
  const [actionItem, setActionItem] = useState(initialActionItem);
  const [editing, setEditing] = useState(false);
  const [newUpdate, setNewUpdate] = useState('');
  const [saving, setSaving] = useState(false);
  const [assigningOwner, setAssigningOwner] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');

  const [formData, setFormData] = useState({
    title: actionItem.title,
    description: actionItem.description || '',
    status: actionItem.status,
    owner_user_id: actionItem.owner_user_id || '',
    due_date: actionItem.due_date || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/action-items/${actionItem.id}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          status: formData.status,
          owner_user_id: formData.owner_user_id,
          due_date: formData.due_date,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update action item');
      }

      // Update local state
      const owner = projectMembers.find(m => m.id === formData.owner_user_id);
      setActionItem({
        ...actionItem,
        title: formData.title,
        description: formData.description || null,
        status: formData.status,
        owner_user_id: formData.owner_user_id || null,
        owner_name: owner?.full_name || null,
        owner_email: owner?.email || null,
        due_date: formData.due_date || null,
        owner: owner ? { id: owner.id, full_name: owner.full_name, email: owner.email, avatar_url: null } : null,
        updates: actionItem.updates, // Preserve updates array
      });

      setEditing(false);
      router.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to update action item: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!newUpdate.trim()) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/action-items/${actionItem.id}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newUpdate.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add update');
      }

      // Update local state
      const currentUpdates = Array.isArray(actionItem.updates) ? actionItem.updates : [];
      const updatedUpdates = [...currentUpdates, result.update];
      setActionItem({ ...actionItem, updates: updatedUpdates });
      setNewUpdate('');
      router.refresh();
    } catch (error: any) {
      console.error('Failed to add update:', error);
      alert(`Failed to add status update: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOwnerAssignment = async () => {
    if (!selectedOwnerId) return;

    setSaving(true);
    try {
      console.log('Client: Assigning owner for action item:', actionItem.id);
      const response = await fetch(`/api/action-items/${actionItem.id}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner_user_id: selectedOwnerId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign owner');
      }

      // Update local state
      const owner = projectMembers.find(m => m.id === selectedOwnerId);
      const wasUnassigned = !actionItem.owner_user_id;
      const oldOwnerName = actionItem.owner?.full_name || actionItem.owner_name || 'Unassigned';

      setActionItem({
        ...actionItem,
        owner_user_id: selectedOwnerId,
        owner_name: owner?.full_name || null,
        owner_email: owner?.email || null,
        owner: owner ? { id: owner.id, full_name: owner.full_name, email: owner.email, avatar_url: null } : null,
      });

      setAssigningOwner(false);
      setSelectedOwnerId('');

      // Add automatic status update for owner change
      const ownerName = owner?.full_name || owner?.email || 'Unknown';
      const changeMessage = wasUnassigned
        ? `Assigned to ${ownerName}`
        : `Reassigned from ${oldOwnerName} to ${ownerName}`;

      // Add the status update
      await handleAddUpdateForOwnerChange(changeMessage);

      router.refresh();
    } catch (error: any) {
      console.error('Failed to assign owner:', error);
      alert(`Failed to assign owner: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddUpdateForOwnerChange = async (message: string) => {
    try {
      const response = await fetch(`/api/action-items/${actionItem.id}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add owner change update');
      }

      // Update local state
      const currentUpdates = Array.isArray(actionItem.updates) ? actionItem.updates : [];
      const updatedUpdates = [...currentUpdates, result.update];
      setActionItem({ ...actionItem, updates: updatedUpdates });
    } catch (error: any) {
      console.error('Failed to add owner change update:', error);
      // Don't show alert for this as it's a secondary operation
    }
  };

  const statusVariant: Record<string, 'default' | 'warning' | 'success'> = {
    Open: 'default',
    'In Progress': 'warning',
    Closed: 'success',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-surface-900">
              {editing ? 'Edit Action Item' : actionItem.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusVariant[actionItem.status]}>
                {actionItem.status}
              </Badge>
              <span className="text-sm text-surface-500">
                {actionItem.project?.name}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <Button onClick={() => setEditing(true)} className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex items-center gap-2" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Details</h2>

            {!editing ? (
              <div className="space-y-4">
                {actionItem.description && (
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">
                      Description
                    </label>
                    <p className="text-surface-900">{actionItem.description}</p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">
                      Owner
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                        {getInitials(
                          actionItem.owner?.full_name ||
                            actionItem.owner_name ||
                            'Unassigned'
                        )}
                      </div>
                      <span className="text-surface-900">
                        {actionItem.owner?.full_name ||
                          actionItem.owner_name ||
                          'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {actionItem.due_date && (
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">
                        Due Date
                      </label>
                      <div className={cn(
                        "flex items-center gap-2",
                        isOverdue(actionItem.due_date) && actionItem.status !== 'Closed'
                          ? 'text-danger-600'
                          : 'text-surface-600'
                      )}>
                        <Calendar className="h-4 w-4" />
                        {isOverdue(actionItem.due_date) && actionItem.status !== 'Closed' && (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        {formatDateReadable(actionItem.due_date)}
                      </div>
                    </div>
                  )}
                </div>

                {actionItem.source_meeting && (
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">
                      Source Meeting
                    </label>
                    <p className="text-surface-900">
                      {actionItem.source_meeting.title}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  label="Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="input resize-none"
                    placeholder="Detailed description"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as EntityStatus })}
                    options={[
                      { value: 'Open', label: 'Open' },
                      { value: 'In Progress', label: 'In Progress' },
                      { value: 'Closed', label: 'Closed' },
                    ]}
                  />

                  <Select
                    label="Owner"
                    value={formData.owner_user_id}
                    onChange={(e) => setFormData({ ...formData, owner_user_id: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Status Updates */}
          <div className="card">
            <h2 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Status Updates
            </h2>

            {/* Add new update */}
            <div className="mb-4">
              <div className="flex gap-2">
                <Input
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  placeholder="Add a status update..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddUpdate();
                    }
                  }}
                />
                <Button onClick={handleAddUpdate} disabled={!newUpdate.trim() || saving}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Updates list */}
            <div className="space-y-3">
              {actionItem.updates && actionItem.updates.length > 0 ? (
                actionItem.updates.map((update) => {
                  const isAIUpdate = update.source === 'ai_meeting_processing';

                  return (
                    <div
                      key={update.id}
                      className={cn(
                        "border-l-2 pl-4 py-2",
                        isAIUpdate
                          ? "border-primary-400 bg-primary-50/50 rounded-r-lg"
                          : "border-primary-200"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* AI Badge and meeting link for system updates */}
                          {isAIUpdate && (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                                <Zap className="h-3 w-3" />
                                AI Update
                              </span>
                              {update.meeting_id && update.meeting_title && (
                                <Link
                                  href={`/meetings/${update.meeting_id}`}
                                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {update.meeting_title}
                                </Link>
                              )}
                            </div>
                          )}

                          <p className="text-surface-900">{update.content}</p>

                          {/* Evidence quote for AI updates */}
                          {isAIUpdate && update.evidence_quote && (
                            <div className="mt-2 p-2 bg-surface-100 rounded-md border-l-2 border-surface-300">
                              <p className="text-sm text-surface-600 italic">
                                &ldquo;{update.evidence_quote}&rdquo;
                              </p>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2 text-sm text-surface-500">
                            <User className="h-3 w-3" />
                            <span>{update.created_by_name}</span>
                            <Clock className="h-3 w-3 ml-2" />
                            <span>{formatDateReadable(update.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-surface-500 text-center py-4">
                  No status updates yet. Add the first one above.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Owner Assignment */}
          <div className="card">
            <h3 className="font-medium text-surface-900 mb-3 flex items-center gap-2">
              {actionItem.owner_user_id ? (
                <>
                  <UserCheck className="h-4 w-4" />
                  Owner
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Assign Owner
                </>
              )}
            </h3>

            {!assigningOwner ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                    {getInitials(
                      actionItem.owner?.full_name ||
                        actionItem.owner_name ||
                        'Unassigned'
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-surface-900">
                      {actionItem.owner?.full_name ||
                        actionItem.owner_name ||
                        'Unassigned'}
                    </p>
                    {actionItem.owner_email && (
                      <p className="text-sm text-surface-500">{actionItem.owner_email}</p>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => setAssigningOwner(true)}
                  variant={actionItem.owner_user_id ? "secondary" : "primary"}
                  size="sm"
                  className="w-full"
                  disabled={saving}
                >
                  {actionItem.owner_user_id ? 'Reassign Owner' : 'Assign Owner'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...projectMembers.map((m) => ({
                      value: m.id,
                      label: m.full_name || m.email,
                    }))
                  ]}
                  placeholder="Select owner"
                />

                <div className="flex gap-2">
                  <Button
                    onClick={handleOwnerAssignment}
                    size="sm"
                    className="flex-1"
                    disabled={!selectedOwnerId || saving}
                  >
                    {saving ? 'Assigning...' : 'Assign'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAssigningOwner(false);
                      setSelectedOwnerId('');
                    }}
                    size="sm"
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="card">
            <h3 className="font-medium text-surface-900 mb-3">Quick Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500">Status:</span>
                <Badge variant={statusVariant[actionItem.status]} size="sm">
                  {actionItem.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Created:</span>
                <span className="text-surface-900">
                  {formatDateReadable(actionItem.created_at)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Last Updated:</span>
                <span className="text-surface-900">
                  {formatDateReadable(actionItem.updated_at)}
                </span>
              </div>
              {actionItem.updates && actionItem.updates.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-surface-500">Updates:</span>
                  <span className="text-surface-900">{actionItem.updates.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Overdue Alert */}
          {actionItem.due_date && isOverdue(actionItem.due_date) && actionItem.status !== 'Closed' && (
            <div className="card border-danger-200 bg-danger-50">
              <div className="flex items-center gap-2 text-danger-700">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Overdue</span>
              </div>
              <p className="text-danger-600 text-sm mt-1">
                This action item was due on {formatDateReadable(actionItem.due_date)}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

