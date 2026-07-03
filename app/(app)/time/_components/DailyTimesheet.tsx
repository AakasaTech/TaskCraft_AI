'use client';

import { useTransition } from 'react';
import { MoreHorizontal, Pencil, Trash2, DollarSign } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteTimeEntry } from '../actions';
import type { TimeEntryRich } from '../_types';

export function fmtMins(mins: number | null): string {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

interface Props {
  entries: TimeEntryRich[];
  onEdit: (entry: TimeEntryRich) => void;
  onDeleted: (id: string) => void;
}

export function DailyTimesheet({ entries, onEdit, onDeleted }: Props) {
  const [, startTransition] = useTransition();

  const totalMins    = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const billableMins = entries.filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTimeEntry(id);
      onDeleted(id);
    });
  }

  if (entries.length === 0) {
    return (
      <div className="tc-card py-10 text-center">
        <p className="text-sm text-muted-foreground">No time entries for this day.</p>
        <p className="mt-1 text-xs text-muted-foreground">Start the timer above or add a manual entry.</p>
      </div>
    );
  }

  return (
    <div className="tc-card divide-y divide-border overflow-hidden">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 px-5 py-3.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: entry.project_color ?? '#e2e8f0' }}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {entry.description || entry.task_title || (
                <span className="italic text-muted-foreground">No description</span>
              )}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {entry.project_name && <span>{entry.project_name}</span>}
              {entry.project_name && entry.task_title && <span>·</span>}
              {entry.task_title && entry.description && <span>{entry.task_title}</span>}
              <span>·</span>
              <span>
                {fmtTime(entry.start_time)}
                {entry.end_time ? ` – ${fmtTime(entry.end_time)}` : ''}
              </span>
            </div>
          </div>

          {entry.billable && (
            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 sm:flex">
              <DollarSign className="h-2.5 w-2.5" />
              Billable
            </span>
          )}

          <p className="shrink-0 font-mono text-sm font-semibold tabular-nums">
            {fmtMins(entry.duration_minutes)}
          </p>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(entry)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDelete(entry.id)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      {/* Daily total footer */}
      <div className="flex items-center justify-between bg-muted/30 px-5 py-3">
        <span className="text-xs text-muted-foreground">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          {billableMins > 0 && ` · Billable: ${fmtMins(billableMins)}`}
        </span>
        <span className="font-mono text-sm font-bold">{fmtMins(totalMins)}</span>
      </div>
    </div>
  );
}
