'use client';

import { useCallback } from 'react';
import { Button, Modal, ModalFooter, Input, Textarea } from '@/components/ui';
import type { EditFormData, EditingItem } from './types';

interface EditItemModalProps {
  isOpen: boolean;
  editingItem: EditingItem | null;
  editFormData: EditFormData;
  onClose: () => void;
  onFormDataChange: (data: EditFormData) => void;
  onSave: () => void;
}

export function EditItemModal({
  isOpen,
  editingItem,
  editFormData,
  onClose,
  onFormDataChange,
  onSave,
}: EditItemModalProps) {
  const handleFieldChange = useCallback(
    (field: keyof EditFormData, value: string) => {
      onFormDataChange({ ...editFormData, [field]: value });
    },
    [editFormData, onFormDataChange]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="Action item title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Description
              </label>
              <Textarea
                value={editFormData.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
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
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="Decision title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Rationale
              </label>
              <Textarea
                value={editFormData.rationale || ''}
                onChange={(e) => handleFieldChange('rationale', e.target.value)}
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
                onChange={(e) => handleFieldChange('outcome', e.target.value)}
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
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="Risk title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Description
              </label>
              <Textarea
                value={editFormData.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
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
                onChange={(e) => handleFieldChange('mitigation', e.target.value)}
                placeholder="Risk mitigation"
                rows={3}
              />
            </div>
          </>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSave}>Save Changes</Button>
      </ModalFooter>
    </Modal>
  );
}
