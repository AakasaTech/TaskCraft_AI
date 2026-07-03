'use client';

import { useState, useEffect, useTransition } from 'react';
import { Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { startTimer, stopTimer } from '../actions';
import type { RunningTimer, TimeProject, TimeTask } from '../_types';

function formatElapsed(startTime: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface Props {
  running: RunningTimer | null;
  projects: TimeProject[];
  tasks: TimeTask[];
  onStopped?: () => void;
  onStarted?: () => void;
}

export function TimerWidget({ running: initialRunning, projects, tasks, onStopped, onStarted }: Props) {
  const [running, setRunning] = useState(initialRunning);
  const [elapsed, setElapsed] = useState(initialRunning ? formatElapsed(initialRunning.start_time) : '00:00:00');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [billable, setBillable] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { setRunning(initialRunning); }, [initialRunning]);

  useEffect(() => {
    if (!running) { setElapsed('00:00:00'); return; }
    setElapsed(formatElapsed(running.start_time));
    const id = setInterval(() => setElapsed(formatElapsed(running.start_time)), 1000);
    return () => clearInterval(id);
  }, [running]);

  const filteredTasks = projectId ? tasks.filter((t) => t.project_id === projectId) : tasks;

  function handleStart() {
    startTransition(async () => {
      const selectedTask = tasks.find((t) => t.id === taskId);
      const pid = projectId || selectedTask?.project_id || undefined;
      const proj = projects.find((p) => p.id === pid);
      const data = await startTimer({
        description: description || undefined,
        task_id: taskId || undefined,
        project_id: pid,
        billable,
        hourly_rate: (billable && proj?.hourly_rate) ? proj.hourly_rate : undefined,
      });
      setRunning({
        id: data.id,
        start_time: data.start_time,
        description: description || null,
        task_id: taskId || null,
        task_title: selectedTask?.title ?? null,
        project_id: pid ?? null,
        project_name: proj?.name ?? null,
        project_color: proj?.color ?? null,
        billable,
        hourly_rate: proj?.hourly_rate ?? null,
      });
      setDescription('');
      setProjectId('');
      setTaskId('');
      setBillable(false);
      onStarted?.();
    });
  }

  function handleStop() {
    if (!running) return;
    startTransition(async () => {
      await stopTimer(running.id);
      setRunning(null);
      onStopped?.();
    });
  }

  if (running) {
    return (
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          {running.project_name && (
            <div className="mb-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: running.project_color ?? '#6366f1' }} />
              <p className="text-xs text-muted-foreground">{running.project_name}</p>
            </div>
          )}
          <p className="truncate text-sm font-medium">
            {running.description || running.task_title || 'Timer running…'}
          </p>
          {running.billable && (
            <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Billable
            </span>
          )}
        </div>

        <span className="font-mono text-3xl font-bold tabular-nums text-primary">{elapsed}</span>

        <button
          onClick={handleStop}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
        >
          <Square className="h-3.5 w-3.5 fill-white" />
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <input
        type="text"
        placeholder="What are you working on?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !isPending && handleStart()}
        className="h-10 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={projectId} onValueChange={(v) => { setProjectId(v); setTaskId(''); }}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No project</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color ?? '#6366f1' }} />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={taskId} onValueChange={setTaskId}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Task (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No task</SelectItem>
            {filteredTasks.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={() => setBillable((b) => !b)}
          className={cn(
            'flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors',
            billable
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
        >
          ${billable ? ' Billable' : ' Non-billable'}
        </button>

        <button
          onClick={handleStart}
          disabled={isPending}
          className="ml-auto flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5 fill-white" />
          Start
        </button>
      </div>
    </div>
  );
}
