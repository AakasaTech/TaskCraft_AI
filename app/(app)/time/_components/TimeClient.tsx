'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimerWidget } from './TimerWidget';
import { TimeEntryFormModal } from './TimeEntryFormModal';
import { DailyTimesheet, fmtMins } from './DailyTimesheet';
import { WeeklyTimesheet } from './WeeklyTimesheet';
import type { TimeEntryRich, RunningTimer, TimeProject, TimeTask } from '../_types';

type Tab = 'daily' | 'weekly';

interface Props {
  entries: TimeEntryRich[];
  running: RunningTimer | null;
  projects: TimeProject[];
  tasks: TimeTask[];
}

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear()
    && d.getMonth() === n.getMonth()
    && d.getDate() === n.getDate();
}

export function TimeClient({ entries: initial, running, projects, tasks }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState(initial);
  const [tab, setTab]         = useState<Tab>('daily');
  const [modalOpen, setModal] = useState(false);
  const [editEntry, setEdit]  = useState<TimeEntryRich | undefined>();

  // Sync after server revalidation
  if (initial !== entries) setEntries(initial);

  const todayEntries = entries.filter((e) => isToday(e.start_time) && e.end_time !== null);
  const totalMins    = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const billableMins = entries.filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const billableValue = entries.reduce((s, e) =>
    s + (e.billable && e.hourly_rate ? (e.duration_minutes ?? 0) / 60 * e.hourly_rate : 0), 0);

  function openEdit(e: TimeEntryRich) { setEdit(e); setModal(true); }
  function handleDeleted(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }
  function handleSuccess() {
    setModal(false);
    setEdit(undefined);
    router.refresh();
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'daily',  label: 'Day' },
    { id: 'weekly', label: 'Week' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Timer card */}
      <div className="tc-card">
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Timer</p>
              <p className="text-xs text-muted-foreground">
                {running ? 'Timer is running' : 'Start tracking time'}
              </p>
            </div>
          </div>
          <div className="flex-1">
            <TimerWidget
              running={running}
              projects={projects}
              tasks={tasks}
              onStopped={() => router.refresh()}
              onStarted={() => router.refresh()}
            />
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Logged (30 days)', value: totalMins > 0 ? fmtMins(totalMins) : '—' },
          { label: 'Billable',         value: billableMins > 0 ? fmtMins(billableMins) : '—' },
          { label: 'Billable value',   value: billableValue > 0 ? `$${billableValue.toFixed(2)}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="tc-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* View tabs + add button */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
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
        <div className="ml-auto">
          <button
            onClick={() => { setEdit(undefined); setModal(true); }}
            className="tc-btn-secondary gap-1.5 px-3 py-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Manual entry
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'daily' ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <DailyTimesheet entries={todayEntries} onEdit={openEdit} onDeleted={handleDeleted} />
        </div>
      ) : (
        <WeeklyTimesheet entries={entries} onEdit={openEdit} onDeleted={handleDeleted} />
      )}

      {/* Modal */}
      <TimeEntryFormModal
        open={modalOpen}
        onClose={() => { setModal(false); setEdit(undefined); }}
        onSuccess={handleSuccess}
        initial={editEntry}
        projects={projects}
        tasks={tasks}
      />
    </div>
  );
}
