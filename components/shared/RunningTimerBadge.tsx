'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stopTimer } from '@/app/(app)/time/actions';
import type { RunningTimer } from '@/app/(app)/time/_types';

function formatElapsed(startTime: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function RunningTimerBadge({ timer }: { timer: RunningTimer | null }) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(timer ? formatElapsed(timer.start_time) : '00:00:00');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!timer) return;
    setElapsed(formatElapsed(timer.start_time));
    const id = setInterval(() => setElapsed(formatElapsed(timer.start_time)), 1000);
    return () => clearInterval(id);
  }, [timer]);

  if (!timer) return null;

  function handleStop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await stopTimer(timer!.id);
      router.refresh();
    });
  }

  return (
    <a
      href="/time"
      className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
      title={timer.description || timer.task_title || 'Timer running'}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>

      {/* Project color + name */}
      {timer.project_color && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: timer.project_color }} />
      )}
      <span className="hidden max-w-[100px] truncate text-muted-foreground sm:block">
        {timer.project_name ?? timer.description ?? 'Timer'}
      </span>

      {/* Elapsed */}
      <span className={cn('font-mono tabular-nums', isPending && 'opacity-50')}>{elapsed}</span>

      {/* Stop */}
      <button
        onClick={handleStop}
        disabled={isPending}
        className="ml-0.5 rounded-md p-0.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
        aria-label="Stop timer"
      >
        <Square className="h-3 w-3 fill-red-500" />
      </button>
    </a>
  );
}
