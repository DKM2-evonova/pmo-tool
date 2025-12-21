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
      {/* Backdrop with blur */}
      <div className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm animate-fade-in" />

      {/* Modal with glass effect */}
      <div
        className={cn(
          'relative z-10 w-full animate-scale-in',
          'rounded-2xl overflow-hidden',
          'bg-white/95 backdrop-blur-md',
          'border border-white/60',
          'shadow-card-elevated',
          sizes[size]
        )}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent pointer-events-none" />

        {/* Header */}
        {(title || description) && (
          <div className="relative border-b border-surface-100 px-6 py-5">
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
                aria-label="Close dialog"
                className={cn(
                  'rounded-xl p-2 -mr-1 -mt-1',
                  'text-surface-400 hover:text-surface-600',
                  'hover:bg-surface-100/80',
                  'transition-all duration-200'
                )}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="relative px-6 py-5">{children}</div>
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
        'flex justify-end gap-3',
        'border-t border-surface-100',
        'bg-surface-50/50 backdrop-blur-sm',
        'px-6 py-4 -mx-6 -mb-5 mt-5',
        'rounded-b-2xl',
        className
      )}
    >
      {children}
    </div>
  );
}
