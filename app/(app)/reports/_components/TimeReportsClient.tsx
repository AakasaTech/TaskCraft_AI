'use client';

import { useState, useMemo } from 'react';
import { Download, Clock, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimeEntryRich } from '@/app/(app)/time/_types';

type ReportTab = 'summary' | 'project' | 'client' | 'task' | 'billable' | 'weekly' | 'monthly';
type Range     = '7d' | '30d' | '90d' | 'all';

function fmtMins(mins: number): string {
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtCurrency(n: number): string {
  return n > 0 ? `$${n.toFixed(2)}` : '—';
}

function getMonday(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day  = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

function weekKey(d: Date): string {
  const mon = getMonday(d);
  return mon.toLocaleDateString('en-CA');
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface RowProps { label: string; mins: number; billableMins: number; value: number; total: number }
function DataRow({ label, mins, billableMins, value, total }: RowProps) {
  const pct = total > 0 ? (mins / total) * 100 : 0;
  return (
    <div className="space-y-1 px-5 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 truncate text-sm font-medium">{label || '(no name)'}</span>
        <div className="flex shrink-0 items-center gap-6 text-sm">
          <span className="w-20 text-right font-mono tabular-nums text-muted-foreground">{fmtMins(billableMins)}</span>
          <span className="w-16 text-right font-mono tabular-nums text-muted-foreground">{fmtCurrency(value)}</span>
          <span className="w-20 text-right font-mono font-semibold tabular-nums">{fmtMins(mins)}</span>
        </div>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TableHeader() {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-2.5">
      <span className="text-xs font-medium text-muted-foreground">Name</span>
      <div className="flex shrink-0 items-center gap-6 text-xs text-muted-foreground">
        <span className="w-20 text-right">Billable</span>
        <span className="w-16 text-right">Value</span>
        <span className="w-20 text-right">Total</span>
      </div>
    </div>
  );
}

function downloadCSV(entries: TimeEntryRich[]) {
  const headers = ['Date', 'Description', 'Project', 'Client', 'Task', 'Duration (min)', 'Billable', 'Rate/hr', 'Value'];
  const rows = entries.map((e) => [
    new Date(e.start_time).toLocaleDateString('en-CA'),
    e.description ?? '',
    e.project_name ?? '',
    e.client_name ?? '',
    e.task_title ?? '',
    e.duration_minutes ?? '',
    e.billable ? 'Yes' : 'No',
    e.hourly_rate ?? '',
    (e.billable && e.hourly_rate && e.duration_minutes)
      ? ((e.duration_minutes / 60) * e.hourly_rate).toFixed(2)
      : '',
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `time-report-${new Date().toLocaleDateString('en-CA')}.csv`;
  a.click();
}

const RANGES: { id: Range; label: string }[] = [
  { id: '7d',  label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'all', label: 'All time' },
];

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'summary',  label: 'Summary' },
  { id: 'project',  label: 'By Project' },
  { id: 'client',   label: 'By Client' },
  { id: 'task',     label: 'By Task' },
  { id: 'billable', label: 'Billable' },
  { id: 'weekly',   label: 'Weekly' },
  { id: 'monthly',  label: 'Monthly' },
];

interface Props { entries: TimeEntryRich[] }

export function TimeReportsClient({ entries: allEntries }: Props) {
  const [range, setRange] = useState<Range>('30d');
  const [tab, setTab]     = useState<ReportTab>('summary');

  const entries = useMemo(() => {
    if (range === 'all') return allEntries;
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return allEntries.filter((e) => new Date(e.start_time) >= cutoff);
  }, [allEntries, range]);

  const totalMins    = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const billableMins = entries.filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const nonBillMin   = totalMins - billableMins;
  const billableVal  = entries.reduce((s, e) =>
    s + (e.billable && e.hourly_rate ? (e.duration_minutes ?? 0) / 60 * e.hourly_rate : 0), 0);

  // Aggregation helpers
  function aggregate(key: (e: TimeEntryRich) => string, label: (e: TimeEntryRich) => string) {
    const map = new Map<string, { label: string; mins: number; billableMins: number; value: number }>();
    for (const e of entries) {
      const k = key(e);
      const existing = map.get(k) ?? { label: label(e), mins: 0, billableMins: 0, value: 0 };
      existing.mins += e.duration_minutes ?? 0;
      if (e.billable) {
        existing.billableMins += e.duration_minutes ?? 0;
        existing.value += (e.hourly_rate ?? 0) * ((e.duration_minutes ?? 0) / 60);
      }
      map.set(k, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.mins - a.mins);
  }

  const byProject = useMemo(() =>
    aggregate((e) => e.project_id ?? '', (e) => e.project_name ?? 'No project'), [entries]);
  const byClient = useMemo(() =>
    aggregate((e) => e.client_name ?? '', (e) => e.client_name ?? 'No client'), [entries]);
  const byTask = useMemo(() =>
    aggregate((e) => e.task_id ?? e.description ?? '', (e) => e.task_title ?? e.description ?? 'No task'), [entries]);

  // Weekly breakdown
  const weeklyData = useMemo(() => {
    const map = new Map<string, { label: string; mins: number; billableMins: number; value: number }>();
    for (const e of entries) {
      const k = weekKey(new Date(e.start_time));
      const existing = map.get(k) ?? { label: k, mins: 0, billableMins: 0, value: 0 };
      existing.mins += e.duration_minutes ?? 0;
      if (e.billable) {
        existing.billableMins += e.duration_minutes ?? 0;
        existing.value += (e.hourly_rate ?? 0) * ((e.duration_minutes ?? 0) / 60);
      }
      map.set(k, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, v]) => ({ ...v, label: new Date(v.label + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' week' }));
  }, [entries]);

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    const map = new Map<string, { label: string; mins: number; billableMins: number; value: number }>();
    for (const e of entries) {
      const k = monthKey(new Date(e.start_time));
      const existing = map.get(k) ?? { label: k, mins: 0, billableMins: 0, value: 0 };
      existing.mins += e.duration_minutes ?? 0;
      if (e.billable) {
        existing.billableMins += e.duration_minutes ?? 0;
        existing.value += (e.hourly_rate ?? 0) * ((e.duration_minutes ?? 0) / 60);
      }
      map.set(k, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, v]) => ({
        ...v,
        label: new Date(v.label + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      }));
  }, [entries]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Range picker */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                range === r.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => downloadCSV(entries)}
          className="ml-auto tc-btn-secondary gap-1.5 px-3 py-2 text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total hours',    value: fmtMins(totalMins),    icon: Clock,       iconBg: 'bg-sky-100 dark:bg-sky-900/30',         iconColor: 'text-sky-600 dark:text-sky-400' },
          { label: 'Billable hours', value: fmtMins(billableMins), icon: TrendingUp,  iconBg: 'bg-primary/10',                          iconColor: 'text-primary' },
          { label: 'Billable value', value: fmtCurrency(billableVal), icon: DollarSign, iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Non-billable',   value: fmtMins(nonBillMin),   icon: BarChart3,   iconBg: 'bg-slate-100 dark:bg-slate-800',          iconColor: 'text-slate-500 dark:text-slate-400' },
        ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
          <div key={label} className="tc-card flex items-center gap-3 px-4 py-4">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', iconBg)}>
              <Icon className={cn('h-4 w-4', iconColor)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'summary' && (
        <div className="tc-card overflow-hidden">
          <TableHeader />
          {byProject.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No data for this period.</div>
          ) : (
            byProject.map((row) => (
              <DataRow key={row.label} {...row} total={totalMins} />
            ))
          )}
        </div>
      )}

      {tab === 'project' && (
        <div className="tc-card overflow-hidden">
          <TableHeader />
          {byProject.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No project data for this period.</div>
          ) : (
            byProject.map((row) => (
              <DataRow key={row.label} {...row} total={totalMins} />
            ))
          )}
        </div>
      )}

      {tab === 'client' && (
        <div className="tc-card overflow-hidden">
          <TableHeader />
          {byClient.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No client data for this period.</div>
          ) : (
            byClient.map((row) => (
              <DataRow key={row.label} {...row} total={totalMins} />
            ))
          )}
        </div>
      )}

      {tab === 'task' && (
        <div className="tc-card overflow-hidden">
          <TableHeader />
          {byTask.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No task data for this period.</div>
          ) : (
            byTask.map((row) => (
              <DataRow key={row.label} {...row} total={totalMins} />
            ))
          )}
        </div>
      )}

      {tab === 'billable' && (
        <div className="tc-card overflow-hidden">
          <TableHeader />
          <DataRow
            label="Billable"
            mins={billableMins}
            billableMins={billableMins}
            value={billableVal}
            total={totalMins}
          />
          <DataRow
            label="Non-billable"
            mins={nonBillMin}
            billableMins={0}
            value={0}
            total={totalMins}
          />
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-5 py-3">
            <span className="text-xs text-muted-foreground">
              Billable rate:{' '}
              {totalMins > 0 ? `${Math.round((billableMins / totalMins) * 100)}%` : '—'}
            </span>
            <span className="font-mono text-sm font-bold">{fmtMins(totalMins)}</span>
          </div>
        </div>
      )}

      {tab === 'weekly' && (
        <div className="tc-card overflow-hidden">
          <TableHeader />
          {weeklyData.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No data for this period.</div>
          ) : (
            weeklyData.map((row) => (
              <DataRow key={row.label} {...row} total={Math.max(...weeklyData.map((w) => w.mins))} />
            ))
          )}
        </div>
      )}

      {tab === 'monthly' && (
        <div className="tc-card overflow-hidden">
          <TableHeader />
          {monthlyData.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No data for this period.</div>
          ) : (
            monthlyData.map((row) => (
              <DataRow key={row.label} {...row} total={Math.max(...monthlyData.map((m) => m.mins))} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
