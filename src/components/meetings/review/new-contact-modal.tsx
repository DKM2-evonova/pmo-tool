'use client';

import { Button, Modal, ModalFooter, Input, Badge } from '@/components/ui';
import { AlertTriangle, User, UserPlus } from 'lucide-react';
import type { PersonMatch } from '@/lib/utils/name-matching';

interface NewContactModalProps {
  isOpen: boolean;
  contactName: string;
  contactEmail: string;
  similarNameMatches: PersonMatch[];
  showSimilarNameWarning: boolean;
  forceAddContact: boolean;
  isAddingContact: boolean;
  onClose: () => void;
  onNameChange: (name: string) => void;
  onEmailChange: (email: string) => void;
  onSelectExistingMatch: (match: PersonMatch) => void;
  onConfirmAddAsNew: () => void;
  onAddContact: () => void;
}

export function NewContactModal({
  isOpen,
  contactName,
  contactEmail,
  similarNameMatches,
  showSimilarNameWarning,
  forceAddContact,
  isAddingContact,
  onClose,
  onNameChange,
  onEmailChange,
  onSelectExistingMatch,
  onConfirmAddAsNew,
  onAddContact,
}: NewContactModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={showSimilarNameWarning ? 'Similar Name Found' : 'Add New Contact'}
    >
      <div className="space-y-4">
        {showSimilarNameWarning && similarNameMatches.length > 0 && (
          <div className="rounded-lg border border-warning-200 bg-warning-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-warning-700">
                  Similar name{similarNameMatches.length > 1 ? 's' : ''} already
                  exist{similarNameMatches.length === 1 ? 's' : ''} in this
                  project
                </p>
                <p className="text-sm text-warning-600 mt-1">
                  Did you mean one of these people?
                </p>
                <div className="mt-3 space-y-2">
                  {similarNameMatches.map((match) => (
                    <button
                      key={match.id}
                      onClick={() => onSelectExistingMatch(match)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-warning-200 bg-white hover:bg-warning-100 transition-colors text-left"
                    >
                      <User className="h-5 w-5 text-surface-500" />
                      <div className="flex-1">
                        <p className="font-medium text-surface-900">
                          {match.name}
                        </p>
                        <p className="text-sm text-surface-500">
                          {match.email || 'No email'} •{' '}
                          {match.type === 'user' ? 'Team Member' : 'Contact'}
                        </p>
                      </div>
                      <Badge variant="default">
                        {Math.round(match.score * 100)}% match
                      </Badge>
                    </button>
                  ))}
                </div>
                <button
                  onClick={onConfirmAddAsNew}
                  className="mt-3 text-sm text-warning-700 hover:text-warning-800 underline"
                >
                  No, add &quot;{contactName}&quot; as a new person
                </button>
              </div>
            </div>
          </div>
        )}

        {(!showSimilarNameWarning || forceAddContact) && (
          <>
            <p className="text-sm text-surface-600">
              Add this person as a project contact. They will be available for
              assignment on all items in this project.
            </p>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Name <span className="text-danger-500">*</span>
              </label>
              <Input
                value={contactName}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Contact name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Email <span className="text-surface-400">(optional)</span>
              </label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="contact@example.com"
              />
            </div>
          </>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {(!showSimilarNameWarning || forceAddContact) && (
          <Button
            onClick={onAddContact}
            isLoading={isAddingContact}
            disabled={!contactName.trim()}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Add Contact
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
