import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'primary' | 'glass';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
}: BadgeProps) {
  const variants = {
    default: cn(
      'bg-surface-100/80 text-surface-600',
      'border border-surface-200/50'
    ),
    success: cn(
      'bg-success-50/80 text-success-600',
      'border border-success-200/50',
      'shadow-sm shadow-success-500/10'
    ),
    warning: cn(
      'bg-warning-50/80 text-warning-600',
      'border border-warning-200/50',
      'shadow-sm shadow-warning-500/10'
    ),
    danger: cn(
      'bg-danger-50/80 text-danger-600',
      'border border-danger-200/50',
      'shadow-sm shadow-danger-500/10'
    ),
    primary: cn(
      'bg-primary-50/80 text-primary-600',
      'border border-primary-200/50',
      'shadow-sm shadow-primary-500/10'
    ),
    glass: cn(
      'bg-white/60 text-surface-700 backdrop-blur-sm',
      'border border-white/40',
      'shadow-glass'
    ),
  };

  const dotColors = {
    default: 'bg-surface-400',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
    primary: 'bg-primary-500',
    glass: 'bg-surface-400',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        'transition-all duration-200',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            dotColors[variant],
            variant === 'warning' && 'animate-pulse-soft'
          )}
        />
      )}
      {children}
    </span>
  );
}
