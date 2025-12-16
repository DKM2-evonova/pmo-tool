'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDateReadable, isOverdue, getInitials, cn } from '@/lib/utils';
import { AlertCircle, GripVertical, Calendar, User, ArrowRight } from 'lucide-react';
import type { ActionItemWithOwner } from '@/types/database';
import type { EntityStatus } from '@/types/enums';

interface KanbanBoardProps {
  actionItems: ActionItemWithOwner[];
}

const columns: { id: EntityStatus; title: string; colorClass: string; dotClass: string; icon: string }[] = [
  { id: 'Open', title: 'Open', colorClass: 'glass-column-open', dotClass: 'status-dot-open', icon: '○' },
  { id: 'In Progress', title: 'In Progress', colorClass: 'glass-column-progress', dotClass: 'status-dot-progress', icon: '◐' },
  { id: 'Closed', title: 'Closed', colorClass: 'glass-column-closed', dotClass: 'status-dot-closed', icon: '●' },
];

export function KanbanBoard({ actionItems }: KanbanBoardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<ActionItemWithOwner[]>(actionItems);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<EntityStatus | null>(null);

  useEffect(() => {
    setItems(actionItems);
  }, [actionItems]);

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggingId(itemId);
    e.dataTransfer.setData('text/plain', itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, status: EntityStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDropTarget(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, newStatus: EntityStatus) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    setDropTarget(null);

    if (!itemId) return;

    const item = items.find((ai) => ai.id === itemId);
    if (!item || item.status === newStatus) return;

    const previousStatus = item.status;

    setItems((prev) =>
      prev.map((ai) =>
        ai.id === itemId ? { ...ai, status: newStatus } : ai
      )
    );

    try {
      const { error } = await supabase
        .from('action_items')
        .update({ status: newStatus })
        .eq('id', itemId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update status:', error);
      setItems((prev) =>
        prev.map((ai) =>
          ai.id === itemId ? { ...ai, status: previousStatus } : ai
        )
      );
      alert('Failed to update status');
    }
  };

  const getColumnItems = (status: EntityStatus) =>
    items.filter((item) => item.status === status);

  return (
    <div className="relative">
      {/* Subtle background gradient for depth */}
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary-100/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-success-50/40 blur-3xl" />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {columns.map((column, columnIndex) => {
          const columnItems = getColumnItems(column.id);
          const isDropping = dropTarget === column.id;

          return (
            <div
              key={column.id}
              className={cn(
                'glass-column min-h-[500px] transition-all duration-300',
                column.colorClass,
                isDropping && 'drop-active scale-[1.01]'
              )}
              style={{
                animationDelay: `${columnIndex * 100}ms`,
              }}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('status-dot', column.dotClass)} />
                  <h3 className="text-base font-semibold text-surface-800">
                    {column.title}
                  </h3>
                </div>
                <div className="glass-badge">
                  <span className="text-surface-600">{columnItems.length}</span>
                </div>
              </div>

              {/* Cards Container */}
              <div className="space-y-3">
                {columnItems.map((item, index) => {
                  const isDragging = draggingId === item.id;
                  const itemOverdue = item.due_date && isOverdue(item.due_date) && item.status !== 'Closed';

                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        if (!draggingId) {
                          router.push(`/action-items/${item.id}`);
                        }
                      }}
                      className={cn(
                        'glass-card cursor-grab p-4 active:cursor-grabbing',
                        isDragging && 'dragging opacity-60',
                        'animate-fade-in'
                      )}
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      {/* Card Header with Drag Handle */}
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-surface-100/80 text-surface-400 transition-colors hover:bg-surface-200/80 hover:text-surface-600">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-surface-900 leading-snug line-clamp-2">
                            {item.title}
                          </h4>
                          {item.description && (
                            <p className="mt-2 text-sm text-surface-500 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="mt-4 flex items-center justify-between">
                        {/* Owner */}
                        <div className="flex items-center gap-2">
                          <div className="glass-avatar h-7 w-7 text-xs text-white">
                            {getInitials(
                              item.owner?.full_name ||
                                item.owner_name ||
                                'U'
                            )}
                          </div>
                          <span className="text-sm text-surface-600 font-medium truncate max-w-[100px]">
                            {item.owner?.full_name?.split(' ')[0] ||
                              item.owner_name?.split(' ')[0] ||
                              'Unassigned'}
                          </span>
                        </div>

                        {/* Due Date */}
                        {item.due_date && (
                          <div
                            className={cn(
                              'due-chip',
                              itemOverdue && 'due-chip-overdue'
                            )}
                          >
                            {itemOverdue && (
                              <AlertCircle className="h-3.5 w-3.5" />
                            )}
                            <Calendar className="h-3 w-3 opacity-60" />
                            <span>{formatDateReadable(item.due_date)}</span>
                          </div>
                        )}
                      </div>

                      {/* Hover Arrow Indicator */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                        <ArrowRight className="h-4 w-4 text-surface-300" />
                      </div>
                    </div>
                  );
                })}

                {/* Empty State */}
                {columnItems.length === 0 && (
                  <div className={cn(
                    'empty-drop-zone',
                    isDropping && 'drop-active'
                  )}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-100/50">
                        <span className="text-lg text-surface-400">{column.icon}</span>
                      </div>
                      <p className="text-sm text-surface-400">
                        {isDropping ? 'Drop here' : 'No items yet'}
                      </p>
                      <p className="text-xs text-surface-300">
                        Drag tasks here
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
