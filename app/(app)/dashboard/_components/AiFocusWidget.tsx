'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface FocusTask {
  title: string;
  reason: string;
  priority: 'high' | 'urgent' | 'medium' | 'low';
}

interface AiFocusWidgetProps {
  initial: FocusTask[];
}

const PRIORITY_COLOR: Record<FocusTask['priority'], string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  medium: 'bg-sky-400',
  low:    'bg-slate-400',
};

export function AiFocusWidget({ initial }: AiFocusWidgetProps) {
  const [tasks, setTasks] = useState<FocusTask[]>(initial);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/focus-plan', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json() as { focus: FocusTask[] };
      setTasks(data.focus);
    } catch {
      toast.error('Could not refresh AI suggestions.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tc-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">AI Focus List</h2>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          title="Refresh AI suggestions"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Generating suggestions…
        </div>
      ) : tasks.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Add tasks and the AI will suggest what to focus on today.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {tasks.map((task, i) => (
            <li key={i} className="flex items-start gap-3 px-5 py-3">
              <span className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', PRIORITY_COLOR[task.priority])}
                  />
                  <span className="truncate text-sm font-medium">{task.title}</span>
                </div>
                {task.reason && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{task.reason}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
