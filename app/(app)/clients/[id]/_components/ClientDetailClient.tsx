'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, Pencil, Building2, Mail, Phone, Globe, MapPin,
  FileText, Clock, CheckSquare, FolderOpen, Receipt,
  CircleDot, BadgeCheck, AlertCircle, Timer,
} from 'lucide-react';
import { ClientFormModal } from '../../_components/ClientFormModal';
import type { Client, InvoiceSyncStatus, TaskStatus, TaskPriority } from '@/lib/types';

type Tab = 'overview' | 'projects' | 'tasks' | 'time' | 'invoices';

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  active:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  on_hold:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  completed:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  archived:    'bg-muted text-muted-foreground',
};

const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  backlog:     'text-muted-foreground',
  todo:        'text-muted-foreground',
  in_progress: 'text-blue-500',
  in_review:   'text-yellow-500',
  done:        'text-green-500',
};

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low:    'text-green-500',
  medium: 'text-yellow-500',
  high:   'text-orange-500',
  urgent: 'text-red-500',
};

const INVOICE_STATUS: Record<InvoiceSyncStatus, { label: string; className: string }> = {
  pending: { label: 'Pending',  className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  synced:  { label: 'Synced',   className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  failed:  { label: 'Failed',   className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDuration(minutes: number | null) {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ClientDetailClient({ client, projects, tasks, timeEntries, invoices }: {
  client:      Client;
  projects:    any[];
  tasks:       any[];
  timeEntries: any[];
  invoices:    any[];
}) {
  const router = useRouter();
  const [tab,        setTab]        = useState<Tab>('overview');
  const [editModal,  setEditModal]  = useState(false);

  const totalHours   = timeEntries.reduce((s: number, e: any) => s + (e.duration_minutes ?? 0) / 60, 0);
  const billableHrs  = timeEntries
    .filter((e: any) => e.billable)
    .reduce((s: number, e: any) => s + (e.duration_minutes ?? 0) / 60, 0);

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview',  label: 'Overview' },
    { key: 'projects',  label: 'Projects',  count: projects.length },
    { key: 'tasks',     label: 'Tasks',     count: tasks.length },
    { key: 'time',      label: 'Time',      count: timeEntries.length },
    { key: 'invoices',  label: 'Invoices',  count: invoices.length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/clients"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Clients
          </Link>
        </div>
        <button onClick={() => setEditModal(true)} className="tc-btn-secondary gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      </div>

      {/* Hero */}
      <div className="tc-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-xl uppercase">
            {client.name.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{client.name}</h1>
            {client.company && <p className="text-sm text-muted-foreground">{client.company}</p>}
          </div>
          {/* Quick stats */}
          <div className="hidden sm:flex items-center gap-6 text-center">
            <div>
              <p className="text-2xl font-bold">{projects.length}</p>
              <p className="text-xs text-muted-foreground">Projects</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{tasks.length}</p>
              <p className="text-xs text-muted-foreground">Open tasks</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{billableHrs.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">Billable</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="tc-card p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</p>
            {client.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
              </div>
            )}
            {client.billing_email && client.billing_email !== client.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${client.billing_email}`} className="hover:underline text-muted-foreground">{client.billing_email}</a>
                <span className="text-xs text-muted-foreground">(billing)</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`tel:${client.phone}`} className="hover:underline">{client.phone}</a>
              </div>
            )}
            {client.website && (
              <div className="flex items-center gap-2.5 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={client.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{client.website}</a>
              </div>
            )}
            {!client.email && !client.phone && !client.website && (
              <p className="text-xs text-muted-foreground">No contact info.</p>
            )}
          </div>

          <div className="tc-card p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing</p>
            {client.default_hourly_rate != null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Default rate</span>
                <span className="font-semibold">{client.currency} {client.default_hourly_rate}/hr</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Currency</span>
              <span className="font-semibold">{client.currency}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total hours</span>
              <span className="font-semibold">{totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Billable hours</span>
              <span className="font-semibold text-primary">{billableHrs.toFixed(1)}h</span>
            </div>
          </div>

          {/* Address */}
          {(client.address?.line1 || client.address?.city || client.address?.country) && (
            <div className="tc-card p-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</p>
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  {client.address?.line1   && <p>{client.address.line1}</p>}
                  {(client.address?.city || client.address?.state || client.address?.zip) && (
                    <p>{[client.address?.city, client.address?.state, client.address?.zip].filter(Boolean).join(', ')}</p>
                  )}
                  {client.address?.country && <p>{client.address.country}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="tc-card p-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
              <div className="flex items-start gap-2.5 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="whitespace-pre-wrap text-muted-foreground">{client.notes}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Projects ── */}
      {tab === 'projects' && (
        <div className="space-y-3">
          {projects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No projects linked to this client.</p>
              <Link href="/projects" className="mt-3 text-xs text-primary hover:underline">Go to Projects →</Link>
            </div>
          )}
          {projects.map((p: any) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="tc-card flex items-center gap-4 p-4 hover:border-primary/40 transition-colors"
            >
              <div className="h-3 w-3 rounded-full shrink-0" style={{ background: p.color }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{p.name}</p>
                {p.due_date && <p className="text-xs text-muted-foreground">Due {fmtDate(p.due_date)}</p>}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-muted text-muted-foreground'}`}>
                {p.status?.replace('_', ' ')}
              </span>
              {p.billable && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Billable</span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* ── Tasks ── */}
      {tab === 'tasks' && (
        <div className="space-y-2">
          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No open tasks for this client.</p>
            </div>
          )}
          {tasks.map((t: any) => {
            const proj = Array.isArray(t.projects) ? t.projects[0] : t.projects;
            return (
              <div key={t.id} className="tc-card flex items-center gap-3 p-4">
                <CircleDot className={`h-4 w-4 shrink-0 ${TASK_STATUS_COLOR[t.status as TaskStatus] ?? ''}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  {proj && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-2 w-2 rounded-full" style={{ background: proj.color }} />
                      <p className="text-xs text-muted-foreground">{proj.name}</p>
                    </div>
                  )}
                </div>
                <span className={`text-xs font-medium ${PRIORITY_COLOR[t.priority as TaskPriority] ?? ''}`}>
                  {t.priority}
                </span>
                {t.due_date && (
                  <span className="text-xs text-muted-foreground">{fmtDate(t.due_date)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Time ── */}
      {tab === 'time' && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total hours',    value: `${totalHours.toFixed(1)}h` },
              { label: 'Billable hours', value: `${billableHrs.toFixed(1)}h` },
              { label: 'Entries',        value: String(timeEntries.length) },
            ].map(({ label, value }) => (
              <div key={label} className="tc-card p-4 text-center">
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {timeEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Timer className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No time entries for this client.</p>
            </div>
          )}

          {timeEntries.map((e: any) => {
            const proj = Array.isArray(e.projects) ? e.projects[0] : e.projects;
            return (
              <div key={e.id} className="tc-card flex items-center gap-3 p-4">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.description || 'No description'}</p>
                  {proj && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-2 w-2 rounded-full" style={{ background: proj.color }} />
                      <p className="text-xs text-muted-foreground">{proj.name}</p>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{fmtDuration(e.duration_minutes)}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(e.start_time)}</p>
                </div>
                {e.billable && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                    Billable
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Invoices ── */}
      {tab === 'invoices' && (
        <div className="space-y-3">
          {invoices.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Receipt className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No invoices synced for this client.</p>
              <p className="text-xs text-muted-foreground mt-1">Invoices synced from BillCraft AI will appear here.</p>
            </div>
          )}
          {invoices.map((inv: any) => {
            const s = INVOICE_STATUS[inv.status as InvoiceSyncStatus];
            return (
              <div key={inv.id} className="tc-card flex items-center gap-4 p-4">
                <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Invoice #{inv.billcraft_invoice_id}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(inv.created_at)}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  {inv.total_amount != null && (
                    <p className="text-sm font-semibold">{inv.currency} {Number(inv.total_amount).toFixed(2)}</p>
                  )}
                  {inv.total_hours != null && (
                    <p className="text-xs text-muted-foreground">{Number(inv.total_hours).toFixed(1)}h</p>
                  )}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${s?.className ?? ''}`}>
                  {s?.label ?? inv.status}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <ClientFormModal
        open={editModal}
        onClose={() => setEditModal(false)}
        onSuccess={() => { setEditModal(false); router.refresh(); }}
        initial={client}
      />
    </div>
  );
}
