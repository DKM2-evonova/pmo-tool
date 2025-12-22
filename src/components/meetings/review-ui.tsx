'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { AlertTriangle, ChevronDown, ChevronUp, UserPlus } from 'lucide-react';
import { findSimilarNames, buildPeopleRoster, type PersonMatch } from '@/lib/utils/name-matching';
import {
  EditItemModal,
  NewContactModal,
  LockBanner,
  LockControls,
  ActionItemCard,
  DecisionCard,
  RiskCard,
  buildOwnerOptions,
  type ProposedItems,
  type EditFormData,
  type EditingItem,
  type NewContactTarget,
} from './review';
import type {
  ProposedChangeSet,
  ProposedActionItem,
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
  const { showToast } = useToast();

  // Track project contacts locally so we can add new ones without page refresh
  const [projectContacts, setProjectContacts] = useState<ProjectContact[]>(initialProjectContacts);

  const [isLocked, setIsLocked] = useState(!!lockHolder);
  const [hasLock, setHasLock] = useState(
    proposedChangeSet.locked_by_user_id === currentUserId
  );
  const [proposedItems, setProposedItems] = useState<ProposedItems>(
    proposedChangeSet.proposed_items as ProposedItems
  );
  const [expandedSections, setExpandedSections] = useState({
    action_items: true,
    decisions: true,
    risks: true,
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({});

  // New contact modal state
  const [newContactModalOpen, setNewContactModalOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactTarget, setNewContactTarget] = useState<NewContactTarget | null>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isAddingAllContacts, setIsAddingAllContacts] = useState(false);

  // Similar name detection state
  const [similarNameMatches, setSimilarNameMatches] = useState<PersonMatch[]>([]);
  const [showSimilarNameWarning, setShowSimilarNameWarning] = useState(false);
  const [forceAddContact, setForceAddContact] = useState(false);

  // Memoized owner options for dropdowns
  const ownerOptions = useMemo(
    () => buildOwnerOptions(projectMembers, projectContacts),
    [projectMembers, projectContacts]
  );

  // Acquire lock when entering review mode
  const acquireLock = useCallback(async () => {
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
        showToast('Failed to acquire lock. Someone else may be reviewing.', 'warning');
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to acquire lock:', error);
    }
  }, [supabase, proposedChangeSet.id, proposedChangeSet.lock_version, currentUserId, router, showToast]);

  // Release lock
  const releaseLock = useCallback(async () => {
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
  }, [supabase, proposedChangeSet.id, currentUserId, router]);

  // Force unlock (admin only)
  const forceUnlock = useCallback(async () => {
    if (!confirm('Are you sure you want to force unlock?')) return;

    try {
      await supabase.rpc('force_unlock_change_set', {
        p_change_set_id: proposedChangeSet.id,
      });
      router.refresh();
    } catch (error) {
      console.error('Failed to force unlock:', error);
    }
  }, [supabase, proposedChangeSet.id, router]);

  // Toggle item acceptance
  const toggleAccept = useCallback(
    (type: 'action_items' | 'decisions' | 'risks', tempId: string) => {
      setProposedItems((prev) => ({
        ...prev,
        [type]: prev[type].map((item) =>
          item.temp_id === tempId ? { ...item, accepted: !item.accepted } : item
        ),
      }));
    },
    []
  );

  // Helper to get original owner name from an item
  const getItemOwnerName = useCallback(
    (type: 'action_items' | 'risks', tempId: string): string | null => {
      const items = proposedItems[type];
      const item = items.find((i) => i.temp_id === tempId);
      return item?.owner?.name || null;
    },
    [proposedItems]
  );

  // Apply owner resolution to all items with matching owner name
  const applyOwnerToAllMatching = useCallback(
    (
      ownerName: string,
      newOwner: {
        name: string;
        email: string | null;
        resolved_user_id: string | null;
        resolved_contact_id: string | null;
      },
      newStatus: string
    ) => {
      const normalizedName = ownerName.toLowerCase();

      setProposedItems((prev) => ({
        ...prev,
        action_items: prev.action_items.map((item: ProposedActionItem) =>
          item.owner?.name?.toLowerCase() === normalizedName
            ? { ...item, owner: newOwner, owner_resolution_status: newStatus }
            : item
        ),
        risks: prev.risks.map((item: ProposedRisk) =>
          item.owner?.name?.toLowerCase() === normalizedName
            ? { ...item, owner: newOwner, owner_resolution_status: newStatus }
            : item
        ),
      }));
    },
    []
  );

  // Update owner resolution (handles both users and contacts)
  const updateOwner = useCallback(
    (type: 'action_items' | 'risks', tempId: string, selectedValue: string) => {
      const originalOwnerName = getItemOwnerName(type, tempId);
      if (!originalOwnerName) return;

      const [ownerType, id] = selectedValue.includes(':')
        ? selectedValue.split(':')
        : ['user', selectedValue];

      if (ownerType === 'user') {
        const member = projectMembers.find((m) => m.id === id);
        if (!member) return;

        const newOwner = {
          name: member.full_name || member.email,
          email: member.email,
          resolved_user_id: member.id,
          resolved_contact_id: null,
        };
        applyOwnerToAllMatching(originalOwnerName, newOwner, 'resolved');
      } else if (ownerType === 'contact') {
        const contact = projectContacts.find((c) => c.id === id);
        if (!contact) return;

        const newOwner = {
          name: contact.name,
          email: contact.email,
          resolved_user_id: null,
          resolved_contact_id: contact.id,
        };
        applyOwnerToAllMatching(originalOwnerName, newOwner, 'resolved');
      }
    },
    [projectMembers, projectContacts, getItemOwnerName, applyOwnerToAllMatching]
  );

  // Accept unknown owner as placeholder
  const acceptAsPlaceholder = useCallback(
    (type: 'action_items' | 'risks', tempId: string) => {
      const originalOwnerName = getItemOwnerName(type, tempId);
      if (!originalOwnerName) return;

      const normalizedName = originalOwnerName.toLowerCase();

      setProposedItems((prev) => ({
        ...prev,
        action_items: prev.action_items.map((item: ProposedActionItem) =>
          item.owner?.name?.toLowerCase() === normalizedName
            ? { ...item, owner_resolution_status: 'placeholder' }
            : item
        ),
        risks: prev.risks.map((item: ProposedRisk) =>
          item.owner?.name?.toLowerCase() === normalizedName
            ? { ...item, owner_resolution_status: 'placeholder' }
            : item
        ),
      }));
    },
    [getItemOwnerName]
  );

  // Open modal to add new contact for a specific item
  const openAddContactModal = useCallback(
    (type: 'action_items' | 'risks', tempId: string, ownerName: string) => {
      setNewContactTarget({ type, tempId });
      setNewContactName(ownerName);
      setNewContactEmail('');
      setForceAddContact(false);
      setShowSimilarNameWarning(false);

      const roster = buildPeopleRoster(
        projectMembers.map((m) => ({
          id: m.id,
          full_name: m.full_name,
          email: m.email,
        })),
        projectContacts
      );
      const { hasSimilarNames, matches } = findSimilarNames(ownerName, roster);

      if (hasSimilarNames) {
        setSimilarNameMatches(matches);
        setShowSimilarNameWarning(true);
      } else {
        setSimilarNameMatches([]);
      }

      setNewContactModalOpen(true);
    },
    [projectMembers, projectContacts]
  );

  // Handle selecting an existing match from similar names
  const selectExistingMatch = useCallback(
    (match: PersonMatch) => {
      if (!newContactTarget) return;

      const newOwner = {
        name: match.name,
        email: match.email,
        resolved_user_id: match.type === 'user' ? match.id : null,
        resolved_contact_id: match.type === 'contact' ? match.id : null,
      };

      const originalOwnerName = getItemOwnerName(newContactTarget.type, newContactTarget.tempId);
      if (originalOwnerName) {
        applyOwnerToAllMatching(originalOwnerName, newOwner, 'resolved');
      }

      setNewContactModalOpen(false);
      setNewContactName('');
      setNewContactEmail('');
      setNewContactTarget(null);
      setSimilarNameMatches([]);
      setShowSimilarNameWarning(false);
      setForceAddContact(false);
    },
    [newContactTarget, getItemOwnerName, applyOwnerToAllMatching]
  );

  // Confirm adding as new person despite similar names
  const confirmAddAsNew = useCallback(() => {
    setForceAddContact(true);
    setShowSimilarNameWarning(false);
  }, []);

  // Close new contact modal
  const closeNewContactModal = useCallback(() => {
    setNewContactModalOpen(false);
    setNewContactName('');
    setNewContactEmail('');
    setNewContactTarget(null);
    setSimilarNameMatches([]);
    setShowSimilarNameWarning(false);
    setForceAddContact(false);
  }, []);

  // Add a single new contact via API and assign to item
  const addNewContact = useCallback(async () => {
    if (!newContactName.trim() || !newContactTarget) return;

    if (showSimilarNameWarning && !forceAddContact) {
      return;
    }

    setIsAddingContact(true);
    try {
      const originalOwnerName = getItemOwnerName(newContactTarget.type, newContactTarget.tempId);

      const response = await fetch(
        `/api/projects/${projectId}/contacts${forceAddContact ? '?force=true' : ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newContactName.trim(),
            email: newContactEmail.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'similar_names_found' && data.matches) {
          setSimilarNameMatches(data.matches);
          setShowSimilarNameWarning(true);
          setForceAddContact(false);
          return;
        }
        throw new Error(data.error || 'Failed to create contact');
      }

      const { contact } = await response.json();

      setProjectContacts((prev) => [...prev, contact]);

      if (originalOwnerName) {
        const newOwner = {
          name: contact.name,
          email: contact.email,
          resolved_user_id: null,
          resolved_contact_id: contact.id,
        };
        applyOwnerToAllMatching(originalOwnerName, newOwner, 'resolved');
      }

      closeNewContactModal();
    } catch (error) {
      console.error('Failed to add contact:', error);
      showToast('Failed to add contact: ' + (error as Error).message, 'error');
    } finally {
      setIsAddingContact(false);
    }
  }, [
    newContactName,
    newContactEmail,
    newContactTarget,
    showSimilarNameWarning,
    forceAddContact,
    projectId,
    getItemOwnerName,
    applyOwnerToAllMatching,
    closeNewContactModal,
    showToast,
  ]);

  // Get all unique unresolved owner names from action items and risks
  const unresolvedOwnerNames = useMemo(() => {
    const names = new Map<string, { type: 'action_items' | 'risks'; tempId: string }[]>();

    proposedItems.action_items
      .filter(
        (item) =>
          item.accepted &&
          ['unknown', 'ambiguous', 'conference_room'].includes(item.owner_resolution_status)
      )
      .forEach((item) => {
        const name = item.owner.name;
        if (!names.has(name)) {
          names.set(name, []);
        }
        names.get(name)!.push({ type: 'action_items', tempId: item.temp_id });
      });

    proposedItems.risks
      .filter(
        (item) =>
          item.accepted &&
          ['unknown', 'ambiguous', 'conference_room'].includes(item.owner_resolution_status)
      )
      .forEach((item) => {
        const name = item.owner.name;
        if (!names.has(name)) {
          names.set(name, []);
        }
        names.get(name)!.push({ type: 'risks', tempId: item.temp_id });
      });

    return names;
  }, [proposedItems]);

  // Add all unresolved names as contacts
  const addAllNewContacts = useCallback(async () => {
    if (unresolvedOwnerNames.size === 0) return;

    setIsAddingAllContacts(true);
    try {
      for (const [name, items] of unresolvedOwnerNames) {
        const response = await fetch(`/api/projects/${projectId}/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });

        if (!response.ok) {
          if (response.status === 409) continue;
          const data = await response.json();
          throw new Error(data.error || 'Failed to create contact');
        }

        const { contact } = await response.json();

        setProjectContacts((prev) => [...prev, contact]);

        setProposedItems((prev) => {
          const newOwner = {
            name: contact.name,
            email: contact.email,
            resolved_user_id: null,
            resolved_contact_id: contact.id,
          };

          const actionItemIds = items.filter(i => i.type === 'action_items').map(i => i.tempId);
          const riskIds = items.filter(i => i.type === 'risks').map(i => i.tempId);

          return {
            ...prev,
            action_items: prev.action_items.map((i) =>
              actionItemIds.includes(i.temp_id)
                ? { ...i, owner: newOwner, owner_resolution_status: 'resolved' }
                : i
            ),
            risks: prev.risks.map((i) =>
              riskIds.includes(i.temp_id)
                ? { ...i, owner: newOwner, owner_resolution_status: 'resolved' }
                : i
            ),
          };
        });
      }
    } catch (error) {
      console.error('Failed to add contacts:', error);
      showToast('Failed to add some contacts: ' + (error as Error).message, 'error');
    } finally {
      setIsAddingAllContacts(false);
    }
  }, [unresolvedOwnerNames, projectId, showToast]);

  // Start editing an item
  const startEditing = useCallback(
    (type: 'action_items' | 'decisions' | 'risks', tempId: string) => {
      const item = proposedItems[type].find((item) => item.temp_id === tempId);
      if (!item) return;

      setEditingItem({
        type: type.replace('_items', '_item').replace('decisions', 'decision') as EditingItem['type'],
        id: tempId,
      });
      setEditFormData({ ...item });
      setEditModalOpen(true);
    },
    [proposedItems]
  );

  // Close edit modal
  const closeEditModal = useCallback(() => {
    setEditModalOpen(false);
    setEditingItem(null);
    setEditFormData({});
  }, []);

  // Save edited item
  const saveEditedItem = useCallback(() => {
    if (!editingItem) return;

    const type =
      editingItem.type === 'action_item'
        ? 'action_items'
        : editingItem.type === 'decision'
          ? 'decisions'
          : 'risks';

    setProposedItems((prev) => ({
      ...prev,
      [type]: prev[type].map((item) =>
        item.temp_id === editingItem.id ? { ...item, ...editFormData } : item
      ),
    }));

    closeEditModal();
  }, [editingItem, editFormData, closeEditModal]);

  // Reject an item (set accepted to false)
  const rejectItem = useCallback(
    (type: 'action_items' | 'decisions' | 'risks', tempId: string) => {
      if (!confirm('Are you sure you want to reject this item? It will not be included when publishing.'))
        return;

      setProposedItems((prev) => ({
        ...prev,
        [type]: prev[type].map((item) =>
          item.temp_id === tempId ? { ...item, accepted: false } : item
        ),
      }));
    },
    []
  );

  // Save changes
  const saveChanges = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('proposed_change_sets')
        .update({ proposed_items: proposedItems })
        .eq('id', proposedChangeSet.id);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save changes:', error);
      showToast('Failed to save changes', 'error');
    }
  }, [supabase, proposedItems, proposedChangeSet.id, showToast]);

  // Check if can publish (only truly blocking issues)
  const canPublish = useMemo(() => {
    const blockingActionItems = proposedItems.action_items.filter(
      (ai) =>
        ai.accepted && ['ambiguous', 'conference_room'].includes(ai.owner_resolution_status)
    );
    const blockingRisks = proposedItems.risks.filter(
      (r) => r.accepted && ['ambiguous', 'conference_room'].includes(r.owner_resolution_status)
    );
    return blockingActionItems.length === 0 && blockingRisks.length === 0;
  }, [proposedItems]);

  // Publish changes
  const handlePublish = useCallback(async () => {
    if (!canPublish) {
      showToast('Please resolve all owners before publishing', 'warning');
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
      showToast('Failed to publish: ' + (error as Error).message, 'error');
    } finally {
      setIsPublishing(false);
    }
  }, [canPublish, saveChanges, meetingId, router, showToast]);

  // Section toggle handlers
  const toggleActionItems = useCallback(() => {
    setExpandedSections((s) => ({ ...s, action_items: !s.action_items }));
  }, []);

  const toggleDecisions = useCallback(() => {
    setExpandedSections((s) => ({ ...s, decisions: !s.decisions }));
  }, []);

  const toggleRisks = useCallback(() => {
    setExpandedSections((s) => ({ ...s, risks: !s.risks }));
  }, []);

  // Callback wrappers for card components
  const handleActionItemToggleAccept = useCallback(
    (tempId: string) => toggleAccept('action_items', tempId),
    [toggleAccept]
  );

  const handleActionItemEdit = useCallback(
    (tempId: string) => startEditing('action_items', tempId),
    [startEditing]
  );

  const handleActionItemReject = useCallback(
    (tempId: string) => rejectItem('action_items', tempId),
    [rejectItem]
  );

  const handleActionItemUpdateOwner = useCallback(
    (tempId: string, value: string) => updateOwner('action_items', tempId, value),
    [updateOwner]
  );

  const handleActionItemPlaceholder = useCallback(
    (tempId: string) => acceptAsPlaceholder('action_items', tempId),
    [acceptAsPlaceholder]
  );

  const handleActionItemAddContact = useCallback(
    (tempId: string, ownerName: string) => openAddContactModal('action_items', tempId, ownerName),
    [openAddContactModal]
  );

  const handleDecisionToggleAccept = useCallback(
    (tempId: string) => toggleAccept('decisions', tempId),
    [toggleAccept]
  );

  const handleDecisionEdit = useCallback(
    (tempId: string) => startEditing('decisions', tempId),
    [startEditing]
  );

  const handleDecisionReject = useCallback(
    (tempId: string) => rejectItem('decisions', tempId),
    [rejectItem]
  );

  const handleRiskToggleAccept = useCallback(
    (tempId: string) => toggleAccept('risks', tempId),
    [toggleAccept]
  );

  const handleRiskEdit = useCallback(
    (tempId: string) => startEditing('risks', tempId),
    [startEditing]
  );

  const handleRiskReject = useCallback(
    (tempId: string) => rejectItem('risks', tempId),
    [rejectItem]
  );

  const handleRiskUpdateOwner = useCallback(
    (tempId: string, value: string) => updateOwner('risks', tempId, value),
    [updateOwner]
  );

  const handleRiskPlaceholder = useCallback(
    (tempId: string) => acceptAsPlaceholder('risks', tempId),
    [acceptAsPlaceholder]
  );

  const handleRiskAddContact = useCallback(
    (tempId: string, ownerName: string) => openAddContactModal('risks', tempId, ownerName),
    [openAddContactModal]
  );

  // Lock banner
  if (isLocked && lockHolder) {
    return (
      <LockBanner lockHolder={lockHolder} isAdmin={isAdmin} onForceUnlock={forceUnlock} />
    );
  }

  return (
    <div className="space-y-6">
      {/* Lock controls */}
      <LockControls
        hasLock={hasLock}
        isPublishing={isPublishing}
        canPublish={canPublish}
        onAcquireLock={acquireLock}
        onReleaseLock={releaseLock}
        onPublish={handlePublish}
      />

      {/* Warning if blocking owner issues */}
      {!canPublish && hasLock && (
        <div className="card border-warning-200 bg-warning-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-600" />
            <p className="text-warning-700">
              Some owners have ambiguous or invalid assignments that must be resolved before
              publishing
            </p>
          </div>
        </div>
      )}

      {/* Add All New Names button when there are unresolved owners */}
      {hasLock && unresolvedOwnerNames.size > 0 && (
        <div className="card border-primary-200 bg-primary-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-primary-700">
                  {unresolvedOwnerNames.size} unresolved name
                  {unresolvedOwnerNames.size !== 1 ? 's' : ''} found
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
        <button onClick={toggleActionItems} className="flex w-full items-center justify-between">
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
                <ActionItemCard
                  key={item.temp_id}
                  item={item}
                  hasLock={hasLock}
                  ownerOptions={ownerOptions}
                  onToggleAccept={handleActionItemToggleAccept}
                  onEdit={handleActionItemEdit}
                  onReject={handleActionItemReject}
                  onUpdateOwner={handleActionItemUpdateOwner}
                  onAcceptAsPlaceholder={handleActionItemPlaceholder}
                  onOpenAddContactModal={handleActionItemAddContact}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Decisions Section */}
      <div className="card">
        <button onClick={toggleDecisions} className="flex w-full items-center justify-between">
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
                <DecisionCard
                  key={item.temp_id}
                  item={item}
                  hasLock={hasLock}
                  onToggleAccept={handleDecisionToggleAccept}
                  onEdit={handleDecisionEdit}
                  onReject={handleDecisionReject}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Risks Section */}
      <div className="card">
        <button onClick={toggleRisks} className="flex w-full items-center justify-between">
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
                <RiskCard
                  key={item.temp_id}
                  item={item}
                  hasLock={hasLock}
                  ownerOptions={ownerOptions}
                  onToggleAccept={handleRiskToggleAccept}
                  onEdit={handleRiskEdit}
                  onReject={handleRiskReject}
                  onUpdateOwner={handleRiskUpdateOwner}
                  onAcceptAsPlaceholder={handleRiskPlaceholder}
                  onOpenAddContactModal={handleRiskAddContact}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditItemModal
        isOpen={editModalOpen}
        editingItem={editingItem}
        editFormData={editFormData}
        onClose={closeEditModal}
        onFormDataChange={setEditFormData}
        onSave={saveEditedItem}
      />

      {/* New Contact Modal */}
      <NewContactModal
        isOpen={newContactModalOpen}
        contactName={newContactName}
        contactEmail={newContactEmail}
        similarNameMatches={similarNameMatches}
        showSimilarNameWarning={showSimilarNameWarning}
        forceAddContact={forceAddContact}
        isAddingContact={isAddingContact}
        onClose={closeNewContactModal}
        onNameChange={setNewContactName}
        onEmailChange={setNewContactEmail}
        onSelectExistingMatch={selectExistingMatch}
        onConfirmAddAsNew={confirmAddAsNew}
        onAddContact={addNewContact}
      />
    </div>
  );
}
