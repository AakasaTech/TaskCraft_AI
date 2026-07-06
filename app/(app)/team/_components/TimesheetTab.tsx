'use client';

import { useState, useEffect, useTransition } from 'react';
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getTimesheetData, type TimesheetRow } from '../actions';

function initials(name: string | null, email: string) {
  if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return email[0]?.toUpperCase() ?? 'U';
}

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: 'This week',  getDates: () => {
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return [isoDate(mon), isoDate(sun)] as [string, string];
  }},
  { label: 'This month', getDates: () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [isoDate(start), isoDate(end)] as [string, string];
  }},
  { label: 'Last month', getDates: () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end   = new Date(now.getFullYear(), now.getMonth(), 0);
    return [isoDate(start), isoDate(end)] as [string, string];
  }},
];

export function TimesheetTab() {
  const defaultDates = PRESETS[1].getDates();
  const [dateFrom, setDateFrom] = useState(defaultDates[0]);
  const [dateTo,   setDateTo]   = useState(defaultDates[1]);
  const [data,     setData]     = useState<TimesheetRow[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  function load() {
    startTransition(async () => {
      const result = await getTimesheetData(dateFrom, dateTo);
      if (result.data) setData(result.data);
    });
  }

  function toggleExpanded(uid: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }

  function applyPreset(preset: typeof PRESETS[0]) {
    const [from, to] = preset.getDates();
    setDateFrom(from);
    setDateTo(to);
  }

  const totalMinutes = (data ?? []).reduce((s, r) => s + r.totalMinutes, 0);
  const totalBillable = (data ?? []).reduce((s, r) => s + r.billableMinutes, 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {PRESETS.map((p) => {
            const [pFrom, pTo] = p.getDates();
            const active = pFrom === dateFrom && pTo === dateTo;
            return (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-input bg-background px-2 py-1 text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
        <button
          onClick={load}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', isPending && 'animate-spin')} />
        </button>
      </div>

      {/* Summary */}
      {(data?.length ?? 0) > 0 && (
        <div className="flex gap-4 text-sm">
          <div className="rounded-xl border border-border bg-card px-4 py-2.5">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-bold">{fmtMinutes(totalMinutes)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-2.5">
            <p className="text-xs text-muted-foreground">Billable</p>
            <p className="font-bold">{fmtMinutes(totalBillable)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-2.5">
            <p className="text-xs text-muted-foreground">Members</p>
            <p className="font-bold">{data?.length ?? 0}</p>
          </div>
        </div>
      )}

      {isPending && !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading timesheet…</span>
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-border py-12 text-center text-muted-foreground text-sm">
          No time entries for this period.
        </div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((row) => (
            <div key={row.user_id} className="rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => toggleExpanded(row.user_id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
              >
                {expanded.has(row.user_id)
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={row.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {initials(row.full_name, '')}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm font-medium">{row.full_name ?? 'Unknown'}</span>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fmtMinutes(row.totalMinutes)}
                  </span>
                  {row.billableMinutes > 0 && (
                    <span className="text-green-600 dark:text-green-400">{fmtMinutes(row.billableMinutes)} billable</span>
                  )}
                  <span>{row.entries.length} {row.entries.length === 1 ? 'entry' : 'entries'}</span>
                </div>
              </button>

              {expanded.has(row.user_id) && (
                <div className="border-t border-border divide-y divide-border">
                  {row.entries.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                      <span className="w-[5rem] shrink-0 text-muted-foreground">
                        {new Date(e.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      {e.project_color && (
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: e.project_color }} />
                      )}
                      <span className="flex-1 truncate text-muted-foreground">
                        {e.description ?? e.task_title ?? '—'}
                      </span>
                      {e.billable && (
                        <span className="text-green-600 dark:text-green-400 font-medium">billable</span>
                      )}
                      <span className="font-medium w-14 text-right">{fmtMinutes(e.duration_minutes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
