'use client';
import Link from 'next/link';

import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Clock,
  CalendarDays, BarChart3, Users, Plug, CreditCard,
  Settings, ChevronLeft, ChevronRight, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/projects',  label: 'Projects',      icon: FolderKanban },
      { href: '/tasks',     label: 'Tasks',          icon: CheckSquare },
      { href: '/time',      label: 'Time Tracking',  icon: Clock },
      { href: '/calendar',  label: 'Calendar',       icon: CalendarDays },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/clients', label: 'Clients', icon: Users },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/integrations',     label: 'Integrations', icon: Plug },
      { href: '/settings/billing', label: 'Billing',      icon: CreditCard },
      { href: '/settings',         label: 'Settings',     icon: Settings },
    ],
  },
];

const PLAN_COLORS: Record<string, string> = {
  free:  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  solo:  'bg-primary/10 text-primary',
  team:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};

interface SidebarProps {
  user?: { full_name?: string | null; email?: string; avatar_url?: string | null; plan?: string };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  const plan = user?.plan ?? 'free';

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/settings') return pathname === '/settings';
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-card transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo row */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-border px-3',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center min-w-0">
            <img src="/logo.png" alt="TaskCraft AI" className="h-7 w-auto" />
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" title="TaskCraft AI">
            <img src="/app_icon.png" alt="TaskCraft AI" className="h-8 w-8 rounded-lg object-cover" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0',
            collapsed && 'mt-0',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && !collapsed && (
              <p className="sidebar-group-label">{group.label}</p>
            )}
            {group.label && collapsed && gi > 0 && (
              <div className="my-2 h-px bg-border/60" />
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, badge }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={cn(
                      active ? 'sidebar-item-active' : 'sidebar-item',
                      collapsed && 'justify-center px-2',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{label}</span>}
                    {!collapsed && badge && (
                      <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div className="border-t border-border px-2 py-3">
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-xl bg-muted/50 p-2',
            collapsed && 'justify-center',
          )}
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={user?.avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px] font-semibold">{initials}</AvatarFallback>
          </Avatar>

          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold leading-tight">
                  {user?.full_name ?? 'User'}
                </p>
                <span
                  className={cn(
                    'mt-0.5 inline-block rounded-full px-1.5 py-px text-[9px] font-bold uppercase leading-none tracking-wide capitalize',
                    PLAN_COLORS[plan] ?? PLAN_COLORS.free,
                  )}
                >
                  {plan}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
