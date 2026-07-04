'use client';

import { useMemo } from 'react';
import { FileText, Download, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportProps, ReportTimeEntry } from '../_types';
import { fmtMins, fmtMoney, fmtDate, billableValue, generateCSV, downloadCSV } from '../_utils';

interface ProjectGroup {
  projectId:    string;
  projectName:  string;
  projectColor: string | null;
  entries:      ReportTimeEntry[];
  totalMins:    number;
  totalValue:   number;
}

interface ClientGroup {
  clientId:    string;
  clientName:  string;
  projects:    ProjectGroup[];
  totalMins:   number;
  totalValue:  number;
}

export function InvoiceReadyReport({ entries, filters }: ReportProps) {
  const uninvoiced = useMemo(
    () => entries.filter(e => e.billable && e.invoice_status === 'not_invoiced'),
    [entries],
  );

  const clientGroups = useMemo((): ClientGroup[] => {
    const clientMap = new Map<string, ClientGroup>();

    for (const e of uninvoiced) {
      const cid   = e.client_id   ?? '__none__';
      const cname = e.client_name ?? 'No client';
      const pid   = e.project_id  ?? '__none__';
      const pname = e.project_name ?? 'No project';

      let cg = clientMap.get(cid);
      if (!cg) {
        cg = { clientId: cid, clientName: cname, projects: [], totalMins: 0, totalValue: 0 };
        clientMap.set(cid, cg);
      }

      let pg = cg.projects.find(p => p.projectId === pid);
      if (!pg) {
        pg = { projectId: pid, projectName: pname, projectColor: e.project_color, entries: [], totalMins: 0, totalValue: 0 };
        cg.projects.push(pg);
      }

      const val = billableValue(e);
      pg.entries.push(e);
      pg.totalMins  += e.duration_minutes ?? 0;
      pg.totalValue += val;
      cg.totalMins  += e.duration_minutes ?? 0;
      cg.totalValue += val;
    }

    return Array.from(clientMap.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [uninvoiced]);

  const grandTotal   = clientGroups.reduce((s, c) => s + c.totalValue, 0);
  const grandMinutes = clientGroups.reduce((s, c) => s + c.totalMins, 0);

  function handleExport() {
    const csv = generateCSV(
      ['Date', 'Description', 'Client', 'Project', 'Member', 'Duration (min)', 'Rate/hr', 'Value'],
      uninvoiced.map(e => [
        fmtDate(e.start_time), e.description ?? '',
        e.client_name ?? '', e.project_name ?? '', e.user_name ?? '',
        e.duration_minutes ?? 0, e.hourly_rate ?? '', billableValue(e).toFixed(2),
      ]),
    );
    downloadCSV(csv, 'invoice-ready-time');
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Uninvoiced hours',  value: fmtMins(grandMinutes) },
          { label: 'Uninvoiced value',  value: fmtMoney(grandTotal) },
          { label: 'Clients',           value: clientGroups.filter(c => c.clientId !== '__none__').length },
          { label: 'Projects',          value: clientGroups.reduce((s, c) => s + c.projects.length, 0) },
        ].map(({ label, value }) => (
          <div key={label} className={cn('tc-card px-4 py-4 text-center', label === 'Uninvoiced value' && grandTotal > 0 ? 'border-primary/40' : '')}>
            <p className={cn('text-xl font-bold tabular-nums', label === 'Uninvoiced value' && grandTotal > 0 ? 'text-primary' : '')}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Client groups */}
      <div className="tc-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Ready to invoice</p>
          {uninvoiced.length > 0 && (
            <button onClick={handleExport} className="tc-btn-secondary gap-1.5 text-xs px-3 py-1.5 print:hidden">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          )}
        </div>

        {uninvoiced.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <p className="font-medium text-sm">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">No uninvoiced billable time for this period.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {clientGroups.map((cg) => (
              <div key={cg.clientId}>
                {/* Client header */}
                <div className="flex items-center justify-between bg-muted/40 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 shrink-0">
                      <span className="text-[11px] font-bold text-primary">
                        {cg.clientName.slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{cg.clientName}</p>
                    <span className="text-xs text-muted-foreground">
                      {cg.projects.length} project{cg.projects.length !== 1 ? 's' : ''}
                      {' · '}{fmtMins(cg.totalMins)}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-primary tabular-nums">{fmtMoney(cg.totalValue)}</span>
                </div>

                {/* Projects */}
                {cg.projects.map((pg) => (
                  <div key={pg.projectId} className="border-b border-border/50 last:border-0">
                    {/* Project sub-header */}
                    <div className="flex items-center justify-between pl-9 pr-5 py-2.5 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: pg.projectColor ?? '#94a3b8' }} />
                        <p className="text-xs font-medium">{pg.projectName}</p>
                        <span className="text-xs text-muted-foreground">{pg.entries.length} entr{pg.entries.length !== 1 ? 'ies' : 'y'} · {fmtMins(pg.totalMins)}</span>
                      </div>
                      <span className="text-xs font-semibold text-primary tabular-nums">{fmtMoney(pg.totalValue)}</span>
                    </div>

                    {/* Entries */}
                    <div className="divide-y divide-border/40 max-h-48 overflow-y-auto">
                      {pg.entries.map((e) => (
                        <div key={e.id} className="report-row flex items-center gap-3 pl-12 pr-5 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate text-foreground/80">{e.description || 'No description'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[11px] text-muted-foreground">{fmtDate(e.start_time)}</p>
                              {e.user_name && <p className="text-[11px] text-muted-foreground">· {e.user_name}</p>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs tabular-nums font-medium">{fmtMins(e.duration_minutes ?? 0)}</p>
                            {e.hourly_rate && (
                              <p className="text-[11px] text-muted-foreground tabular-nums">${e.hourly_rate}/hr</p>
                            )}
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-primary shrink-0 w-16 text-right">
                            {billableValue(e) > 0 ? fmtMoney(billableValue(e)) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {grandTotal > 0 && (
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-5 py-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <DollarSign className="h-4 w-4 text-primary" />
              Total uninvoiced
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-primary tabular-nums">{fmtMoney(grandTotal)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{fmtMins(grandMinutes)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
