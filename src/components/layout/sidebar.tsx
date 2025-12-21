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
  Users2,
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
      name: 'Team',
      href: '/admin/team',
      icon: Users2,
    },
    {
      name: 'Meetings',
      href: '/admin/meetings',
      icon: Calendar,
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

  const NavLink = ({
    item,
    isActive,
    collapsed,
  }: {
    item: { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
    isActive: boolean;
    collapsed: boolean;
  }) => (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
        'transition-all duration-200',
        isActive
          ? cn(
              'bg-primary-50/80 text-primary-700',
              'shadow-sm shadow-primary-500/10',
              'border border-primary-100/50'
            )
          : cn(
              'text-surface-600',
              'hover:bg-surface-100/80 hover:text-surface-900',
              'border border-transparent'
            )
      )}
    >
      <item.icon
        className={cn(
          'h-5 w-5 flex-shrink-0 transition-colors',
          isActive ? 'text-primary-600' : 'text-surface-400 group-hover:text-surface-600'
        )}
      />
      {!collapsed && <span>{item.name}</span>}
    </Link>
  );

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div
        className={cn(
          'flex h-16 items-center justify-between px-4',
          'border-b border-surface-200/60'
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl',
              'bg-gradient-to-br from-primary-500 to-primary-600',
              'shadow-lg shadow-primary-500/25'
            )}
          >
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold bg-gradient-to-r from-surface-900 to-surface-700 bg-clip-text text-transparent">
              PMO Tool
            </span>
          )}
        </Link>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label="Toggle sidebar"
          className={cn(
            'hidden rounded-lg p-1.5 lg:block',
            'text-surface-400 hover:text-surface-600',
            'hover:bg-surface-100/80',
            'transition-all duration-200'
          )}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <NavLink
              key={item.name}
              item={item}
              isActive={isActive}
              collapsed={isCollapsed}
            />
          );
        })}

        {/* Projects Section */}
        <div className="pt-4">
          <button
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 rounded-lg',
              'text-xs font-semibold uppercase tracking-wider text-surface-400',
              'hover:text-surface-600 hover:bg-surface-100/50',
              'transition-all duration-200'
            )}
          >
            {!isCollapsed && (
              <>
                <span>Projects</span>
                <span
                  className={cn(
                    'ml-auto transition-transform duration-200',
                    projectsExpanded && 'rotate-180'
                  )}
                >
                  <ChevronDown className="h-4 w-4" />
                </span>
              </>
            )}
            {isCollapsed && <FolderOpen className="h-5 w-5" />}
          </button>
          {projectsExpanded && !isCollapsed && (
            <div className="mt-2 space-y-1 pl-2">
              {projects.length === 0 ? (
                <p className="px-3 py-2 text-sm text-surface-400 italic">
                  No projects assigned
                </p>
              ) : (
                projects.map((project) => {
                  const isActive = pathname.includes(`/projects/${project.id}`);
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                        'transition-all duration-200',
                        isActive
                          ? 'bg-primary-50/60 text-primary-700 font-medium'
                          : 'text-surface-600 hover:bg-surface-100/80 hover:text-surface-900'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-md',
                          isActive
                            ? 'bg-primary-100 text-primary-600'
                            : 'bg-surface-100 text-surface-400'
                        )}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </div>
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
                  pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <NavLink
                    key={item.name}
                    item={item}
                    isActive={isActive}
                    collapsed={isCollapsed}
                  />
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
        aria-label="Open mobile menu"
        className={cn(
          'fixed left-4 top-4 z-50 lg:hidden',
          'rounded-xl p-2.5',
          'bg-white/90 backdrop-blur-md',
          'shadow-lg shadow-surface-900/10',
          'border border-surface-200/60'
        )}
      >
        <Menu className="h-5 w-5 text-surface-600" />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-surface-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 lg:hidden',
          'transform transition-transform duration-300 ease-out',
          'bg-white/95 backdrop-blur-md',
          'shadow-card-elevated',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close mobile menu"
          className={cn(
            'absolute right-4 top-4 rounded-xl p-2',
            'text-surface-400 hover:text-surface-600',
            'hover:bg-surface-100/80',
            'transition-all duration-200'
          )}
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col',
          'bg-white/80 backdrop-blur-md',
          'border-r border-surface-200/60',
          'transition-all duration-300',
          isCollapsed ? 'w-20' : 'w-72'
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
