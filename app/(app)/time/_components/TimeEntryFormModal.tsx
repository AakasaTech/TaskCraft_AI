'use client';

import { useState, useEffect, useTransition } from 'react';
import { X, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createManualEntry, updateTimeEntry } from '../actions';
import type { TimeEntryRich, TimeProject, TimeTask } from '../_types';

function toLocalDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toLocalTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildISO(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi).toISOString();
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: TimeEntryRich;
  projects: TimeProject[];
  tasks: TimeTask[];
}

export function TimeEntryFormModal({ open, onClose, onSuccess, initial, projects, tasks }: Props) {
  const isEdit = !!initial;
  const [isPending, startTransition] = useTransition();

  const todayStr = toLocalDate(new Date().toISOString());

  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState(nowTime);
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [billable, setBillable] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (initial) {
      setDescription(initial.description ?? '');
      setDate(toLocalDate(initial.start_time));
      setStartTime(toLocalTime(initial.start_time));
      setEndTime(initial.end_time ? toLocalTime(initial.end_time) : nowTime());
      setProjectId(initial.project_id ?? '');
      setTaskId(initial.task_id ?? '');
      setBillable(initial.billable);
      setHourlyRate(initial.hourly_rate != null ? String(initial.hourly_rate) : '');
    } else {
      setDescription('');
      setDate(todayStr);
      setStartTime('09:00');
      setEndTime(nowTime());
      setProjectId('');
      setTaskId('');
      setBillable(false);
      setHourlyRate('');
    }
  }, [open]);

  if (!open) return null;

  const startMs = new Date(`${date}T${startTime}`).getTime();
  const endMs   = new Date(`${date}T${endTime}`).getTime();
  const diffMin = Math.round((endMs - startMs) / 60000);
  const durationLabel = diffMin > 0
    ? `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`
    : '—';
  const invalid = endMs <= startMs;

  const filteredTasks = projectId ? tasks.filter((t) => t.project_id === projectId) : tasks;

  function handleSubmit() {
    if (invalid) { setError('End time must be after start time.'); return; }
    setError('');
    startTransition(async () => {
      try {
        const startISO = buildISO(date, startTime);
        const endISO   = buildISO(date, endTime);
        if (isEdit) {
          await updateTimeEntry(initial!.id, {
            description: description || undefined,
            task_id: taskId || null,
            project_id: projectId || null,
            start_time: startISO,
            end_time: endISO,
            billable,
            hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
          });
        } else {
          await createManualEntry({
            description: description || undefined,
            task_id: taskId || undefined,
            project_id: projectId || undefined,
            start_time: startISO,
            end_time: endISO,
            billable,
            hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
          });
        }
        onSuccess();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit Time Entry' : 'Manual Time Entry'}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Date */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={cn(
                  'h-9 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30',
                  invalid ? 'border-red-400' : 'border-border',
                )}
              />
            </div>
          </div>

          <p className={cn('text-xs', invalid ? 'text-red-500' : 'text-muted-foreground')}>
            Duration: {invalid ? 'End must be after start' : durationLabel}
          </p>

          {/* Project + Task */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Project</label>
              <Select value={projectId} onValueChange={(v) => { setProjectId(v); setTaskId(''); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Task</label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="No task" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No task</SelectItem>
                  {filteredTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Billable + rate */}
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm font-medium">Billable</span>
            </label>
            {billable && (
              <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-border bg-background px-3">
                <DollarSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Rate / hr"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="h-9 w-full bg-transparent text-sm outline-none"
                />
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="tc-btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending || invalid} className="tc-btn-primary">
            {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
