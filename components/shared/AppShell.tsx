'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import type { RunningTimer } from '@/app/(app)/time/_types';

interface Props {
  user: {
    full_name?: string | null;
    email?: string;
    avatar_url?: string | null;
    plan?: string;
  };
  userId: string;
  runningTimer: RunningTimer | null;
  children: React.ReactNode;
}

export function AppShell({ user, userId, runningTimer, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar  = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, static on desktop */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 transition-transform duration-200',
          'md:relative md:translate-x-0 md:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <Sidebar user={user} onCloseMobile={closeSidebar} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <AppHeader
          runningTimer={runningTimer}
          userId={userId}
          onMenuClick={toggleSidebar}
        />
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
