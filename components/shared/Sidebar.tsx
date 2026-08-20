'use client';
import Link from 'next/link';

import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Clock,
  CalendarDays, BarChart3, Users, Plug, CreditCard,
  Settings, ChevronLeft, ChevronRight, LogOut, Sparkles, Lock, Receipt, UsersRound, HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Plan } from '@/lib/types';

// Minimum plan required to fully access a nav item ('free' = always unlocked)
type MinPlan = 'free' | 'solo' | 'team';

interface NavItem {
  href:    string;
  label:   string;
  icon:    React.ElementType;
  badge?:  string;
  minPlan: MinPlan;
}

interface NavGroup {
  label?: string;
  items:  NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard',     icon: LayoutDashboard, minPlan: 'free' },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/projects',  label: 'Projects',      icon: FolderKanban,    minPlan: 'free' },
      { href: '/tasks',     label: 'Tasks',          icon: CheckSquare,     minPlan: 'free' },
      { href: '/time',      label: 'Time Tracking',  icon: Clock,           minPlan: 'free' },
      { href: '/calendar',  label: 'Calendar',       icon: CalendarDays,    minPlan: 'free' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/ai',       label: 'AI Assistant', icon: Sparkles, minPlan: 'free' },
      { href: '/reports',  label: 'Reports',      icon: BarChart3, minPlan: 'solo' },
      { href: '/clients',  label: 'Clients',      icon: Users,     minPlan: 'solo' },
      { href: '/invoices', label: 'Invoices',     icon: Receipt,   minPlan: 'solo' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/team',             label: 'Team',         icon: UsersRound,  minPlan: 'team' },
      { href: '/integrations',     label: 'Integrations', icon: Plug,        minPlan: 'solo' },
      { href: '/settings/billing', label: 'Billing',      icon: CreditCard,  minPlan: 'free' },
      { href: '/settings',         label: 'Settings',     icon: Settings,    minPlan: 'free' },
      { href: '/help',             label: 'Help',         icon: HelpCircle,  minPlan: 'free' },
    ],
  },
];

const PLAN_RANK: Record<string, number> = { free: 0, solo: 1, team: 2 };

function isLocked(userPlan: string, minPlan: MinPlan): boolean {
  return (PLAN_RANK[userPlan] ?? 0) < (PLAN_RANK[minPlan] ?? 0);
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  solo: 'bg-primary/10 text-primary',
  team: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};

const PLAN_BADGE_LABEL: Record<MinPlan, string> = {
  free: '',
  solo: 'Solo',
  team: 'Team',
};

interface SidebarProps {
  user?:          { full_name?: string | null; email?: string; avatar_url?: string | null; plan?: string };
  onCloseMobile?: () => void;
}

export function Sidebar({ user, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleSignOut() {
    await signOut({ callbackUrl: '/login' });
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
              {group.items.map(({ href, label, icon: Icon, badge, minPlan }) => {
                const active  = isActive(href);
                const locked  = isLocked(plan, minPlan);

                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    onClick={onCloseMobile}
                    className={cn(
                      active ? 'sidebar-item-active' : 'sidebar-item',
                      collapsed && 'justify-center px-2',
                      locked && !active && 'opacity-60',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{label}</span>}

                    {/* Right-side indicators */}
                    {!collapsed && (
                      <>
                        {badge && (
                          <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {badge}
                          </span>
                        )}
                        {locked && (
                          <span className="ml-auto flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            <Lock className="h-2.5 w-2.5" />
                            {PLAN_BADGE_LABEL[minPlan]}
                          </span>
                        )}
                      </>
                    )}

                    {/* Collapsed lock dot */}
                    {collapsed && locked && (
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
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

        {/* Upgrade nudge for free users */}
        {!collapsed && plan === 'free' && (
          <Link
            href="/settings/billing"
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            Upgrade plan
          </Link>
        )}
      </div>
    </aside>
  );
}
