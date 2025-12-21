'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Search,
  Bell,
  ChevronDown,
  User,
  LogOut,
  Settings,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import type { Profile } from '@/types/database';

interface HeaderProps {
  user: Profile | null;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    consultant: 'Project Consultant',
    program_manager: 'Program Manager',
  };

  return (
    <header
      className={cn(
        'flex h-16 items-center justify-between px-6',
        'bg-white/80 backdrop-blur-md',
        'border-b border-surface-200/60',
        'sticky top-0 z-30'
      )}
    >
      {/* Search */}
      <div className="flex flex-1 items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search projects, meetings, action items..."
            className={cn(
              'w-full rounded-xl py-2.5 pl-11 pr-4 text-sm',
              'bg-surface-100/60 backdrop-blur-sm',
              'border border-surface-200/60',
              'placeholder:text-surface-400',
              'transition-all duration-200',
              'focus:bg-white focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              'hover:bg-surface-100/80'
            )}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button
          aria-label="View notifications"
          className={cn(
            'relative rounded-xl p-2.5',
            'text-surface-500 hover:text-surface-700',
            'hover:bg-surface-100/80',
            'transition-all duration-200'
          )}
        >
          <Bell className="h-5 w-5" />
          {/* Notification dot */}
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary-500 ring-2 ring-white" />
        </button>

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              'flex items-center gap-3 rounded-xl p-2',
              'hover:bg-surface-100/80',
              'transition-all duration-200'
            )}
          >
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl',
                'bg-gradient-to-br from-primary-500 to-primary-600',
                'text-sm font-semibold text-white',
                'shadow-md shadow-primary-500/20',
                'ring-2 ring-white/80'
              )}
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name || 'User'}
                  className="h-9 w-9 rounded-xl object-cover"
                />
              ) : (
                getInitials(user?.full_name || user?.email || 'U')
              )}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-surface-900">
                {user?.full_name || user?.email}
              </p>
              <p className="text-xs text-surface-500">
                {roleLabels[user?.global_role || 'consultant']}
              </p>
            </div>
            <ChevronDown
              className={cn(
                'hidden h-4 w-4 text-surface-400 transition-transform duration-200 md:block',
                dropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div
              className={cn(
                'absolute right-0 top-full z-50 mt-2 w-56',
                'animate-scale-in origin-top-right',
                'rounded-xl overflow-hidden',
                'bg-white/95 backdrop-blur-md',
                'border border-surface-200/60',
                'shadow-card-elevated'
              )}
            >
              {/* Mobile user info */}
              <div className="border-b border-surface-100 px-4 py-3 md:hidden">
                <p className="text-sm font-medium text-surface-900">
                  {user?.full_name || user?.email}
                </p>
                <p className="text-xs text-surface-500">
                  {roleLabels[user?.global_role || 'consultant']}
                </p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    router.push('/profile');
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-sm',
                    'text-surface-700 hover:bg-surface-50/80',
                    'transition-colors duration-150'
                  )}
                >
                  <User className="h-4 w-4 text-surface-400" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    router.push('/settings');
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-sm',
                    'text-surface-700 hover:bg-surface-50/80',
                    'transition-colors duration-150'
                  )}
                >
                  <Settings className="h-4 w-4 text-surface-400" />
                  Settings
                </button>
              </div>

              <div className="border-t border-surface-100 py-1">
                <button
                  onClick={handleSignOut}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-sm',
                    'text-danger-600 hover:bg-danger-50/80',
                    'transition-colors duration-150'
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
