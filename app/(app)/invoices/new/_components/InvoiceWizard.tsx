'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, ChevronLeft, Loader2, CheckCircle2,
  ExternalLink, FileText, Clock, DollarSign, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getBillCraftClients,
  fetchUnbilledEntries,
  createInvoice,
  type CreateInvoiceInput,
  type InvoiceGrouping,
} from '@/app/(app)/invoices/actions';
import type { BillCraftClient } from '@/lib/billcraft';
import type { Project, TimeEntryWithRelations } from '@/lib/types';

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Bill To',      icon: Users },
  { id: 2, label: 'Scope',        icon: FileText },
  { id: 3, label: 'Review',       icon: Clock },
  { id: 4, label: 'Details',      icon: DollarSign },
  { id: 5, label: 'Confirm',      icon: CheckCircle2 },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface WizardProps {
  projects:    Project[];
  currency:    string;
  hourlyRate:  number;
}

interface WizardState {
  // Step 1
  bcClient:     BillCraftClient | null;
  // Step 2
  projectId:    string;
  dateFrom:     string;
  dateTo:       string;
  // Step 3 — loaded after step 2
  entries:      TimeEntryWithRelations[];
  selectedIds:  Set<string>;
  totalHours:   number;
  totalAmount:  number;
  // Step 4
  title:        string;
  notes:        string;
  dueDate:      string;
  grouping:     InvoiceGrouping;
}

