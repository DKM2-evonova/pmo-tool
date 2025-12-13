'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 animate-fade-in" />

      {/* Modal */}
      <div
        className={cn(
          'relative z-10 w-full rounded-xl bg-white shadow-xl animate-slide-up',
          sizes[size]
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="border-b border-surface-200 px-6 py-4">
            <div className="flex items-start justify-between">
              <div>
                {title && (
                  <h2 className="text-lg font-semibold text-surface-900">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="mt-1 text-sm text-surface-500">{description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'flex justify-end gap-3 border-t border-surface-200 bg-surface-50 px-6 py-4 -mx-6 -mb-4 mt-4 rounded-b-xl',
        className
      )}
    >
      {children}
    </div>
  );
}

