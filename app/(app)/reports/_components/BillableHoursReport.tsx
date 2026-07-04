'use client';

import { useMemo } from 'react';
import { DollarSign, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportProps, ReportTimeEntry } from '../_types';
import { fmtMins, fmtMoney, fmtDate, billableValue, generateCSV, downloadCSV } from '../_utils';

export function BillableHoursReport({ entries }: ReportProps) {
  const totalMins    = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const billableMins = entries.filter(e => e.billable).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const nonBillMins  = totalMins - billableMins;
  const totalValue   = entries.reduce((s, e) => s + billableValue(e), 0);
  const billPct      = totalMins > 0 ? Math.round((billableMins / totalMins) * 100) : 0;

  function agg(key: (e: ReportTimeEntry) => string, label: (e: ReportTimeEntry) => string) {
    const map = new Map<string, { label: string; total: number; bill: number; nonBill: number; value: number }>();
    for (const e of entries) {
      const k = key(e);
      const x = map.get(k) ?? { label: label(e), total: 0, bill: 0, nonBill: 0, value: 0 };
      x.total += e.duration_minutes ?? 0;
      if (e.billable) { x.bill += e.duration_minutes ?? 0; x.value += billableValue(e); }
      else             { x.nonBill += e.duration_minutes ?? 0; }
      map.set(k, x);
    }
    return Array.from(map.values()).sort((a, b) => b.bill - a.bill);
  }

  const byProject = useMemo(() => agg(e => e.project_id ?? '', e => e.project_name ?? 'No project'), [entries]);
  const byClient  = useMemo(() => agg(e => e.client_id  ?? '', e => e.client_name  ?? 'No client'),  [entries]);

  // Weekly trend
  const weeklyTrend = useMemo(() => {
    const map = new Map<string, { bill: number; nonBill: number }>();
    for (const e of entries) {
      const w = e.start_time.slice(0, 7); // YYYY-MM
      const x = map.get(w) ?? { bill: 0, nonBill: 0 };
      if (e.billable) x.bill += e.duration_minutes ?? 0;
      else            x.nonBill += e.duration_minutes ?? 0;
      map.set(w, x);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6);
  }, [entries]);

  function handleExport() {
    const csv = generateCSV(
      ['Date', 'Project', 'Client', 'Member', 'Duration (min)', 'Billable', 'Rate/hr', 'Value'],
      entries.filter(e => e.billable).map(e => [
        fmtDate(e.start_time), e.project_name ?? '', e.client_name ?? '', e.user_name ?? '',
        e.duration_minutes ?? 0, 'Yes', e.hourly_rate ?? '', billableValue(e).toFixed(2),
      ]),
    );
    downloadCSV(csv, 'billable-hours');
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Billable hours',   value: fmtMins(billableMins) },
          { label: 'Non-billable',     value: fmtMins(nonBillMins) },
          { label: 'Billable revenue', value: fmtMoney(totalValue) },
          { label: 'Billable rate',    value: `${billPct}%` },
        ].map(({ label, value }) => (
          <div key={label} className="tc-card px-4 py-4 text-center">
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Billable vs non-billable visual */}
      <div className="tc-card p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Billable vs Non-billable</span>
          <span className="text-muted-foreground">{fmtMins(totalMins)} total</span>
        </div>
        <div className="h-4 w-full rounded-full overflow-hidden bg-muted flex">
          <div className="bg-primary h-full rounded-l-full" style={{ width: `${billPct}%` }} />
          <div className="bg-muted-foreground/30 h-full rounded-r-full" style={{ width: `${100 - billPct}%` }} />
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            Billable {billPct}% — {fmtMins(billableMins)}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            Non-billable {100 - billPct}% — {fmtMins(nonBillMins)}
          </div>
        </div>
      </div>

      {/* Monthly trend */}
      {weeklyTrend.length > 0 && (
        <div className="tc-card p-5 space-y-3">
          <p className="text-sm font-semibold">Monthly trend</p>
          <div className="divide-y divide-border">
            {weeklyTrend.map(([month, { bill, nonBill }]) => {
              const t = bill + nonBill;
              const pct = t > 0 ? Math.round((bill / t) * 100) : 0;
              return (
                <div key={month} className="flex items-center gap-4 py-2.5">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">
                    {new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
                    <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium tabular-nums w-16 text-right shrink-0">{fmtMins(bill)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-right shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* By project */}
      {byProject.length > 0 && (
        <div className="tc-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="text-sm font-semibold">By project</p>
            <button onClick={handleExport} className="tc-btn-secondary gap-1.5 text-xs px-3 py-1.5 print:hidden">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
          <div className="divide-y divide-border">
            {byProject.map((r) => {
              const pct = r.total > 0 ? Math.round((r.bill / r.total) * 100) : 0;
              return (
                <div key={r.label} className="report-row px-5 py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate">{r.label}</span>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      <span className="tabular-nums">{fmtMins(r.bill)} billable</span>
                      <span className={cn('font-semibold', r.value > 0 ? 'text-primary' : '')}>{r.value > 0 ? fmtMoney(r.value) : '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden flex">
                      <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* By client */}
      {byClient.length > 1 && (
        <div className="tc-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <p className="text-sm font-semibold">By client</p>
          </div>
          <div className="divide-y divide-border">
            {byClient.map((r) => {
              const pct = r.total > 0 ? Math.round((r.bill / r.total) * 100) : 0;
              return (
                <div key={r.label} className="report-row px-5 py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate">{r.label}</span>
                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <span className="text-muted-foreground tabular-nums">{fmtMins(r.bill)}</span>
                      <span className={cn('font-semibold', r.value > 0 ? 'text-primary' : 'text-muted-foreground')}>{r.value > 0 ? fmtMoney(r.value) : '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden flex">
                      <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {entries.filter(e => e.billable).length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 tc-card">
          <DollarSign className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No billable time entries for this period.</p>
        </div>
      )}
    </div>
  );
}
