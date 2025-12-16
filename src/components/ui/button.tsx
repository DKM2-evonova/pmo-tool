import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary: cn(
        'relative overflow-hidden',
        'bg-gradient-to-r from-primary-600 to-primary-500',
        'text-white font-semibold',
        'shadow-lg shadow-primary-500/20',
        'hover:shadow-xl hover:shadow-primary-500/25 hover:scale-[1.02]',
        'focus:ring-primary-500',
        'before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary-500 before:to-primary-400 before:opacity-0 before:transition-opacity hover:before:opacity-100',
        '[&>*]:relative'
      ),
      secondary: cn(
        'border border-surface-200/80 bg-white/80 backdrop-blur-sm',
        'text-surface-700',
        'shadow-soft',
        'hover:bg-white hover:border-surface-300 hover:shadow-md',
        'focus:ring-surface-400'
      ),
      ghost: cn(
        'text-surface-600',
        'hover:bg-surface-100/80 hover:text-surface-900',
        'focus:ring-surface-400'
      ),
      danger: cn(
        'relative overflow-hidden',
        'bg-gradient-to-r from-danger-600 to-danger-500',
        'text-white font-semibold',
        'shadow-lg shadow-danger-500/20',
        'hover:shadow-xl hover:shadow-danger-500/25 hover:scale-[1.02]',
        'focus:ring-danger-500'
      ),
      glass: cn(
        'bg-white/60 backdrop-blur-md',
        'border border-white/40',
        'text-surface-700',
        'shadow-glass',
        'hover:bg-white/80 hover:shadow-glass-hover hover:border-white/60',
        'focus:ring-primary-500/30'
      ),
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs rounded-lg',
      md: 'px-4 py-2 text-sm rounded-xl',
      lg: 'px-5 py-2.5 text-base rounded-xl',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
