'use client';

import { useMemo } from 'react';
import { Building2, Download, TrendingUp } from 'lucide-react';
import type { ReportProps, ReportTimeEntry } from '../_types';
import { fmtMins, fmtMoney, billableValue, generateCSV, downloadCSV } from '../_utils';

interface ClientRow {
  id:         string;
  name:       string;
  projects:   Set<string>;
  totalMins:  number;
  billMins:   number;
  revenue:    number;
  avgRate:    number;
}

export function ClientProfitabilityReport({ entries, projects }: ReportProps) {
  const rows = useMemo((): ClientRow[] => {
    const map = new Map<string, ClientRow>();

    for (const e of entries) {
      const cid  = e.client_id  ?? '__none__';
      const name = e.client_name ?? 'No client';
      const row  = map.get(cid) ?? { id: cid, name, projects: new Set(), totalMins: 0, billMins: 0, revenue: 0, avgRate: 0 };
      row.totalMins += e.duration_minutes ?? 0;
      if (e.project_id) row.projects.add(e.project_id);
      if (e.billable) {
        row.billMins += e.duration_minutes ?? 0;
        row.revenue  += billableValue(e);
      }
      map.set(cid, row);
    }

    // Compute avg rate (revenue / billable hours)
    for (const row of map.values()) {
      row.avgRate = row.billMins > 0 ? row.revenue / (row.billMins / 60) : 0;
    }

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [entries]);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const topClient    = rows[0];

  function handleExport() {
    const csv = generateCSV(
      ['Client', 'Projects', 'Total Hours', 'Billable Hours', 'Revenue', 'Avg Rate/hr', 'Billable %'],
      rows.map(r => [
        r.name, r.projects.size,
        (r.totalMins / 60).toFixed(1),
        (r.billMins / 60).toFixed(1),
        r.revenue.toFixed(2),
        r.avgRate.toFixed(2),
        r.totalMins > 0 ? Math.round((r.billMins / r.totalMins) * 100) : 0,
      ]),
    );
    downloadCSV(csv, 'client-profitability');
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total clients',    value: rows.filter(r => r.id !== '__none__').length },
          { label: 'Total revenue',    value: fmtMoney(totalRevenue) },
          { label: 'Top client',       value: topClient?.name ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="tc-card px-4 py-4 text-center">
            <p className="text-xl font-bold tabular-nums truncate">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Client table */}
      <div className="tc-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Client profitability</p>
          <button onClick={handleExport} className="tc-btn-secondary gap-1.5 text-xs px-3 py-1.5 print:hidden">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {/* Header */}
        <div className="grid grid-cols-5 gap-4 px-5 py-2 border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
          <span className="col-span-2">Client</span>
          <span className="text-right">Hours</span>
          <span className="text-right">Revenue</span>
          <span className="text-right">Avg rate</span>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No client data for this period.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => {
              const billPct = r.totalMins > 0 ? Math.round((r.billMins / r.totalMins) * 100) : 0;
              const revShare = totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={r.id} className="report-row space-y-2 px-5 py-4">
                  <div className="grid grid-cols-5 gap-4 items-center">
                    <div className="col-span-2 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.projects.size} project{r.projects.size !== 1 ? 's' : ''} · {billPct}% billable</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm tabular-nums">{fmtMins(r.totalMins)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{fmtMins(r.billMins)} bill.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-primary">{r.revenue > 0 ? fmtMoney(r.revenue) : '—'}</p>
                      {totalRevenue > 0 && r.revenue > 0 && (
                        <p className="text-xs text-muted-foreground">{revShare.toFixed(0)}% of total</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm tabular-nums">{r.avgRate > 0 ? `$${r.avgRate.toFixed(0)}/hr` : '—'}</p>
                    </div>
                  </div>
                  {/* Revenue share bar */}
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${revShare}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalRevenue > 0 && (
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-5 py-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Total revenue
            </div>
            <span className="text-sm font-bold text-primary">{fmtMoney(totalRevenue)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
