'use client';

import { Menu, Search } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Input } from '@/components/ui/input';
import { RunningTimerBadge } from './RunningTimerBadge';
import { NotificationBell } from './NotificationBell';
import type { RunningTimer } from '@/app/(app)/time/_types';

interface Props {
  runningTimer?: RunningTimer | null;
  userId:        string;
  onMenuClick?:  () => void;
}

export function AppHeader({ runningTimer, userId, onMenuClick }: Props) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 sm:px-6">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="md:hidden -ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="relative max-w-xs flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search tasks, projects…"
          className="h-8 pl-8 text-xs bg-muted/50 border-0 focus-visible:ring-1"
        />
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-2">
        <RunningTimerBadge timer={runningTimer ?? null} />
        <NotificationBell userId={userId} />
        <ThemeToggle />
      </div>
    </header>
  );
}
