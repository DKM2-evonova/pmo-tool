import type {
  ProposedActionItem,
  ProposedDecision,
  ProposedRisk,
  Profile,
  ProjectContact,
} from '@/types/database';

export type ItemType = 'action_items' | 'decisions' | 'risks';
export type EditingItemType = 'action_item' | 'decision' | 'risk';

export interface ProposedItems {
  action_items: ProposedActionItem[];
  decisions: ProposedDecision[];
  risks: ProposedRisk[];
}

export interface EditFormData {
  title?: string;
  description?: string;
  rationale?: string;
  outcome?: string;
  mitigation?: string;
}

export interface EditingItem {
  type: EditingItemType;
  id: string;
}

export interface NewContactTarget {
  type: 'action_items' | 'risks';
  tempId: string;
}

export interface OwnerSelectOption {
  value: string;
  label: string;
}

export function buildOwnerOptions(
  projectMembers: Profile[],
  projectContacts: ProjectContact[]
): OwnerSelectOption[] {
  return [
    ...projectMembers.map((m) => ({
      value: `user:${m.id}`,
      label: m.full_name || m.email,
    })),
    ...projectContacts.map((c) => ({
      value: `contact:${c.id}`,
      label: `${c.name}${c.email ? ` (${c.email})` : ''} [Contact]`,
    })),
  ];
}
