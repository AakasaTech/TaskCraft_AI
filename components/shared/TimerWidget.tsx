'use client';
import { useState, useEffect, useCallback } from 'react';
import { Play, Square, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimerWidgetProps {
  taskName?: string;
  onStop?: (seconds: number) => void;
  className?: string;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerWidget({ taskName, onStop, className }: TimerWidgetProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const handleStop = useCallback(() => {
    setRunning(false);
    onStop?.(elapsed);
    setElapsed(0);
  }, [elapsed, onStop]);

  const handleStart = () => {
    setElapsed(0);
    setRunning(true);
  };

  if (!running) {
    return (
      <button
        onClick={handleStart}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
          className,
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        <span>Start timer</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="font-mono text-sm font-bold tabular-nums text-primary">
          {formatTime(elapsed)}
        </span>
      </div>
      {taskName && (
        <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground sm:block">
          {taskName}
        </span>
      )}
      <button
        onClick={handleStop}
        className="rounded-lg p-1 text-muted-foreground hover:text-red-500 transition-colors"
        title="Stop timer"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>
    </div>
  );
}

/* ── Compact version for header bar ───────────────────────── */
export function TimerBadge() {
  return <TimerWidget className="h-8" />;
}