// ── Wizard stepper ────────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const done    = current > step.id;
        const active  = current === step.id;
        return (
          <li key={step.id} className="flex items-center">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
              done   && 'bg-primary text-primary-foreground',
              active && 'bg-primary/10 text-primary ring-2 ring-primary ring-offset-2',
              !done && !active && 'bg-muted text-muted-foreground',
            )}>
              {done ? <CheckCircle2 className="h-4 w-4" /> : step.id}
            </div>
            {!active && done && <span className="ml-2 text-xs font-medium text-muted-foreground hidden sm:inline">{step.label}</span>}
            {active && <span className="ml-2 text-xs font-semibold text-foreground hidden sm:inline">{step.label}</span>}
            {idx < STEPS.length - 1 && (
              <ChevronRight className="mx-2 h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Step 1: Select BillCraft client ───────────────────────────────────────────

function Step1Client({
  selected,
  onSelect,
}: {
  selected: BillCraftClient | null;
  onSelect: (c: BillCraftClient) => void;
}) {
  const [clients, setClients]   = useState<BillCraftClient[] | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  if (!clients && !loading) {
    startLoading(async () => {
      const res = await getBillCraftClients();
      if (res.error) { setError(res.error); }
      else { setClients(res.data!.clients); }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Who should this invoice be billed to?</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(clients ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={cn(
              'text-left rounded-xl border p-4 transition-all',
              selected?.id === c.id
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border hover:border-primary/40 hover:bg-muted/40',
            )}
          >
            <p className="text-sm font-semibold">{c.name}</p>
            {c.company && c.company !== c.name && (
              <p className="text-xs text-muted-foreground mt-0.5">{c.company}</p>
            )}
            {c.email && (
              <p className="text-[11px] text-muted-foreground mt-1">{c.email}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Project + date range ──────────────────────────────────────────────

function Step2Scope({
  projects,
  projectId,
  dateFrom,
  dateTo,
  onChange,
}: {
  projects:  Project[];
  projectId: string;
  dateFrom:  string;
  dateTo:    string;
  onChange:  (updates: Partial<Pick<WizardState, 'projectId' | 'dateFrom' | 'dateTo'>>) => void;
}) {
  const inputCls = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Choose the project and date range to invoice.</p>

      <div className="space-y-1.5">
        <Label>Project (optional)</Label>
        <select
          className={inputCls}
          value={projectId}
          onChange={(e) => onChange({ projectId: e.target.value })}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">Leave blank to include all billable time regardless of project.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="date-from">From</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date-to">To</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Review entries ────────────────────────────────────────────────────

function Step3Review({
  entries,
  selectedIds,
  totalHours,
  totalAmount,
  currency,
  onToggle,
  onToggleAll,
}: {
  entries:     TimeEntryWithRelations[];
  selectedIds: Set<string>;
  totalHours:  number;
  totalAmount: number;
  currency:    string;
  onToggle:    (id: string) => void;
  onToggleAll: (ids: string[]) => void;
}) {
  const allSelected = entries.length > 0 && entries.every((e) => selectedIds.has(e.id));
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency });

  const selectedHours  = entries.filter((e) => selectedIds.has(e.id)).reduce((s, e) => s + (e.duration_minutes ?? 0) / 60, 0);
  const selectedAmount = entries.filter((e) => selectedIds.has(e.id)).reduce((s, e) => {
    const hrs  = (e.duration_minutes ?? 0) / 60;
    const rate = e.hourly_rate ?? 0;
    return s + hrs * rate;
  }, 0);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 py-12 text-center">
        <Clock className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium">No unbilled entries found</p>
        <p className="mt-1 text-xs text-muted-foreground">Try a different date range or project.</p>
      </div>
    );
  }

  function formatDuration(minutes: number | null) {
    const m = minutes ?? 0;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? `${h}h ${r}m` : `${h}h`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {entries.length} billable entr{entries.length === 1 ? 'y' : 'ies'} found
        </p>
        <div className="text-right">
          <p className="text-sm font-semibold">{selectedIds.size} selected · {selectedHours.toFixed(2)} h · {fmt.format(selectedAmount)}</p>
        </div>
      </div>

      <div className="tc-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleAll(entries.map((e) => e.id))}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Description</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Project</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Duration</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Rate</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {entries.map((e) => {
              const hrs    = (e.duration_minutes ?? 0) / 60;
              const rate   = e.hourly_rate ?? 0;
              const amount = hrs * rate;
              return (
                <tr
                  key={e.id}
                  className={cn('hover:bg-muted/20 transition-colors cursor-pointer', !selectedIds.has(e.id) && 'opacity-50')}
                  onClick={() => onToggle(e.id)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(e.id)}
                      onChange={() => onToggle(e.id)}
                      onClick={(ev) => ev.stopPropagation()}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 max-w-[200px]">
                    <p className="truncate text-xs font-medium">{e.task?.title ?? e.description ?? 'Time entry'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(e.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {e.project ? (
                      <span className="flex items-center gap-1 text-[11px]">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: e.project.color }} />
                        {e.project.name}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{formatDuration(e.duration_minutes)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">{fmt.format(rate)}/h</td>
                  <td className="px-3 py-2 text-right text-xs font-medium tabular-nums">{fmt.format(amount)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30">
              <td colSpan={3} className="px-3 py-2 text-xs font-semibold">Selected total</td>
              <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{selectedHours.toFixed(2)} h</td>
              <td />
              <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{fmt.format(selectedAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Step 4: Invoice details ───────────────────────────────────────────────────

function Step4Details({
  title,
  notes,
  dueDate,
  grouping,
  currency,
  onChange,
}: {
  title:    string;
  notes:    string;
  dueDate:  string;
  grouping: InvoiceGrouping;
  currency: string;
  onChange: (updates: Partial<Pick<WizardState, 'title' | 'notes' | 'dueDate' | 'grouping'>>) => void;
}) {
  const inputCls = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="inv-title">Invoice Title</Label>
        <Input
          id="inv-title"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Development Services – June 2026"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inv-due">Due Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          id="inv-due"
          type="date"
          value={dueDate}
          onChange={(e) => onChange({ dueDate: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Line Item Grouping</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            { value: 'by_task', label: 'Group by Task',  desc: 'One line item per task, hours summed.' },
            { value: 'flat',    label: 'Flat (per entry)',desc: 'Each time entry becomes its own line.' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ grouping: opt.value })}
              className={cn(
                'text-left rounded-xl border p-3 transition-all',
                grouping === opt.value
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/30',
              )}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inv-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <textarea
          id="inv-notes"
          rows={3}
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Payment terms, bank details, or any other note to include on the invoice…"
          className={inputCls + ' resize-none'}
        />
      </div>
    </div>
  );
}

// ── Step 5: Confirm & send ────────────────────────────────────────────────────

function Step5Confirm({
  state,
  currency,
  lineItems,
}: {
  state:     WizardState;
  currency:  string;
  lineItems: Array<{ description: string; quantity: number; rate: number; amount: number }>;
}) {
  const fmt    = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  const total  = lineItems.reduce((s, li) => s + li.amount, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold">{state.title || 'Untitled Invoice'}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Billing: <span className="text-foreground font-medium">{state.bcClient?.name}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{fmt.format(total)}</p>
            <p className="text-xs text-muted-foreground">{lineItems.reduce((s, li) => s + li.quantity, 0).toFixed(2)} hours</p>
          </div>
        </div>

        {state.dueDate && (
          <p className="text-xs text-muted-foreground">
            Due: {new Date(state.dueDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      <div className="tc-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Description</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Qty (h)</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Rate</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {lineItems.map((li, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5 text-sm">{li.description}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{li.quantity.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums text-muted-foreground">{fmt.format(li.rate)}/h</td>
                <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums">{fmt.format(li.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30">
              <td colSpan={3} className="px-4 py-2.5 text-sm font-bold">Total</td>
              <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums">{fmt.format(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {state.notes && (
        <div className="rounded-xl bg-muted/40 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{state.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({
  invoiceNumber,
  invoiceUrl,
  onViewHistory,
}: {
  invoiceNumber: string;
  invoiceUrl:    string | undefined;
  onViewHistory: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-8 w-8 text-primary" />
      </div>
      <div>
        <p className="text-lg font-semibold">Invoice created!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Invoice <span className="font-medium">{invoiceNumber}</span> was sent to BillCraft AI.
          Time entries have been marked as invoiced.
        </p>
      </div>
      <div className="flex gap-2">
        {invoiceUrl && (
          <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              View in BillCraft
            </Button>
          </a>
        )}
        <Button size="sm" onClick={onViewHistory}>
          View Invoice History
        </Button>
      </div>
    </div>
  );
}

// ── Preview line items (computed client-side for step 5) ─────────────────────

function previewLineItems(
  entries:     TimeEntryWithRelations[],
  selectedIds: Set<string>,
  grouping:    InvoiceGrouping,
  defaultRate: number,
) {
  const selected = entries.filter((e) => selectedIds.has(e.id));

  if (grouping === 'flat') {
    return selected.map((e) => {
      const hrs  = (e.duration_minutes ?? 0) / 60;
      const rate = e.hourly_rate ?? defaultRate;
      return { description: e.task?.title ?? e.description ?? 'Time entry', quantity: hrs, rate, amount: hrs * rate };
    });
  }

  const grouped = new Map<string, { description: string; hours: number; rate: number }>();
  for (const e of selected) {
    const key  = e.task_id ?? `d:${e.description ?? 'misc'}`;
    const desc = e.task?.title ?? e.description ?? 'Miscellaneous';
    const hrs  = (e.duration_minutes ?? 0) / 60;
    const rate = e.hourly_rate ?? defaultRate;
    const cur  = grouped.get(key);
    if (cur) { cur.hours += hrs; }
    else { grouped.set(key, { description: desc, hours: hrs, rate }); }
  }

  return Array.from(grouped.values()).map(({ description, hours, rate }) => ({
    description,
    quantity: hours,
    rate,
    amount: hours * rate,
  }));
}

// ── Main wizard component ─────────────────────────────────────────────────────

export function InvoiceWizard({ projects, currency, hourlyRate }: WizardProps) {
  const router = useRouter();

  const today      = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';

  const [step, setStep] = useState(1);
  const [done, setDone] = useState<{ invoiceNumber: string; invoiceUrl?: string } | null>(null);

  const [state, setState] = useState<WizardState>({
    bcClient:    null,
    projectId:   '',
    dateFrom:    monthStart,
    dateTo:      today,
    entries:     [],
    selectedIds: new Set<string>(),
    totalHours:  0,
    totalAmount: 0,
    title:       '',
    notes:       '',
    dueDate:     '',
    grouping:    'by_task',
  });

  const [isFetching, startFetch]     = useTransition();
  const [isSubmitting, startSubmit]  = useTransition();

  function update(updates: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...updates }));
  }

  // Advance to step 3 — load entries
  function goToReview() {
    startFetch(async () => {
      const res = await fetchUnbilledEntries({
        projectId: state.projectId || null,
        dateFrom:  state.dateFrom,
        dateTo:    state.dateTo,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const ids = new Set((res.data!.entries).map((e) => e.id));
      update({
        entries:     res.data!.entries,
        selectedIds: ids,
        totalHours:  res.data!.totalHours,
        totalAmount: res.data!.totalAmount,
      });
      setStep(3);
    });
  }

  function canAdvance(): boolean {
    if (step === 1) return !!state.bcClient;
    if (step === 2) return !!state.dateFrom && !!state.dateTo;
    if (step === 3) return state.selectedIds.size > 0;
    if (step === 4) return !!state.title.trim();
    return true;
  }

  function handleNext() {
    if (step === 2) { goToReview(); return; }
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function handleToggleEntry(id: string) {
    const next = new Set(state.selectedIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    update({ selectedIds: next });
  }

  function handleToggleAll(ids: string[]) {
    const allSelected = ids.every((id) => state.selectedIds.has(id));
    update({ selectedIds: allSelected ? new Set() : new Set(ids) });
  }

  function handleSubmit() {
    if (!state.bcClient) return;

    const input: CreateInvoiceInput = {
      billcraft_client_id:   state.bcClient.id,
      billcraft_client_name: state.bcClient.name,
      project_id:            state.projectId || null,
      date_from:             state.dateFrom,
      date_to:               state.dateTo,
      entry_ids:             Array.from(state.selectedIds),
      title:                 state.title,
      notes:                 state.notes,
      due_date:              state.dueDate || null,
      grouping:              state.grouping,
      currency,
      default_rate:          hourlyRate,
    };

    startSubmit(async () => {
      const res = await createInvoice(input);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setDone({
        invoiceNumber: res.data!.invoice.number,
        invoiceUrl:    res.data!.invoice.url,
      });
    });
  }

  if (done) {
    return (
      <SuccessScreen
        invoiceNumber={done.invoiceNumber}
        invoiceUrl={done.invoiceUrl}
        onViewHistory={() => router.push('/invoices')}
      />
    );
  }

  const lineItems = step >= 5
    ? previewLineItems(state.entries, state.selectedIds, state.grouping, hourlyRate)
    : [];

  return (
    <div className="space-y-6">
      <Stepper current={step} />

      <div className="min-h-[300px]">
        {step === 1 && (
          <Step1Client
            selected={state.bcClient}
            onSelect={(c) => update({ bcClient: c })}
          />
        )}
        {step === 2 && (
          <Step2Scope
            projects={projects}
            projectId={state.projectId}
            dateFrom={state.dateFrom}
            dateTo={state.dateTo}
            onChange={(u) => update(u)}
          />
        )}
        {step === 3 && (
          isFetching ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Step3Review
              entries={state.entries}
              selectedIds={state.selectedIds}
              totalHours={state.totalHours}
              totalAmount={state.totalAmount}
              currency={currency}
              onToggle={handleToggleEntry}
              onToggleAll={handleToggleAll}
            />
          )
        )}
        {step === 4 && (
          <Step4Details
            title={state.title}
            notes={state.notes}
            dueDate={state.dueDate}
            grouping={state.grouping}
            currency={currency}
            onChange={(u) => update(u)}
          />
        )}
        {step === 5 && (
          <Step5Confirm
            state={state}
            currency={currency}
            lineItems={lineItems}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          disabled={step === 1}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        {step < 5 ? (
          <Button
            size="sm"
            onClick={handleNext}
            disabled={!canAdvance() || isFetching}
          >
            {isFetching && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {step === 2 ? 'Load Entries' : 'Next'}
            {!isFetching && <ChevronRight className="ml-1 h-4 w-4" />}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || lineItems.length === 0}
          >
            {isSubmitting
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</>
              : 'Send to BillCraft'
            }
          </Button>
        )}
      </div>
    </div>
  );
}
