'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  FolderPlus, ListPlus, Play, Clock4, UserPlus, Sparkles, X, Loader2
} from 'lucide-react';
import type { FocusTask } from './AiFocusWidget';

const ACTIONS = [
  { label: 'New Project',         icon: FolderPlus,      href: '/projects',   ai: false },
  { label: 'New Task',            icon: ListPlus,         href: '/tasks',      ai: false },
  { label: 'Start Timer',         icon: Play,             href: '/time',       ai: false },
  { label: 'Add Time Entry',      icon: Clock4,           href: '/time',       ai: false },
  { label: 'Invite Team Member',  icon: UserPlus,         href: '/settings',   ai: false },
  { label: 'AI Task Plan',        icon: Sparkles,         href: null,          ai: true  },
] as const;

interface AiPlan {
  focus: FocusTask[];
  reason: string;
}

export function QuickActionsBar() {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);

  async function generatePlan() {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/focus-plan', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate plan');
      const data: AiPlan = await res.json();
      setAiPlan(data);
    } catch {
      toast.error('Could not generate AI plan. Try again shortly.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <>
      {/* Quick action pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {ACTIONS.map(({ label, icon: Icon, href, ai }) =>
          ai ? (
            <button
              key={label}
              onClick={() => { setAiOpen(true); setAiPlan(null); }}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                AI
              </span>
            </button>
          ) : (
            <Link
              key={label}
              href={href!}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          )
        )}
      </div>

      {/* AI Plan modal/panel */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">AI Task Plan</h2>
                  <p className="text-xs text-muted-foreground">Personalised focus list for today</p>
                </div>
              </div>
              <button
                onClick={() => setAiOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {!aiPlan && !aiLoading && (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Generate a personalised AI focus plan based on your open tasks, deadlines, and priorities.
                  </p>
                  <button
                    onClick={generatePlan}
                    className="tc-btn-primary mt-5 w-full"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate my focus plan
                  </button>
                </div>
              )}

              {aiLoading && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Analysing your tasks and priorities…</p>
                </div>
              )}

              {aiPlan && (
                <div className="space-y-4">
                  {aiPlan.reason && (
                    <p className="rounded-xl bg-primary/5 px-4 py-3 text-xs text-primary">
                      {aiPlan.reason}
                    </p>
                  )}
                  <ul className="space-y-2">
                    {aiPlan.focus.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          {item.reason && (
                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={generatePlan}
                    disabled={aiLoading}
                    className="tc-btn-secondary mt-2 w-full text-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Regenerate plan
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
