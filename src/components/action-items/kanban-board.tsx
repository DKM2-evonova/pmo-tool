'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDateReadable, isOverdue, getInitials, cn } from '@/lib/utils';
import { AlertCircle, GripVertical } from 'lucide-react';
import type { ActionItemWithOwner } from '@/types/database';
import type { EntityStatus } from '@/types/enums';

interface KanbanBoardProps {
  actionItems: ActionItemWithOwner[];
}

const columns: { id: EntityStatus; title: string; color: string }[] = [
  { id: 'Open', title: 'Open', color: 'bg-surface-100' },
  { id: 'In Progress', title: 'In Progress', color: 'bg-warning-50' },
  { id: 'Closed', title: 'Closed', color: 'bg-success-50' },
];

export function KanbanBoard({ actionItems }: KanbanBoardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<EntityStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggingId(itemId);
    e.dataTransfer.setData('text/plain', itemId);
  };

  const handleDragOver = (e: React.DragEvent, status: EntityStatus) => {
    e.preventDefault();
    setDropTarget(status);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: EntityStatus) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    setDropTarget(null);

    if (!itemId) return;

    const item = actionItems.find((ai) => ai.id === itemId);
    if (!item || item.status === newStatus) return;

    try {
      const { error } = await supabase
        .from('action_items')
        .update({ status: newStatus })
        .eq('id', itemId);

      if (error) throw error;
      router.refresh();
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status');
    }
  };

  const getColumnItems = (status: EntityStatus) =>
    actionItems.filter((item) => item.status === status);

  return (
    <div className="grid grid-cols-3 gap-4">
      {columns.map((column) => (
        <div
          key={column.id}
          className={cn(
            'rounded-lg p-4 transition-colors',
            column.color,
            dropTarget === column.id && 'ring-2 ring-primary-400'
          )}
          onDragOver={(e) => handleDragOver(e, column.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-surface-900">{column.title}</h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-surface-600">
              {getColumnItems(column.id).length}
            </span>
          </div>

          <div className="space-y-3">
            {getColumnItems(column.id).map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onClick={(e) => {
                  // Only navigate if not dragging
                  if (!draggingId) {
                    router.push(`/action-items/${item.id}`);
                  }
                }}
                className={cn(
                  'cursor-grab rounded-lg border border-surface-200 bg-white p-3 shadow-sm transition-all hover:shadow-md',
                  draggingId === item.id && 'opacity-50'
                )}
              >
                <div className="mb-2 flex items-start gap-2">
                  <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-surface-300" />
                  <div className="flex-1">
                    <p className="font-medium text-surface-900">{item.title}</p>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-surface-500">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                      {getInitials(
                        item.owner?.full_name ||
                          item.owner_name ||
                          'U'
                      )}
                    </div>
                    <span className="text-surface-500">
                      {item.owner?.full_name?.split(' ')[0] ||
                        item.owner_name?.split(' ')[0] ||
                        'Unassigned'}
                    </span>
                  </div>

                  {item.due_date && (
                    <span
                      className={cn(
                        'flex items-center gap-1',
                        isOverdue(item.due_date) && item.status !== 'Closed'
                          ? 'text-danger-600'
                          : 'text-surface-400'
                      )}
                    >
                      {isOverdue(item.due_date) && item.status !== 'Closed' && (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      {formatDateReadable(item.due_date)}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {getColumnItems(column.id).length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-surface-200 p-4 text-center text-sm text-surface-400">
                Drop items here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

