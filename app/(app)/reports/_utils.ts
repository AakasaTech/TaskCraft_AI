import type { ReportTimeEntry, ReportTask, ReportProject, FilterState } from './_types';

export function fmtMins(mins: number): string {
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function fmtHours(mins: number): string {
  return `${(mins / 60).toFixed(1)}h`;
}

export function fmtMoney(n: number): string {
  if (n === 0) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86_400_000));
}

export function billableValue(e: ReportTimeEntry): number {
  return e.billable && e.hourly_rate && e.duration_minutes
    ? (e.duration_minutes / 60) * e.hourly_rate
    : 0;
}

export function applyEntryFilters(entries: ReportTimeEntry[], f: FilterState): ReportTimeEntry[] {
  return entries.filter((e) => {
    if (f.dateFrom && e.start_time < f.dateFrom) return false;
    if (f.dateTo   && e.start_time > f.dateTo + 'T23:59:59') return false;
    if (f.clientId  && e.client_id  !== f.clientId)  return false;
    if (f.projectId && e.project_id !== f.projectId) return false;
    if (f.userId    && e.user_id    !== f.userId)     return false;
    if (f.billable === 'billable'     && !e.billable) return false;
    if (f.billable === 'non-billable' &&  e.billable) return false;
    return true;
  });
}

export function applyTaskFilters(tasks: ReportTask[], f: FilterState): ReportTask[] {
  return tasks.filter((t) => {
    if (f.projectId && t.project_id  !== f.projectId) return false;
    if (f.userId    && t.assignee_id !== f.userId)    return false;
    if (f.status    && t.status      !== f.status)    return false;
    return true;
  });
}

export function applyProjectFilters(projects: ReportProject[], f: FilterState): ReportProject[] {
  return projects.filter((p) => {
    if (f.projectId && p.id        !== f.projectId) return false;
    if (f.clientId  && p.client_id !== f.clientId)  return false;
    if (f.status    && p.status    !== f.status)    return false;
    return true;
  });
}

export function generateCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

export function downloadCSV(csv: string, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${name}-${new Date().toLocaleDateString('en-CA')}.csv`;
  a.click();
}

export function getDefaultFilters(): FilterState {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo:   to.toISOString().slice(0, 10),
    clientId: '', projectId: '', userId: '', status: '', billable: 'all',
  };
}

export function presetRange(preset: string): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const to    = today.toISOString().slice(0, 10);
  const ago   = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const startOf = (unit: 'week' | 'month' | 'year') => {
    const d = new Date(today);
    if (unit === 'week') { const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); }
    if (unit === 'month') d.setDate(1);
    if (unit === 'year')  { d.setMonth(0); d.setDate(1); }
    return d.toISOString().slice(0, 10);
  };
  switch (preset) {
    case '7d':    return { dateFrom: ago(7),  dateTo: to };
    case '30d':   return { dateFrom: ago(30), dateTo: to };
    case '90d':   return { dateFrom: ago(90), dateTo: to };
    case 'week':  return { dateFrom: startOf('week'),  dateTo: to };
    case 'month': return { dateFrom: startOf('month'), dateTo: to };
    case 'year':  return { dateFrom: startOf('year'),  dateTo: to };
    case 'all':   return { dateFrom: '',               dateTo: '' };
    default:      return { dateFrom: ago(30),          dateTo: to };
  }
}
