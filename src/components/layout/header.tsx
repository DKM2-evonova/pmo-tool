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
    <header className="flex h-16 items-center justify-between border-b border-surface-200 bg-white px-6">
      {/* Search */}
      <div className="flex flex-1 items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search projects, meetings, action items..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications (placeholder) */}
        <button className="relative rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700">
          <Bell className="h-5 w-5" />
        </button>

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-surface-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name || 'User'}
                  className="h-8 w-8 rounded-full"
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
            <ChevronDown className="hidden h-4 w-4 text-surface-400 md:block" />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-fade-in rounded-lg border border-surface-200 bg-white py-1 shadow-medium">
              <div className="border-b border-surface-100 px-4 py-3 md:hidden">
                <p className="text-sm font-medium text-surface-900">
                  {user?.full_name || user?.email}
                </p>
                <p className="text-xs text-surface-500">
                  {roleLabels[user?.global_role || 'consultant']}
                </p>
              </div>
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  router.push('/profile');
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50"
              >
                <User className="h-4 w-4" />
                Profile
              </button>
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  router.push('/settings');
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <hr className="my-1 border-surface-100" />
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

