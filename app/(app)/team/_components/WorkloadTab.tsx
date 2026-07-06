'use client';

import { useState, useEffect, useTransition } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getWorkloadData, type WorkloadMember } from '../actions';

const STATUS_CONFIG: Array<{ key: string; label: string; color: string }> = [
  { key: 'backlog',     label: 'Backlog',     color: 'bg-slate-300 dark:bg-slate-600' },
  { key: 'todo',        label: 'To Do',       color: 'bg-blue-400' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-400' },
  { key: 'in_review',   label: 'In Review',   color: 'bg-violet-400' },
  { key: 'done',        label: 'Done',        color: 'bg-green-500' },
];

function initials(name: string | null, email: string) {
  if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return email[0]?.toUpperCase() ?? 'U';
}

export function WorkloadTab() {
  const [data, setData] = useState<WorkloadMember[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { load(); }, []);

  function load() {
    startTransition(async () => {
      const result = await getWorkloadData();
      if (result.data) setData(result.data);
    });
  }

  if (isPending && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading workload data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Team Workload</p>
          <p className="text-xs text-muted-foreground">Active tasks per member · Hours logged this month</p>
        </div>
        <button
          onClick={load}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', isPending && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {STATUS_CONFIG.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-sm', s.color)} />
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Member cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((member) => {
          const maxTasks = Math.max(...(data ?? []).map((m) => m.totalTasks), 1);

          return (
            <div key={member.user_id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[11px] font-semibold">
                    {initials(member.full_name, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{member.full_name ?? member.email}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{member.role}</p>
                </div>
              </div>

              {/* Task breakdown bar */}
              {member.totalTasks > 0 ? (
                <>
                  <div className="flex h-2 rounded-full overflow-hidden gap-px">
                    {STATUS_CONFIG.map((s) => {
                      const count = member.taskCounts[s.key] ?? 0;
                      if (count === 0) return null;
                      const pct = (count / member.totalTasks) * 100;
                      return (
                        <div
                          key={s.key}
                          title={`${s.label}: ${count}`}
                          className={cn('h-full', s.color)}
                          style={{ width: `${pct}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{member.totalTasks} task{member.totalTasks !== 1 ? 's' : ''}</span>
                    <span>{member.hoursThisMonth}h this month</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {STATUS_CONFIG.filter((s) => (member.taskCounts[s.key] ?? 0) > 0).map((s) => (
                      <div key={s.key} className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-sm shrink-0', s.color)} />
                        <span className="text-[11px] text-muted-foreground">
                          {s.label}: <strong className="text-foreground">{member.taskCounts[s.key]}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-2 text-center">
                  <p className="text-xs text-muted-foreground">No assigned tasks</p>
                  <p className="text-[11px] text-muted-foreground">{member.hoursThisMonth}h logged this month</p>
                </div>
              )}
            </div>
          );
        })}

        {data?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
            No team members found.
          </div>
        )}
      </div>
    </div>
  );
}
