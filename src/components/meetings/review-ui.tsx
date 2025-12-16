'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Badge, Modal, ModalFooter, Select, Input, Textarea } from '@/components/ui';
import {
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Edit2,
  AlertTriangle,
  User,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { cn, formatDateReadable } from '@/lib/utils';
import type {
  ProposedChangeSet,
  ProposedActionItem,
  ProposedDecision,
  ProposedRisk,
  Profile,
  ProjectContact,
} from '@/types/database';

interface ReviewUIProps {
  meetingId: string;
  projectId: string;
  proposedChangeSet: ProposedChangeSet & { locked_by?: Profile | null };
  projectMembers: Profile[];
  projectContacts: ProjectContact[];
  lockHolder: Profile | null;
  isAdmin: boolean;
  currentUserId: string;
}

export function ReviewUI({
  meetingId,
  projectId,
  proposedChangeSet,
  projectMembers,
  projectContacts: initialProjectContacts,
  lockHolder,
  isAdmin,
  currentUserId,
}: ReviewUIProps) {
  const router = useRouter();
  const supabase = createClient();

  // Track project contacts locally so we can add new ones without page refresh
  const [projectContacts, setProjectContacts] = useState<ProjectContact[]>(initialProjectContacts);

  const [isLocked, setIsLocked] = useState(!!lockHolder);
  const [hasLock, setHasLock] = useState(
    proposedChangeSet.locked_by_user_id === currentUserId
  );
  const [proposedItems, setProposedItems] = useState(
    proposedChangeSet.proposed_items as {
      action_items: ProposedActionItem[];
      decisions: ProposedDecision[];
      risks: ProposedRisk[];
    }
  );
  const [expandedSections, setExpandedSections] = useState({
    action_items: true,
    decisions: true,
    risks: true,
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    type: 'action_item' | 'decision' | 'risk';
    id: string;
  } | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});

  // New contact modal state
  const [newContactModalOpen, setNewContactModalOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactTarget, setNewContactTarget] = useState<{
    type: 'action_items' | 'risks';
    tempId: string;
  } | null>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isAddingAllContacts, setIsAddingAllContacts] = useState(false);

  // Acquire lock when entering review mode
  const acquireLock = async () => {
    try {
      const { data, error } = await supabase.rpc('acquire_change_set_lock', {
        p_change_set_id: proposedChangeSet.id,
        p_user_id: currentUserId,
        p_expected_version: proposedChangeSet.lock_version,
      });

      if (error) throw error;

      if (data) {
        setHasLock(true);
        setIsLocked(false);
        router.refresh();
      } else {
        alert('Failed to acquire lock. Someone else may be reviewing.');
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to acquire lock:', error);
    }
  };

  // Release lock
  const releaseLock = async () => {
    try {
      await supabase.rpc('release_change_set_lock', {
        p_change_set_id: proposedChangeSet.id,
        p_user_id: currentUserId,
      });
      setHasLock(false);
      router.refresh();
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  };

  // Force unlock (admin only)
  const forceUnlock = async () => {
    if (!confirm('Are you sure you want to force unlock?')) return;

    try {
      await supabase.rpc('force_unlock_change_set', {
        p_change_set_id: proposedChangeSet.id,
      });
      router.refresh();
    } catch (error) {
      console.error('Failed to force unlock:', error);
    }
  };

  // Toggle item acceptance
  const toggleAccept = (
    type: 'action_items' | 'decisions' | 'risks',
    tempId: string
  ) => {
    setProposedItems((prev) => ({
      ...prev,
      [type]: prev[type].map((item: any) =>
        item.temp_id === tempId ? { ...item, accepted: !item.accepted } : item
      ),
    }));
  };

  // Update owner resolution (handles both users and contacts)
  const updateOwner = (
    type: 'action_items' | 'risks',
    tempId: string,
    selectedValue: string
  ) => {
    // Value is prefixed with 'user:' or 'contact:'
    const [ownerType, id] = selectedValue.includes(':')
      ? selectedValue.split(':')
      : ['user', selectedValue]; // Fallback for backwards compatibility

    if (ownerType === 'user') {
      const member = projectMembers.find((m) => m.id === id);
      if (!member) return;

      setProposedItems((prev) => ({
        ...prev,
        [type]: prev[type].map((item: any) =>
          item.temp_id === tempId
            ? {
                ...item,
                owner: {
                  name: member.full_name || member.email,
                  email: member.email,
                  resolved_user_id: member.id,
                  resolved_contact_id: null,
                },
                owner_resolution_status: 'resolved',
              }
            : item
        ),
      }));
    } else if (ownerType === 'contact') {
      const contact = projectContacts.find((c) => c.id === id);
      if (!contact) return;

      setProposedItems((prev) => ({
        ...prev,
        [type]: prev[type].map((item: any) =>
          item.temp_id === tempId
            ? {
                ...item,
                owner: {
                  name: contact.name,
                  email: contact.email,
                  resolved_user_id: null,
                  resolved_contact_id: contact.id,
                },
                owner_resolution_status: 'resolved',
              }
            : item
        ),
      }));
    }
  };

  // Accept unknown owner as placeholder
  const acceptAsPlaceholder = (
    type: 'action_items' | 'risks',
    tempId: string
  ) => {
    setProposedItems((prev) => ({
      ...prev,
      [type]: prev[type].map((item: any) =>
        item.temp_id === tempId
          ? {
              ...item,
              owner_resolution_status: 'placeholder',
            }
          : item
      ),
    }));
  };

  // Open modal to add new contact for a specific item
  const openAddContactModal = (
    type: 'action_items' | 'risks',
    tempId: string,
    ownerName: string
  ) => {
    setNewContactTarget({ type, tempId });
    setNewContactName(ownerName);
    setNewContactEmail('');
    setNewContactModalOpen(true);
  };

  // Add a single new contact via API and assign to item
  const addNewContact = async () => {
    if (!newContactName.trim() || !newContactTarget) return;

    setIsAddingContact(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContactName.trim(),
          email: newContactEmail.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create contact');
      }

      const { contact } = await response.json();

      // Add to local contacts list
      setProjectContacts((prev) => [...prev, contact]);

      // Assign to the target item
      setProposedItems((prev) => ({
        ...prev,
        [newContactTarget.type]: prev[newContactTarget.type].map((item: any) =>
          item.temp_id === newContactTarget.tempId
            ? {
                ...item,
                owner: {
                  name: contact.name,
                  email: contact.email,
                  resolved_user_id: null,
                  resolved_contact_id: contact.id,
                },
                owner_resolution_status: 'resolved',
              }
            : item
        ),
      }));

      // Close modal and reset
      setNewContactModalOpen(false);
      setNewContactName('');
      setNewContactEmail('');
      setNewContactTarget(null);
    } catch (error) {
      console.error('Failed to add contact:', error);
      alert('Failed to add contact: ' + (error as Error).message);
    } finally {
      setIsAddingContact(false);
    }
  };

  // Get all unique unresolved owner names from action items and risks
  const getUnresolvedOwnerNames = () => {
    const unresolvedNames = new Map<string, { type: 'action_items' | 'risks'; tempId: string }[]>();

    proposedItems.action_items
      .filter((item) => item.accepted && ['unknown', 'ambiguous', 'conference_room'].includes(item.owner_resolution_status))
      .forEach((item) => {
        const name = item.owner.name;
        if (!unresolvedNames.has(name)) {
          unresolvedNames.set(name, []);
        }
        unresolvedNames.get(name)!.push({ type: 'action_items', tempId: item.temp_id });
      });

    proposedItems.risks
      .filter((item) => item.accepted && ['unknown', 'ambiguous', 'conference_room'].includes(item.owner_resolution_status))
      .forEach((item) => {
        const name = item.owner.name;
        if (!unresolvedNames.has(name)) {
          unresolvedNames.set(name, []);
        }
        unresolvedNames.get(name)!.push({ type: 'risks', tempId: item.temp_id });
      });

    return unresolvedNames;
  };

  // Add all unresolved names as contacts
  const addAllNewContacts = async () => {
    const unresolvedNames = getUnresolvedOwnerNames();
    if (unresolvedNames.size === 0) return;

    setIsAddingAllContacts(true);
    try {
      for (const [name, items] of unresolvedNames) {
        // Create contact
        const response = await fetch(`/api/projects/${projectId}/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });

        if (!response.ok) {
          const data = await response.json();
          // Skip if contact already exists, continue with others
          if (response.status === 409) continue;
          throw new Error(data.error || 'Failed to create contact');
        }

        const { contact } = await response.json();

        // Add to local contacts list
        setProjectContacts((prev) => [...prev, contact]);

        // Update all items with this owner name
        setProposedItems((prev) => {
          const updated = { ...prev };
          for (const item of items) {
            updated[item.type] = updated[item.type].map((i: any) =>
              i.temp_id === item.tempId
                ? {
                    ...i,
                    owner: {
                      name: contact.name,
                      email: contact.email,
                      resolved_user_id: null,
                      resolved_contact_id: contact.id,
                    },
                    owner_resolution_status: 'resolved',
                  }
                : i
            );
          }
          return updated;
        });
      }
    } catch (error) {
      console.error('Failed to add contacts:', error);
      alert('Failed to add some contacts: ' + (error as Error).message);
    } finally {
      setIsAddingAllContacts(false);
    }
  };

  // Start editing an item
  const startEditing = (type: 'action_items' | 'decisions' | 'risks', tempId: string) => {
    const item = proposedItems[type].find((item: any) => item.temp_id === tempId);
    if (!item) return;

    setEditingItem({ type: type.replace('_items', '_item') as any, id: tempId });
    setEditFormData({ ...item });
    setEditModalOpen(true);
  };

  // Save edited item
  const saveEditedItem = () => {
    if (!editingItem) return;

    const type = editingItem.type === 'action_item' ? 'action_items' :
                 editingItem.type === 'decision' ? 'decisions' : 'risks';

    setProposedItems((prev) => ({
      ...prev,
      [type]: prev[type].map((item: any) =>
        item.temp_id === editingItem.id ? { ...item, ...editFormData } : item
      ),
    }));

    setEditModalOpen(false);
    setEditingItem(null);
    setEditFormData({});
  };

  // Reject an item (set accepted to false)
  const rejectItem = (type: 'action_items' | 'decisions' | 'risks', tempId: string) => {
    if (!confirm('Are you sure you want to reject this item? It will not be included when publishing.')) return;

    setProposedItems((prev) => ({
      ...prev,
      [type]: prev[type].map((item: any) =>
        item.temp_id === tempId ? { ...item, accepted: false } : item
      ),
    }));
  };

  // Save changes
  const saveChanges = async () => {
    try {
      const { error } = await supabase
        .from('proposed_change_sets')
        .update({ proposed_items: proposedItems })
        .eq('id', proposedChangeSet.id);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save changes:', error);
      alert('Failed to save changes');
    }
  };

  // Check if can publish (only truly blocking issues)
  const canPublish = () => {
    // Only block on ambiguous and conference_room owners
    // Unknown owners can be published as placeholders
    const blockingActionItems = proposedItems.action_items.filter(
      (ai) =>
        ai.accepted &&
        ['ambiguous', 'conference_room'].includes(
          ai.owner_resolution_status
        )
    );
    const blockingRisks = proposedItems.risks.filter(
      (r) =>
        r.accepted &&
        ['ambiguous', 'conference_room'].includes(
          r.owner_resolution_status
        )
    );
    return blockingActionItems.length === 0 && blockingRisks.length === 0;
  };

  // Publish changes
  const handlePublish = async () => {
    if (!canPublish()) {
      alert('Please resolve all owners before publishing');
      return;
    }

    setIsPublishing(true);

    try {
      await saveChanges();

      const response = await fetch(`/api/meetings/${meetingId}/publish`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Publish failed');
      }

      router.push(`/meetings/${meetingId}`);
      router.refresh();
    } catch (error) {
      console.error('Publish failed:', error);
      alert('Failed to publish: ' + (error as Error).message);
    } finally {
      setIsPublishing(false);
    }
  };

  const operationBadge = (op: string) => {
    const variants: Record<string, 'success' | 'warning' | 'default'> = {
      create: 'success',
      update: 'warning',
      close: 'default',
    };
    return <Badge variant={variants[op] || 'default'}>{op}</Badge>;
  };

  const resolutionStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'success' | 'warning' | 'danger' | 'primary'; label: string }> = {
      resolved: { variant: 'success', label: 'Resolved' },
      needs_confirmation: { variant: 'warning', label: 'Needs Confirmation' },
      ambiguous: { variant: 'danger', label: 'Ambiguous' },
      conference_room: { variant: 'danger', label: 'Conference Room' },
      unknown: { variant: 'danger', label: 'Unknown' },
      placeholder: { variant: 'primary', label: 'Placeholder' },
    };
    const { variant, label } = config[status] || { variant: 'default' as any, label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  // Lock banner
  if (isLocked && lockHolder) {
    return (
      <div className="card border-warning-200 bg-warning-50">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-warning-600" />
          <div className="flex-1">
            <p className="font-medium text-warning-700">
              Locked by {lockHolder.full_name || lockHolder.email}
            </p>
            <p className="text-sm text-warning-600">
              Currently reviewing. Please wait or contact them.
            </p>
          </div>
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={forceUnlock}>
              <Unlock className="h-4 w-4" />
              Force Unlock
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lock controls */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-3">
          {hasLock ? (
            <>
              <Lock className="h-5 w-5 text-success-500" />
              <span className="text-sm text-surface-600">
                You are reviewing this meeting
              </span>
            </>
          ) : (
            <>
              <Unlock className="h-5 w-5 text-surface-400" />
              <span className="text-sm text-surface-600">
                Click to start reviewing
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {hasLock ? (
            <>
              <Button variant="secondary" onClick={releaseLock}>
                Release Lock
              </Button>
              <Button
                onClick={handlePublish}
                isLoading={isPublishing}
                disabled={!canPublish()}
              >
                Publish Changes
              </Button>
            </>
          ) : (
            <Button onClick={acquireLock}>Start Review</Button>
          )}
        </div>
      </div>

      {/* Warning if blocking owner issues */}
      {!canPublish() && hasLock && (
        <div className="card border-warning-200 bg-warning-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-600" />
            <p className="text-warning-700">
              Some owners have ambiguous or invalid assignments that must be resolved before publishing
            </p>
          </div>
        </div>
      )}

      {/* Add All New Names button when there are unresolved owners */}
      {hasLock && getUnresolvedOwnerNames().size > 0 && (
        <div className="card border-primary-200 bg-primary-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-primary-700">
                  {getUnresolvedOwnerNames().size} unresolved name{getUnresolvedOwnerNames().size !== 1 ? 's' : ''} found
                </p>
                <p className="text-sm text-primary-600">
                  Add all new names as project contacts in one click
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={addAllNewContacts}
              isLoading={isAddingAllContacts}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Add All as Contacts
            </Button>
          </div>
        </div>
      )}

      {/* Action Items Section */}
      <div className="card">
        <button
          onClick={() =>
            setExpandedSections((s) => ({
              ...s,
              action_items: !s.action_items,
            }))
          }
          className="flex w-full items-center justify-between"
        >
          <h2 className="text-lg font-semibold text-surface-900">
            Action Items ({proposedItems.action_items.length})
          </h2>
          {expandedSections.action_items ? (
            <ChevronUp className="h-5 w-5 text-surface-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-surface-400" />
          )}
        </button>

        {expandedSections.action_items && (
          <div className="mt-4 space-y-4">
            {proposedItems.action_items.length === 0 ? (
              <p className="text-surface-500">No action items extracted</p>
            ) : (
              proposedItems.action_items.map((item) => (
                <div
                  key={item.temp_id}
                  className={cn(
                    'rounded-lg border p-4',
                    item.accepted
                      ? 'border-surface-200 bg-white'
                      : 'border-surface-200 bg-surface-50 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {operationBadge(item.operation)}
                        <h3 className="font-medium text-surface-900">
                          {item.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm text-surface-600">
                        {item.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-surface-500">
                          <User className="h-4 w-4" />
                          {item.owner.name}
                          {resolutionStatusBadge(item.owner_resolution_status)}
                        </span>
                        {item.due_date && (
                          <span className="text-surface-500">
                            Due: {formatDateReadable(item.due_date)}
                          </span>
                        )}
                      </div>
                      {/* Owner resolution controls */}
                      {hasLock &&
                        ['unknown', 'ambiguous', 'conference_room', 'needs_confirmation'].includes(
                          item.owner_resolution_status
                        ) && (
                          <div className="mt-3 space-y-2">
                            {item.owner_resolution_status === 'unknown' && (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => acceptAsPlaceholder('action_items', item.temp_id)}
                                >
                                  Accept as Placeholder
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openAddContactModal('action_items', item.temp_id, item.owner.name)}
                                >
                                  <UserPlus className="h-3 w-3 mr-1" />
                                  Add as Contact
                                </Button>
                                <span className="text-xs text-surface-500 self-center">
                                  or select existing:
                                </span>
                              </div>
                            )}
                            {['ambiguous', 'conference_room', 'needs_confirmation'].includes(item.owner_resolution_status) && (
                              <div className="flex gap-2 mb-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openAddContactModal('action_items', item.temp_id, item.owner.name)}
                                >
                                  <UserPlus className="h-3 w-3 mr-1" />
                                  Add &quot;{item.owner.name}&quot; as Contact
                                </Button>
                              </div>
                            )}
                            <Select
                              value={
                                item.owner.resolved_user_id
                                  ? `user:${item.owner.resolved_user_id}`
                                  : item.owner.resolved_contact_id
                                    ? `contact:${item.owner.resolved_contact_id}`
                                    : ''
                              }
                              onChange={(e) =>
                                updateOwner(
                                  'action_items',
                                  item.temp_id,
                                  e.target.value
                                )
                              }
                              options={[
                                ...projectMembers.map((m) => ({
                                  value: `user:${m.id}`,
                                  label: m.full_name || m.email,
                                })),
                                ...projectContacts.map((c) => ({
                                  value: `contact:${c.id}`,
                                  label: `${c.name}${c.email ? ` (${c.email})` : ''} [Contact]`,
                                })),
                              ]}
                              placeholder="Select existing member or contact"
                              className="w-64"
                            />
                          </div>
                        )}
                      {/* Evidence */}
                      {item.evidence.length > 0 && (
                        <div className="mt-3 rounded bg-surface-50 p-2">
                          <p className="text-xs font-medium text-surface-500">
                            Evidence
                          </p>
                          {item.evidence.map((e, i) => (
                            <p
                              key={i}
                              className="mt-1 text-sm italic text-surface-600"
                            >
                              &ldquo;{e.quote}&rdquo;
                              {e.speaker && (
                                <span className="not-italic">
                                  {' '}
                                  - {e.speaker}
                                </span>
                              )}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    {hasLock && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditing('action_items', item.temp_id)}
                          className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"
                          title="Edit description"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => rejectItem('action_items', item.temp_id)}
                          className="rounded-lg p-2 text-danger-500 hover:bg-danger-50"
                          title="Reject item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            toggleAccept('action_items', item.temp_id)
                          }
                          className={cn(
                            'rounded-lg p-2',
                            item.accepted
                              ? 'text-success-500 hover:bg-success-50'
                              : 'text-surface-400 hover:bg-surface-100'
                          )}
                          title={item.accepted ? 'Accepted' : 'Not accepted'}
                        >
                          {item.accepted ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Decisions Section */}
      <div className="card">
        <button
          onClick={() =>
            setExpandedSections((s) => ({ ...s, decisions: !s.decisions }))
          }
          className="flex w-full items-center justify-between"
        >
          <h2 className="text-lg font-semibold text-surface-900">
            Decisions ({proposedItems.decisions.length})
          </h2>
          {expandedSections.decisions ? (
            <ChevronUp className="h-5 w-5 text-surface-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-surface-400" />
          )}
        </button>

        {expandedSections.decisions && (
          <div className="mt-4 space-y-4">
            {proposedItems.decisions.length === 0 ? (
              <p className="text-surface-500">No decisions extracted</p>
            ) : (
              proposedItems.decisions.map((item) => (
                <div
                  key={item.temp_id}
                  className={cn(
                    'rounded-lg border p-4',
                    item.accepted
                      ? 'border-surface-200 bg-white'
                      : 'border-surface-200 bg-surface-50 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {operationBadge(item.operation)}
                        <h3 className="font-medium text-surface-900">
                          {item.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm text-surface-600">
                        <strong>Rationale:</strong> {item.rationale}
                      </p>
                      <p className="mt-1 text-sm text-surface-600">
                        <strong>Outcome:</strong> {item.outcome}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-surface-500">
                          <User className="h-4 w-4" />
                          Decision maker: {item.decision_maker.name}
                        </span>
                      </div>
                    </div>
                    {hasLock && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditing('decisions', item.temp_id)}
                          className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"
                          title="Edit decision"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => rejectItem('decisions', item.temp_id)}
                          className="rounded-lg p-2 text-danger-500 hover:bg-danger-50"
                          title="Reject item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            toggleAccept('decisions', item.temp_id)
                          }
                          className={cn(
                            'rounded-lg p-2',
                            item.accepted
                              ? 'text-success-500 hover:bg-success-50'
                              : 'text-surface-400 hover:bg-surface-100'
                          )}
                          title={item.accepted ? 'Accepted' : 'Not accepted'}
                        >
                          {item.accepted ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Risks Section */}
      <div className="card">
        <button
          onClick={() =>
            setExpandedSections((s) => ({ ...s, risks: !s.risks }))
          }
          className="flex w-full items-center justify-between"
        >
          <h2 className="text-lg font-semibold text-surface-900">
            Risks & Issues ({proposedItems.risks.length})
          </h2>
          {expandedSections.risks ? (
            <ChevronUp className="h-5 w-5 text-surface-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-surface-400" />
          )}
        </button>

        {expandedSections.risks && (
          <div className="mt-4 space-y-4">
            {proposedItems.risks.length === 0 ? (
              <p className="text-surface-500">No risks extracted</p>
            ) : (
              proposedItems.risks.map((item) => (
                <div
                  key={item.temp_id}
                  className={cn(
                    'rounded-lg border p-4',
                    item.accepted
                      ? 'border-surface-200 bg-white'
                      : 'border-surface-200 bg-surface-50 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {operationBadge(item.operation)}
                        <h3 className="font-medium text-surface-900">
                          {item.title}
                        </h3>
                        <Badge
                          variant={
                            item.probability === 'High' || item.impact === 'High'
                              ? 'danger'
                              : item.probability === 'Med' || item.impact === 'Med'
                                ? 'warning'
                                : 'default'
                          }
                        >
                          {item.probability}/{item.impact}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-surface-600">
                        {item.description}
                      </p>
                      <p className="mt-1 text-sm text-surface-600">
                        <strong>Mitigation:</strong> {item.mitigation}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-surface-500">
                          <User className="h-4 w-4" />
                          {item.owner.name}
                          {resolutionStatusBadge(item.owner_resolution_status)}
                        </span>
                      </div>
                      {/* Owner resolution controls */}
                      {hasLock &&
                        ['unknown', 'ambiguous', 'conference_room', 'needs_confirmation'].includes(
                          item.owner_resolution_status
                        ) && (
                          <div className="mt-3 space-y-2">
                            {item.owner_resolution_status === 'unknown' && (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => acceptAsPlaceholder('risks', item.temp_id)}
                                >
                                  Accept as Placeholder
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openAddContactModal('risks', item.temp_id, item.owner.name)}
                                >
                                  <UserPlus className="h-3 w-3 mr-1" />
                                  Add as Contact
                                </Button>
                                <span className="text-xs text-surface-500 self-center">
                                  or select existing:
                                </span>
                              </div>
                            )}
                            {['ambiguous', 'conference_room', 'needs_confirmation'].includes(item.owner_resolution_status) && (
                              <div className="flex gap-2 mb-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openAddContactModal('risks', item.temp_id, item.owner.name)}
                                >
                                  <UserPlus className="h-3 w-3 mr-1" />
                                  Add &quot;{item.owner.name}&quot; as Contact
                                </Button>
                              </div>
                            )}
                            <Select
                              value={
                                item.owner.resolved_user_id
                                  ? `user:${item.owner.resolved_user_id}`
                                  : item.owner.resolved_contact_id
                                    ? `contact:${item.owner.resolved_contact_id}`
                                    : ''
                              }
                              onChange={(e) =>
                                updateOwner('risks', item.temp_id, e.target.value)
                              }
                              options={[
                                ...projectMembers.map((m) => ({
                                  value: `user:${m.id}`,
                                  label: m.full_name || m.email,
                                })),
                                ...projectContacts.map((c) => ({
                                  value: `contact:${c.id}`,
                                  label: `${c.name}${c.email ? ` (${c.email})` : ''} [Contact]`,
                                })),
                              ]}
                              placeholder="Select existing member or contact"
                              className="w-64"
                            />
                          </div>
                        )}
                    </div>
                    {hasLock && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditing('risks', item.temp_id)}
                          className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"
                          title="Edit risk"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => rejectItem('risks', item.temp_id)}
                          className="rounded-lg p-2 text-danger-500 hover:bg-danger-50"
                          title="Reject item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleAccept('risks', item.temp_id)}
                          className={cn(
                            'rounded-lg p-2',
                            item.accepted
                              ? 'text-success-500 hover:bg-success-50'
                              : 'text-surface-400 hover:bg-surface-100'
                          )}
                          title={item.accepted ? 'Accepted' : 'Not accepted'}
                        >
                          {item.accepted ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingItem(null);
          setEditFormData({});
        }}
        title={`Edit ${editingItem?.type?.replace('_', ' ').toUpperCase()}`}
      >
        <div className="space-y-4">
          {editingItem?.type === 'action_item' && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Title
                </label>
                <Input
                  value={editFormData.title || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  placeholder="Action item title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Description
                </label>
                <Textarea
                  value={editFormData.description || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Action item description"
                  rows={3}
                />
              </div>
            </>
          )}

          {editingItem?.type === 'decision' && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Title
                </label>
                <Input
                  value={editFormData.title || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  placeholder="Decision title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Rationale
                </label>
                <Textarea
                  value={editFormData.rationale || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, rationale: e.target.value })}
                  placeholder="Decision rationale"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Outcome
                </label>
                <Textarea
                  value={editFormData.outcome || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, outcome: e.target.value })}
                  placeholder="Decision outcome"
                  rows={2}
                />
              </div>
            </>
          )}

          {editingItem?.type === 'risk' && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Title
                </label>
                <Input
                  value={editFormData.title || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  placeholder="Risk title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Description
                </label>
                <Textarea
                  value={editFormData.description || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Risk description"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Mitigation
                </label>
                <Textarea
                  value={editFormData.mitigation || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, mitigation: e.target.value })}
                  placeholder="Risk mitigation"
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setEditModalOpen(false);
              setEditingItem(null);
              setEditFormData({});
            }}
          >
            Cancel
          </Button>
          <Button onClick={saveEditedItem}>
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>

      {/* New Contact Modal */}
      <Modal
        isOpen={newContactModalOpen}
        onClose={() => {
          setNewContactModalOpen(false);
          setNewContactName('');
          setNewContactEmail('');
          setNewContactTarget(null);
        }}
        title="Add New Contact"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600">
            Add this person as a project contact. They will be available for assignment on all items in this project.
          </p>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Name <span className="text-danger-500">*</span>
            </label>
            <Input
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="Contact name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Email <span className="text-surface-400">(optional)</span>
            </label>
            <Input
              type="email"
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
              placeholder="contact@example.com"
            />
          </div>
        </div>

        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setNewContactModalOpen(false);
              setNewContactName('');
              setNewContactEmail('');
              setNewContactTarget(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={addNewContact}
            isLoading={isAddingContact}
            disabled={!newContactName.trim()}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Add Contact
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

