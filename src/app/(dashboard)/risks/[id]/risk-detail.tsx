'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Badge, Input, Select } from '@/components/ui';
import { formatDateReadable, getInitials, calculateRiskSeverity } from '@/lib/utils';
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
  Plus
} from 'lucide-react';
import type { RiskUpdate } from '@/types/database';
import type { EntityStatus, RiskSeverity } from '@/types/enums';

interface RiskDetailProps {
  risk: {
    id: string;
    title: string;
    description: string | null;
    probability: RiskSeverity;
    impact: RiskSeverity;
    mitigation: string | null;
    status: EntityStatus;
    owner_user_id: string | null;
    owner_name: string | null;
    owner_email: string | null;
    created_at: string;
    updated_at: string;
    project_id: string;
    source_meeting_id: string | null;
    updates: RiskUpdate[];
    owner?: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
    project?: { id: string; name: string } | null;
    source_meeting?: { id: string; title: string } | null;
  };
  projectMembers: Array<{ id: string; full_name: string; email: string }>;
  currentUserId: string;
}

export function RiskDetail({ risk: initialRisk, projectMembers, currentUserId }: RiskDetailProps) {
  const router = useRouter();
  const supabase = createClient();
  const [risk, setRisk] = useState(initialRisk);
  const [editing, setEditing] = useState(false);
  const [newUpdate, setNewUpdate] = useState('');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: risk.title,
    description: risk.description || '',
    probability: risk.probability,
    impact: risk.impact,
    mitigation: risk.mitigation || '',
    status: risk.status,
    owner_user_id: risk.owner_user_id || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('Client: Saving risk:', risk.id);
      const response = await fetch(`/api/risks/${risk.id}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          probability: formData.probability,
          impact: formData.impact,
          mitigation: formData.mitigation,
          status: formData.status,
          owner_user_id: formData.owner_user_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update risk');
      }

      // Update local state
      const owner = projectMembers.find(m => m.id === formData.owner_user_id);
      setRisk({
        ...risk,
        title: formData.title,
        description: formData.description || null,
        probability: formData.probability,
        impact: formData.impact,
        mitigation: formData.mitigation || null,
        status: formData.status,
        owner_user_id: formData.owner_user_id || null,
        owner_name: owner?.full_name || null,
        owner_email: owner?.email || null,
        owner: owner ? { id: owner.id, full_name: owner.full_name, email: owner.email, avatar_url: null } : null,
        updates: risk.updates, // Preserve updates array
      });

      setEditing(false);
      router.refresh();
    } catch (error: any) {
      console.error('Failed to update risk:', error);
      alert('Failed to update risk. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!newUpdate.trim()) return;

    setSaving(true);
    try {
      console.log('Client: Adding update for risk:', risk.id);
      const response = await fetch(`/api/risks/${risk.id}/update`, {
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
      const currentUpdates = Array.isArray(risk.updates) ? risk.updates : [];
      const updatedUpdates = [...currentUpdates, result.update];
      setRisk({ ...risk, updates: updatedUpdates });
      setNewUpdate('');
      router.refresh();
    } catch (error: any) {
      console.error('Failed to add update:', error);
      alert(`Failed to add status update: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const statusVariant: Record<string, 'default' | 'warning' | 'success'> = {
    Open: 'default',
    'In Progress': 'warning',
    Closed: 'success',
  };

  const severityVariant: Record<string, 'default' | 'warning' | 'danger'> = {
    Low: 'default',
    Med: 'warning',
    High: 'danger',
  };

  const severity = calculateRiskSeverity(risk.probability, risk.impact);

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
              {editing ? 'Edit Risk' : risk.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusVariant[risk.status]}>
                {risk.status}
              </Badge>
              <Badge variant={severityVariant[severity]}>
                {severity} Risk ({risk.probability}/{risk.impact})
              </Badge>
              <span className="text-sm text-surface-500">
                {risk.project?.name}
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
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Risk Details</h2>

            {!editing ? (
              <div className="space-y-4">
                {risk.description && (
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">
                      Description
                    </label>
                    <p className="text-surface-900">{risk.description}</p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">
                      Probability
                    </label>
                    <Badge variant={severityVariant[risk.probability === 'High' ? 'danger' : risk.probability === 'Med' ? 'warning' : 'default']}>
                      {risk.probability}
                    </Badge>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">
                      Impact
                    </label>
                    <Badge variant={severityVariant[risk.impact === 'High' ? 'danger' : risk.impact === 'Med' ? 'warning' : 'default']}>
                      {risk.impact}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Owner
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                      {getInitials(
                        risk.owner?.full_name ||
                          risk.owner_name ||
                          'Unassigned'
                      )}
                    </div>
                    <span className="text-surface-900">
                      {risk.owner?.full_name ||
                        risk.owner_name ||
                        'Unassigned'}
                    </span>
                  </div>
                </div>

                {risk.mitigation && (
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">
                      Mitigation Plan
                    </label>
                    <p className="text-surface-900">{risk.mitigation}</p>
                  </div>
                )}

                {risk.source_meeting && (
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">
                      Source Meeting
                    </label>
                    <p className="text-surface-900">
                      {risk.source_meeting.title}
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
                    placeholder="Detailed risk description"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Probability"
                    value={formData.probability}
                    onChange={(e) => setFormData({ ...formData, probability: e.target.value as RiskSeverity })}
                    options={[
                      { value: 'Low', label: 'Low' },
                      { value: 'Med', label: 'Medium' },
                      { value: 'High', label: 'High' },
                    ]}
                  />

                  <Select
                    label="Impact"
                    value={formData.impact}
                    onChange={(e) => setFormData({ ...formData, impact: e.target.value as RiskSeverity })}
                    options={[
                      { value: 'Low', label: 'Low' },
                      { value: 'Med', label: 'Medium' },
                      { value: 'High', label: 'High' },
                    ]}
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

                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">
                    Mitigation Plan
                  </label>
                  <textarea
                    value={formData.mitigation}
                    onChange={(e) => setFormData({ ...formData, mitigation: e.target.value })}
                    rows={3}
                    className="input resize-none"
                    placeholder="Describe how this risk will be mitigated"
                  />
                </div>
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
              {risk.updates && risk.updates.length > 0 ? (
                risk.updates.map((update) => (
                  <div key={update.id} className="border-l-2 border-primary-200 pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-surface-900">{update.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-sm text-surface-500">
                          <User className="h-3 w-3" />
                          <span>{update.created_by_name}</span>
                          <Clock className="h-3 w-3 ml-2" />
                          <span>{formatDateReadable(update.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
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
          {/* Quick Stats */}
          <div className="card">
            <h3 className="font-medium text-surface-900 mb-3">Quick Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500">Status:</span>
                <Badge variant={statusVariant[risk.status]} size="sm">
                  {risk.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Severity:</span>
                <Badge variant={severityVariant[severity]} size="sm">
                  {severity}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Created:</span>
                <span className="text-surface-900">
                  {formatDateReadable(risk.created_at)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Last Updated:</span>
                <span className="text-surface-900">
                  {formatDateReadable(risk.updated_at)}
                </span>
              </div>
              {risk.updates && risk.updates.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-surface-500">Updates:</span>
                  <span className="text-surface-900">{risk.updates.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* High Risk Alert */}
          {severity === 'High' && risk.status !== 'Closed' && (
            <div className="card border-danger-200 bg-danger-50">
              <div className="flex items-center gap-2 text-danger-700">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">High Risk</span>
              </div>
              <p className="text-danger-600 text-sm mt-1">
                This is a high-severity risk that requires immediate attention.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}