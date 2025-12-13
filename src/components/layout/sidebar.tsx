'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Briefcase,
  LayoutDashboard,
  FolderOpen,
  CheckSquare,
  AlertTriangle,
  FileText,
  Settings,
  Users,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GlobalRole } from '@/types/enums';

interface SidebarProps {
  projects: Array<{ id: string; name: string; role: string }>;
  userRole: GlobalRole;
}

export function Sidebar({ projects, userRole }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = userRole === 'admin';

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Meetings',
      href: '/meetings',
      icon: Calendar,
    },
    {
      name: 'Action Items',
      href: '/action-items',
      icon: CheckSquare,
    },
    {
      name: 'Decisions',
      href: '/decisions',
      icon: FileText,
    },
    {
      name: 'Risks & Issues',
      href: '/risks',
      icon: AlertTriangle,
    },
  ];

  const adminNavigation = [
    {
      name: 'Users',
      href: '/admin/users',
      icon: Users,
    },
    {
      name: 'Analytics',
      href: '/admin/analytics',
      icon: BarChart3,
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: Settings,
    },
  ];

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-surface-200 px-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-semibold text-surface-900">
              PMO Tool
            </span>
          )}
        </Link>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 lg:block"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}

        {/* Projects Section */}
        <div className="pt-4">
          <button
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-surface-400"
          >
            {!isCollapsed && (
              <>
                <span>Projects</span>
                {projectsExpanded ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </>
            )}
            {isCollapsed && <FolderOpen className="h-5 w-5" />}
          </button>
          {projectsExpanded && !isCollapsed && (
            <div className="mt-1 space-y-1">
              {projects.length === 0 ? (
                <p className="px-3 py-2 text-sm text-surface-400">
                  No projects assigned
                </p>
              ) : (
                projects.map((project) => {
                  const isActive = pathname.includes(
                    `/projects/${project.id}`
                  );
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                      )}
                    >
                      <FolderOpen className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <div className="pt-4">
            {!isCollapsed && (
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
                Administration
              </p>
            )}
            <div className="mt-1 space-y-1">
              {adminNavigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-white p-2 shadow-md lg:hidden"
      >
        <Menu className="h-5 w-5 text-surface-600" />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-white transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-surface-500 hover:bg-surface-100"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden border-r border-surface-200 bg-white transition-all lg:flex lg:flex-col',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}

