'use client';

import { useMemo } from 'react';
import { Clock, Download, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportProps, ReportTimeEntry } from '../_types';
import { fmtMins, fmtMoney, fmtDate, billableValue, generateCSV, downloadCSV } from '../_utils';

function Bar({ label, mins, billMins, value, total }: { label: string; mins: number; billMins: number; value: number; total: number }) {
  const pct = total > 0 ? (mins / total) * 100 : 0;
  return (
    <div className="report-row space-y-1 px-5 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 truncate text-sm">{label || '(unnamed)'}</span>
        <div className="flex shrink-0 items-center gap-5 text-xs text-muted-foreground">
          <span className="w-20 text-right tabular-nums">{fmtMins(billMins)} bill.</span>
          <span className="w-16 text-right tabular-nums font-medium text-foreground">{fmtMins(mins)}</span>
          {value > 0 && <span className="w-20 text-right tabular-nums text-primary">{fmtMoney(value)}</span>}
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TimeTrackingReport({ entries }: ReportProps) {
  const totalMins    = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const billableMins = entries.filter(e => e.billable).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const nonBillMins  = totalMins - billableMins;
  const totalValue   = entries.reduce((s, e) => s + billableValue(e), 0);
  const billPct      = totalMins > 0 ? Math.round((billableMins / totalMins) * 100) : 0;

  function agg(key: (e: ReportTimeEntry) => string, label: (e: ReportTimeEntry) => string) {
    const map = new Map<string, { label: string; mins: number; billMins: number; value: number }>();
    for (const e of entries) {
      const k = key(e);
      const x = map.get(k) ?? { label: label(e), mins: 0, billMins: 0, value: 0 };
      x.mins += e.duration_minutes ?? 0;
      if (e.billable) { x.billMins += e.duration_minutes ?? 0; x.value += billableValue(e); }
      map.set(k, x);
    }
    return Array.from(map.values()).sort((a, b) => b.mins - a.mins);
  }

  const byProject = useMemo(() => agg(e => e.project_id ?? '', e => e.project_name ?? 'No project'), [entries]);
  const byClient  = useMemo(() => agg(e => e.client_id  ?? '', e => e.client_name  ?? 'No client'),  [entries]);
  const byUser    = useMemo(() => agg(e => e.user_id,          e => e.user_name    ?? 'Unknown'),     [entries]);

  // Daily breakdown (last 14 days)
  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const d = e.start_time.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + (e.duration_minutes ?? 0));
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14);
  }, [entries]);
  const maxDaily = Math.max(...dailyData.map(([, m]) => m), 1);

  function handleExport() {
    const csv = generateCSV(
      ['Date', 'Description', 'Project', 'Client', 'Task', 'Member', 'Duration (min)', 'Billable', 'Rate/hr', 'Value'],
      entries.map(e => [
        fmtDate(e.start_time), e.description ?? '',
        e.project_name ?? '', e.client_name ?? '', e.task_title ?? '', e.user_name ?? '',
        e.duration_minutes ?? 0, e.billable ? 'Yes' : 'No',
        e.hourly_rate ?? '', billableValue(e).toFixed(2),
      ]),
    );
    downloadCSV(csv, 'time-tracking');
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total hours',    value: fmtMins(totalMins),    icon: Clock,      iconBg: 'bg-sky-100 dark:bg-sky-900/30',     ic: 'text-sky-600 dark:text-sky-400' },
          { label: 'Billable',       value: fmtMins(billableMins), icon: TrendingUp,  iconBg: 'bg-primary/10',                    ic: 'text-primary' },
          { label: 'Revenue',        value: fmtMoney(totalValue),  icon: DollarSign,  iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', ic: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Non-billable',   value: fmtMins(nonBillMins),  icon: BarChart3,   iconBg: 'bg-muted',                          ic: 'text-muted-foreground' },
        ].map(({ label, value, icon: Icon, iconBg, ic }) => (
          <div key={label} className="tc-card flex items-center gap-3 px-4 py-4">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', iconBg)}>
              <Icon className={cn('h-4 w-4', ic)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-base font-bold tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Billable rate pill */}
      <div className="tc-card px-5 py-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Billable rate</span>
        <div className="flex items-center gap-3">
          <div className="w-40 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${billPct}%` }} />
          </div>
          <span className="text-sm font-bold">{billPct}%</span>
        </div>
      </div>

      {/* Daily mini-chart */}
      {dailyData.length > 0 && (
        <div className="tc-card p-5 space-y-3">
          <p className="text-sm font-semibold">Daily hours (recent)</p>
          <div className="flex items-end gap-1 h-16">
            {dailyData.map(([date, mins]) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  title={`${fmtMins(mins)} on ${date}`}
                  className="w-full rounded-sm bg-primary/70 transition-all"
                  style={{ height: `${(mins / maxDaily) * 100}%`, minHeight: mins > 0 ? 2 : 0 }}
                />
                <span className="text-[9px] text-muted-foreground rotate-0 leading-none hidden sm:block">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By project */}
      {byProject.length > 0 && (
        <div className="tc-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <p className="text-sm font-semibold">By project</p>
          </div>
          {byProject.map(r => <Bar key={r.label} {...r} total={totalMins} />)}
        </div>
      )}

      {/* By client */}
      {byClient.length > 1 && (
        <div className="tc-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <p className="text-sm font-semibold">By client</p>
          </div>
          {byClient.map(r => <Bar key={r.label} {...r} total={totalMins} />)}
        </div>
      )}

      {/* By member */}
      {byUser.length > 1 && (
        <div className="tc-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <p className="text-sm font-semibold">By member</p>
          </div>
          {byUser.map(r => <Bar key={r.label} {...r} total={totalMins} />)}
        </div>
      )}

      {/* Entry list */}
      <div className="tc-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">{entries.length} entries</p>
          <button onClick={handleExport} className="tc-btn-secondary gap-1.5 text-xs px-3 py-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No time entries for this period.</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {entries.slice(0, 200).map((e) => (
              <div key={e.id} className="report-row flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{e.description || 'No description'}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {e.project_color && (
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ background: e.project_color }} />
                        <p className="text-xs text-muted-foreground">{e.project_name}</p>
                      </div>
                    )}
                    {e.client_name && <p className="text-xs text-muted-foreground">{e.client_name}</p>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium tabular-nums">{fmtMins(e.duration_minutes ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(e.start_time)}</p>
                </div>
                {e.billable && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                    {billableValue(e) > 0 ? fmtMoney(billableValue(e)) : 'Billable'}
                  </span>
                )}
              </div>
            ))}
            {entries.length > 200 && (
              <div className="px-5 py-3 text-xs text-center text-muted-foreground">
                Showing first 200 of {entries.length} entries — export CSV for full data
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
