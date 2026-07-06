'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, X, CheckCheck, CheckSquare, Clock, AlertCircle,
  MessageSquare, CalendarDays, Timer, FileCheck, Ticket, Users,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import type { Notification, NotificationType } from '@/lib/types';

// ── Icon + colour per notification type ──────────────────────────────────────

const TYPE_META: Record<NotificationType, {
  Icon:  React.ElementType;
  color: string;
  bg:    string;
}> = {
  task_assigned:               { Icon: CheckSquare, color: 'text-blue-500',   bg: 'bg-blue-50   dark:bg-blue-900/30'   },
  task_due_soon:               { Icon: Clock,       color: 'text-amber-500',  bg: 'bg-amber-50  dark:bg-amber-900/30'  },
  task_overdue:                { Icon: AlertCircle, color: 'text-red-500',    bg: 'bg-red-50    dark:bg-red-900/30'    },
  comment_added:               { Icon: MessageSquare, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/30' },
  project_deadline_near:       { Icon: CalendarDays, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30' },
  timer_running_long:          { Icon: Timer,       color: 'text-cyan-500',   bg: 'bg-cyan-50   dark:bg-cyan-900/30'   },
  invoice_sync_completed:      { Icon: FileCheck,   color: 'text-green-500',  bg: 'bg-green-50  dark:bg-green-900/30'  },
  support_ticket_task_created: { Icon: Ticket,      color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  team_invitation_received:    { Icon: Users,       color: 'text-primary',    bg: 'bg-primary/10'                      },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Single notification item ──────────────────────────────────────────────────

function NotifItem({
  notif,
  onRead,
}: {
  notif: Notification;
  onRead: (id: string) => void;
}) {
  const router = useRouter();
  const meta   = TYPE_META[notif.type] ?? TYPE_META.task_assigned;
  const { Icon } = meta;

  function handleClick() {
    if (!notif.is_read) onRead(notif.id);
    if (notif.link) router.push(notif.link);
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'relative w-full text-left px-4 py-3 transition-colors hover:bg-accent/50',
        !notif.is_read && 'bg-primary/[0.03]',
      )}
    >
      {/* Unread dot */}
      {!notif.is_read && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
      )}

      <div className="flex items-start gap-3 pl-2">
        <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', meta.bg)}>
          <Icon className={cn('h-4 w-4', meta.color)} />
        </span>

        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-xs', notif.is_read ? 'font-normal text-foreground' : 'font-semibold text-foreground')}>
            {notif.title}
          </p>
          {notif.body && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
              {notif.body}
            </p>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground/60">{relativeTime(notif.created_at)}</p>
        </div>
      </div>
    </button>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

function NotificationPanel({
  notifications,
  unreadCount,
  loading,
  hasMore,
  onMarkRead,
  onMarkAllRead,
  onLoadMore,
  onClose,
}: {
  notifications: Notification[];
  unreadCount:   number;
  loading:       boolean;
  hasMore:       boolean;
  onMarkRead:    (id: string) => void;
  onMarkAllRead: () => void;
  onLoadMore:    () => void;
  onClose:       () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-popover shadow-xl ring-1 ring-black/5 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-bold text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-border/50">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">You&apos;re all caught up!</p>
          </div>
        ) : (
          <>
            {notifications.map((n) => (
              <NotifItem key={n.id} notif={n} onRead={onMarkRead} />
            ))}
            {hasMore && (
              <button
                onClick={onLoadMore}
                disabled={loading}
                className="w-full py-3 text-center text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main bell component ───────────────────────────────────────────────────────

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [hasMore,       setHasMore]       = useState(false);
  const [initialFetched, setInitialFetched] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ── Fetch notifications ─────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const url = `/api/notifications?limit=20${cursor ? `&before=${encodeURIComponent(cursor)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json() as {
        notifications: Notification[];
        unread_count:  number;
        has_more:      boolean;
      };

      setNotifications((prev) => cursor ? [...prev, ...data.notifications] : data.notifications);
      setUnreadCount(data.unread_count);
      setHasMore(data.has_more);
      setInitialFetched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch of unread count on mount (silent, no panel open)
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── Realtime subscription ───────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();
    const channel  = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev]);
          setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Click-outside close ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // ── Open panel (fetch fresh data) ──────────────────────────────────────────

  function handleToggle() {
    if (!open) {
      fetchNotifications();
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  // ── Mark single as read ─────────────────────────────────────────────────────

  async function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  // ── Mark all as read ────────────────────────────────────────────────────────

  async function handleMarkAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })),
    );
    setUnreadCount(0);
    await fetch('/api/notifications/read-all', { method: 'POST' });
  }

  // ── Load more ───────────────────────────────────────────────────────────────

  function handleLoadMore() {
    const last = notifications[notifications.length - 1];
    if (last) fetchNotifications(last.created_at);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        aria-label="Notifications"
        onClick={handleToggle}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          hasMore={hasMore}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onLoadMore={handleLoadMore}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
