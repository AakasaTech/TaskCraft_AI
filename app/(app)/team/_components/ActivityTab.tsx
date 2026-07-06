'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getActivityFeed, type ActivityEntry } from '../actions';

interface Member {
  user_id: string;
  profiles: { full_name: string | null; avatar_url: string | null; email: string } | null;
}

function initials(name: string | null, email: string) {
  if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return email[0]?.toUpperCase() ?? 'U';
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function describeAction(action: string, oldVal: unknown, newVal: unknown): string {
  switch (action) {
    case 'created':          return 'created task';
    case 'status_changed':   return `changed status to ${newVal}`;
    case 'priority_changed': return `changed priority to ${newVal}`;
    case 'assignee_changed': return 'changed assignee';
    case 'due_date_changed': return newVal ? `set due date to ${new Date(newVal as string).toLocaleDateString()}` : 'cleared due date';
    case 'title_changed':    return `renamed to "${newVal}"`;
    case 'comment_added':    return 'added a comment';
    case 'attachment_added': return 'added an attachment';
    case 'label_added':      return 'added a label';
    case 'label_removed':    return 'removed a label';
    default:                 return action.replace(/_/g, ' ');
  }
}

const ACTION_DOT: Record<string, string> = {
  created:          'bg-green-500',
  status_changed:   'bg-blue-500',
  priority_changed: 'bg-amber-500',
  comment_added:    'bg-violet-500',
  assignee_changed: 'bg-cyan-500',
};

export function ActivityTab({ members }: { members: Member[] }) {
  const [data,       setData]       = useState<ActivityEntry[] | null>(null);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [isPending,  startTransition] = useTransition();

  useEffect(() => { load(); }, [filterUser]);

  function load() {
    startTransition(async () => {
      const result = await getActivityFeed(60, filterUser === 'all' ? undefined : filterUser);
      if (result.data) setData(result.data);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold">Team Activity</p>
          <p className="text-xs text-muted-foreground">Recent task activity across all projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="All members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All members</SelectItem>
              {members.map((m) => {
                const p = m.profiles;
                const name = p?.full_name ?? p?.email ?? m.user_id;
                return (
                  <SelectItem key={m.user_id} value={m.user_id} className="text-xs">
                    {name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <button
            onClick={load}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', isPending && 'animate-spin')} />
          </button>
        </div>
      </div>

      {isPending && !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading activity…</span>
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-border py-12 text-center text-muted-foreground text-sm">
          No activity found.
        </div>
      ) : (
        <div className="relative pl-5">
          {/* Timeline line */}
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-4">
            {(data ?? []).map((entry) => (
              <div key={entry.id} className="relative flex items-start gap-3">
                {/* Dot */}
                <span
                  className={cn(
                    'absolute -left-5 mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                    ACTION_DOT[entry.action] ?? 'bg-muted-foreground',
                  )}
                />

                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarImage src={entry.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] font-semibold">
                    {initials(entry.full_name, entry.user_id ?? '')}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    <span className="font-semibold">{entry.full_name ?? 'Someone'}</span>
                    {' '}
                    <span className="text-muted-foreground">{describeAction(entry.action, entry.old_value, entry.new_value)}</span>
                    {' — '}
                    <Link href={`/tasks`} className="text-primary hover:underline">
                      {entry.task_title}
                    </Link>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(entry.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
