'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, ListPlus, ListTree, CalendarCheck, Zap,
  BarChart2, FileText, TrendingUp, AlertCircle,
  Users, Gauge, HeartPulse, Shield, ChevronRight,
  Loader2, CheckCircle, AlertTriangle, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createTask } from '@/app/(app)/tasks/actions';
import { updateTask } from '@/app/(app)/tasks/actions';
import { createSubtask } from '@/app/(app)/tasks/actions';
import type { Plan, TaskPriority } from '@/lib/types';
import { AI_LIMITS } from '@/lib/constants';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AITool {
  id:          string;
  name:        string;
  description: string;
  icon:        React.ElementType;
  minPlan:     'free' | 'solo' | 'team';
  category:    'personal' | 'team';
}

interface Props {
  plan:             Plan;
  usageThisMonth:   number;
  projects: Array<{ id: string; name: string; color: string | null }>;
  tasks:    Array<{ id: string; title: string; priority: string; status: string; due_date: string | null; project_id: string | null; project_name: string | null }>;
  members:  Array<{ id: string; full_name: string | null; email: string }>;
}

// ── Tool registry ──────────────────────────────────────────────────────────────

const TOOLS: AITool[] = [
  { id: 'task-generator',        name: 'Task Generator',        description: 'Generate tasks for a project from a goal description.',         icon: ListPlus,      minPlan: 'free', category: 'personal' },
  { id: 'subtask-generator',     name: 'Subtask Generator',     description: 'Break down any task into concrete, actionable subtasks.',       icon: ListTree,      minPlan: 'free', category: 'personal' },
  { id: 'progress-summary',      name: 'Progress Summary',      description: 'Generate a concise summary of a project\'s current progress.', icon: BarChart2,     minPlan: 'free', category: 'personal' },
  { id: 'project-planner',       name: 'Project Planner',       description: 'Plan an entire project with tasks, priorities and estimates.',   icon: Sparkles,      minPlan: 'solo', category: 'personal' },
  { id: 'daily-plan',            name: 'Daily Plan',            description: 'Get a prioritized plan for your workday based on open tasks.',  icon: CalendarCheck, minPlan: 'solo', category: 'personal' },
  { id: 'priority-suggestions',  name: 'Priority Suggestions',  description: 'Analyse your tasks and suggest optimal priority assignments.',  icon: Zap,           minPlan: 'solo', category: 'personal' },
  { id: 'meeting-notes',         name: 'Meeting Notes → Tasks', description: 'Paste meeting notes and extract actionable tasks instantly.',   icon: FileText,      minPlan: 'solo', category: 'personal' },
  { id: 'productivity-insights', name: 'Productivity Insights', description: 'Get insights and recommendations from your time tracking data.',icon: TrendingUp,    minPlan: 'solo', category: 'personal' },
  { id: 'overdue-suggestions',   name: 'Overdue Suggestions',   description: 'Get AI-suggested actions to recover overdue tasks.',           icon: AlertCircle,   minPlan: 'solo', category: 'personal' },
  { id: 'workload-balancing',    name: 'Workload Balancing',    description: 'Analyse team workloads and suggest task redistribution.',       icon: Users,         minPlan: 'team', category: 'team' },
  { id: 'capacity-planning',     name: 'Capacity Planning',     description: 'Map upcoming tasks to team capacity and flag overcommitments.', icon: Gauge,         minPlan: 'team', category: 'team' },
  { id: 'project-health',        name: 'Project Health Score',  description: 'Score a project\'s health across schedule, scope and budget.',  icon: HeartPulse,    minPlan: 'team', category: 'team' },
  { id: 'risk-detection',        name: 'Risk Detection',        description: 'Identify schedule, budget and resource risks in a project.',    icon: Shield,        minPlan: 'team', category: 'team' },
];

const PLAN_ORDER = { free: 0, solo: 1, team: 2 };

function canAccess(userPlan: Plan, toolMinPlan: 'free' | 'solo' | 'team'): boolean {
  return PLAN_ORDER[userPlan] >= PLAN_ORDER[toolMinPlan];
}

// ── Result renderers ──────────────────────────────────────────────────────────

function PriorityBadge({ p }: { p: string }) {
  const cls: Record<string, string> = {
    low:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    medium: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    high:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', cls[p] ?? cls.medium)}>
      {p}
    </span>
  );
}

function SeverityBadge({ s }: { s: string }) {
  const cls: Record<string, string> = {
    low:      'bg-slate-100 text-slate-600',
    medium:   'bg-yellow-100 text-yellow-700',
    high:     'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', cls[s] ?? cls.medium)}>
      {s}
    </span>
  );
}

// ── SelectionHeader ───────────────────────────────────────────────────────────

function SelectionHeader({
  total, selected, label, onSelectAll, onDeselectAll,
}: {
  total: number;
  selected: number;
  label: string;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium text-muted-foreground">
        {total} {label} generated
        {selected > 0 && selected < total && (
          <span className="ml-1 text-primary">· {selected} selected</span>
        )}
      </p>
      <div className="flex gap-2">
        {selected < total && (
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Select all
          </button>
        )}
        {selected > 0 && (
          <button
            type="button"
            onClick={onDeselectAll}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            Deselect all
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AIHub({ plan, usageThisMonth, projects, tasks, members }: Props) {
  const router = useRouter();
  const [selected, setSelected]   = useState<string>(TOOLS[0].id);
  const [result,   setResult]     = useState<any>(null);
  const [error,    setError]      = useState<string>('');
  const [upgrade,  setUpgrade]    = useState(false);
  const [loading,  startLoading]  = useTransition();
  const [applying, startApplying] = useTransition();
  const [applied,  setApplied]    = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // Per-tool input state
  const [projectId,   setProjectId]   = useState('');
  const [taskId,      setTaskId]      = useState('');
  const [goal,        setGoal]        = useState('');
  const [projectName, setProjectName] = useState('');
  const [timeline,    setTimeline]    = useState('');
  const [notes,       setNotes]       = useState('');

  const limits     = AI_LIMITS[plan];
  const FREE_LIMIT = 5;
  const tool       = TOOLS.find((t) => t.id === selected)!;
  const accessible = canAccess(plan, tool.minPlan);

  function selectTool(id: string) {
    setSelected(id);
    setResult(null);
    setError('');
    setUpgrade(false);
    setApplied(false);
    setSelectedItems(new Set());
  }

  function toggleItem(i: number) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function selectAll(count: number) {
    setSelectedItems(new Set(Array.from({ length: count }, (_, i) => i)));
  }

  function deselectAll() {
    setSelectedItems(new Set());
  }

  // ── Call AI ─────────────────────────────────────────────────────────────────
  function generate() {
    setResult(null);
    setError('');
    setUpgrade(false);
    setApplied(false);

    startLoading(async () => {
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool:         selected,
            project_id:   projectId   || undefined,
            task_id:      taskId      || undefined,
            goal:         goal        || undefined,
            project_name: projectName || undefined,
            timeline:     timeline    || undefined,
            notes:        notes       || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error ?? 'AI request failed.');
          if (data.upgrade) setUpgrade(true);
        } else {
          setResult(data.result);
          // Auto-select all items for tools that support individual selection
          const r = data.result;
          const count =
            r?.tasks?.length ?? r?.subtasks?.length ?? r?.suggestions?.length ?? 0;
          if (count > 0) setSelectedItems(new Set(Array.from({ length: count }, (_, i) => i)));
        }
      } catch {
        setError('Network error. Please try again.');
      }
    });
  }

  // ── Apply actions ────────────────────────────────────────────────────────────
  function applyResult() {
    if (!result || selectedItems.size === 0) return;
    startApplying(async () => {
      try {
        if (selected === 'task-generator' || selected === 'project-planner' || selected === 'meeting-notes') {
          const taskList: Array<{ title: string; description?: string; priority?: TaskPriority; estimated_hours?: number }> =
            result.tasks ?? [];
          for (let i = 0; i < taskList.length; i++) {
            if (!selectedItems.has(i)) continue;
            const t = taskList[i];
            await createTask({
              title:           t.title,
              description:     t.description,
              priority:        (t.priority as TaskPriority) ?? 'medium',
              estimated_hours: t.estimated_hours ?? null,
              project_id:      projectId || undefined,
              status:          'todo',
            });
          }
        } else if (selected === 'subtask-generator') {
          const subs: Array<{ title: string }> = result.subtasks ?? [];
          for (let i = 0; i < subs.length; i++) {
            if (!selectedItems.has(i)) continue;
            if (taskId) await createSubtask(taskId, subs[i].title);
          }
        } else if (selected === 'priority-suggestions') {
          const sug: Array<{ task_id: string; suggested: TaskPriority }> = result.suggestions ?? [];
          for (let i = 0; i < sug.length; i++) {
            if (!selectedItems.has(i)) continue;
            await updateTask(sug[i].task_id, { priority: sug[i].suggested });
          }
        }
        setApplied(true);
        router.refresh();
      } catch {
        setError('Failed to apply changes. Please try again.');
      }
    });
  }

  const canApply = ['task-generator', 'project-planner', 'meeting-notes', 'subtask-generator', 'priority-suggestions'].includes(selected);

  // ── Tool input form ──────────────────────────────────────────────────────────
  function renderInputs() {
    switch (selected) {
      case 'task-generator':
        return (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Project</label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select project (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No project</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Goal / focus area</label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Build the user authentication module with OAuth support"
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>
        );

      case 'subtask-generator': {
        const filteredTasks = projectId
          ? tasks.filter((t) => t.project_id === projectId)
          : tasks;
        return (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Project (optional)</label>
              <Select
                value={projectId}
                onValueChange={(v) => { setProjectId(v); setTaskId(''); }}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Filter by project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All projects</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Task to break down</label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a task" /></SelectTrigger>
                <SelectContent>
                  {filteredTasks.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      {projectId ? 'No tasks in this project' : 'No open tasks found'}
                    </SelectItem>
                  ) : (
                    filteredTasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}{!projectId && t.project_name ? ` (${t.project_name})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      }

      case 'project-planner':
        return (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Project name</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. E-commerce website redesign"
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Goal</label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Describe what you want to achieve with this project"
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Timeline</label>
              <input
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                placeholder="e.g. 6 weeks, Q3 2026, by August 31"
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        );

      case 'meeting-notes':
        return (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Meeting notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste your meeting notes here — AI will extract action items and tasks…"
              rows={7}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        );

      case 'progress-summary':
      case 'project-health':
      case 'risk-detection':
        return (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Project</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );

      default:
        return (
          <p className="text-sm text-muted-foreground">
            Click Generate — AI will automatically pull your data and provide personalized insights.
          </p>
        );
    }
  }

  // ── Result renderer ──────────────────────────────────────────────────────────
  function renderResult() {
    if (!result) return null;

    switch (selected) {
      case 'task-generator':
      case 'project-planner':
      case 'meeting-notes': {
        const taskList: any[] = result.tasks ?? [];
        return (
          <div className="space-y-2">
            <SelectionHeader
              total={taskList.length}
              selected={selectedItems.size}
              label="tasks"
              onSelectAll={() => selectAll(taskList.length)}
              onDeselectAll={deselectAll}
            />
            {taskList.map((t, i) => (
              <label
                key={i}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                  selectedItems.has(i)
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-muted/20 opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(i)}
                  onChange={() => toggleItem(i)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <PriorityBadge p={t.priority ?? 'medium'} />
                  {t.estimated_hours && (
                    <span className="text-[10px] text-muted-foreground">{t.estimated_hours}h est.</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        );
      }

      case 'subtask-generator': {
        const subs: any[] = result.subtasks ?? [];
        return (
          <div className="space-y-2">
            <SelectionHeader
              total={subs.length}
              selected={selectedItems.size}
              label="subtasks"
              onSelectAll={() => selectAll(subs.length)}
              onDeselectAll={deselectAll}
            />
            {subs.map((s, i) => (
              <label
                key={i}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors',
                  selectedItems.has(i)
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-muted/20 opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(i)}
                  onChange={() => toggleItem(i)}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <p className="text-sm">{s.title}</p>
              </label>
            ))}
          </div>
        );
      }

      case 'daily-plan': {
        return (
          <div className="space-y-3">
            {result.summary && (
              <div className="rounded-xl bg-primary/5 px-4 py-3 text-sm text-foreground">{result.summary}</div>
            )}
            {(result.plan ?? []).map((item: any, i: number) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border px-4 py-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
                </div>
                {item.suggested_minutes && (
                  <span className="shrink-0 text-xs text-muted-foreground">{item.suggested_minutes}min</span>
                )}
              </div>
            ))}
          </div>
        );
      }

      case 'priority-suggestions': {
        const sug: any[] = result.suggestions ?? [];
        if (sug.length === 0) {
          return <p className="text-sm text-muted-foreground">Your task priorities look optimal — no changes suggested.</p>;
        }
        return (
          <div className="space-y-2">
            <SelectionHeader
              total={sug.length}
              selected={selectedItems.size}
              label="changes"
              onSelectAll={() => selectAll(sug.length)}
              onDeselectAll={deselectAll}
            />
            {sug.map((s, i) => (
              <label
                key={i}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                  selectedItems.has(i)
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-muted/20 opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(i)}
                  onChange={() => toggleItem(i)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.reason}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <PriorityBadge p={s.current} />
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <PriorityBadge p={s.suggested} />
                </div>
              </label>
            ))}
          </div>
        );
      }

      case 'progress-summary': {
        return (
          <div className="space-y-3">
            {result.summary && (
              <div className="rounded-xl bg-primary/5 px-4 py-3 text-sm leading-relaxed">{result.summary}</div>
            )}
            {(result.insights ?? []).length > 0 && (
              <div className="space-y-1.5">
                {(result.insights as string[]).map((ins, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {ins}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'productivity-insights':
      case 'overdue-suggestions': {
        const insights: string[]        = result.insights ?? result.suggestions?.map((s: any) => `${s.title}: ${s.action}`) ?? [];
        const recs: string[]            = result.recommendations ?? [];
        return (
          <div className="space-y-4">
            {insights.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Insights</p>
                <div className="space-y-2">
                  {insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl border border-border px-4 py-2.5 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                      {ins}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {recs.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Recommendations</p>
                <div className="space-y-2">
                  {recs.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl border border-border px-4 py-2.5 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'workload-balancing': {
        return (
          <div className="space-y-3">
            {(result.suggestions ?? []).map((s: any, i: number) => (
              <div key={i} className="rounded-xl border border-border px-4 py-3 text-sm">
                <p className="font-medium">Move "{s.task_title}"</p>
                <p className="mt-0.5 text-muted-foreground">From <strong>{s.from}</strong> → <strong>{s.to}</strong></p>
                <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
              </div>
            ))}
            {(result.analysis?.overloaded ?? []).length > 0 && (
              <div className="rounded-xl bg-orange-50 px-4 py-3 text-sm dark:bg-orange-900/20">
                <p className="font-medium text-orange-700 dark:text-orange-300">Overloaded members</p>
                <p className="text-orange-600 dark:text-orange-400">{result.analysis.overloaded.join(', ')}</p>
              </div>
            )}
          </div>
        );
      }

      case 'capacity-planning': {
        return (
          <div className="space-y-3">
            {(result.plan ?? []).map((p: any, i: number) => (
              <div key={i} className="rounded-xl border border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{p.member}</p>
                  <span className={cn('text-xs font-semibold', (p.utilization_pct ?? 0) > 90 ? 'text-red-600' : 'text-emerald-600')}>
                    {p.utilization_pct ?? 0}% utilised
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', (p.utilization_pct ?? 0) > 90 ? 'bg-red-500' : 'bg-emerald-500')}
                    style={{ width: `${Math.min(p.utilization_pct ?? 0, 100)}%` }}
                  />
                </div>
                {(p.assigned_tasks ?? []).length > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">{p.assigned_tasks.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        );
      }

      case 'project-health': {
        const score = result.score ?? 0;
        const color = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-orange-500' : 'text-red-500';
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={cn('text-5xl font-black tabular-nums', color)}>{score}</div>
              <div>
                <p className={cn('text-sm font-semibold capitalize', color)}>{result.status?.replace('_', ' ')}</p>
                <p className="text-xs text-muted-foreground">Health score out of 100</p>
              </div>
            </div>
            {result.breakdown && (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(result.breakdown as Record<string, number>).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border px-3 py-2">
                    <p className="text-xs capitalize text-muted-foreground">{k}</p>
                    <p className="text-sm font-bold">{v}/100</p>
                  </div>
                ))}
              </div>
            )}
            {(result.insights ?? []).map((ins: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{ins}
              </div>
            ))}
          </div>
        );
      }

      case 'risk-detection': {
        return (
          <div className="space-y-3">
            {(result.risks ?? []).map((r: any, i: number) => (
              <div key={i} className="rounded-xl border border-border px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{r.title}</p>
                  <SeverityBadge s={r.severity} />
                </div>
                <p className="text-xs text-muted-foreground">{r.description}</p>
                <p className="text-xs text-muted-foreground"><strong>Mitigation:</strong> {r.mitigation}</p>
              </div>
            ))}
          </div>
        );
      }

      default:
        return <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(result, null, 2)}</pre>;
    }
  }

  // ── Usage badge ──────────────────────────────────────────────────────────────
  const showUsage = plan === 'free';

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">

      {/* ── Tool list sidebar ──────────────────────────────────────────────── */}
      <div className="space-y-1">
        {showUsage && (
          <div className="mb-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Free plan usage</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 overflow-hidden rounded-full bg-muted h-1.5">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min((usageThisMonth / FREE_LIMIT) * 100, 100)}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums">{usageThisMonth}/{FREE_LIMIT}</span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">requests this month</p>
          </div>
        )}

        {['personal', 'team'].map((cat) => {
          const catTools = TOOLS.filter((t) => t.category === cat);
          if (cat === 'team' && !canAccess(plan, 'team')) {
            return (
              <div key={cat}>
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Team (Team plan)</p>
                {catTools.map((t) => (
                  <button
                    key={t.id}
                    disabled
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-muted-foreground/50 cursor-not-allowed"
                  >
                    <t.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate text-xs">{t.name}</span>
                    <Lock className="h-3 w-3 shrink-0" />
                  </button>
                ))}
              </div>
            );
          }
          return (
            <div key={cat}>
              {cat === 'team' && <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Team</p>}
              {catTools.map((t) => {
                const active = selected === t.id;
                const locked = !canAccess(plan, t.minPlan);
                return (
                  <button
                    key={t.id}
                    onClick={() => !locked && selectTool(t.id)}
                    disabled={locked}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                      locked && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <t.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{t.name}</span>
                    {t.minPlan !== 'free' && (
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
                        t.minPlan === 'team' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-primary/10 text-primary',
                      )}>
                        {t.minPlan}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Tool panel ────────────────────────────────────────────────────── */}
      <div className="tc-card space-y-5 p-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <tool.icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{tool.name}</h2>
            <p className="text-xs text-muted-foreground">{tool.description}</p>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Inputs */}
        <div className="space-y-1">
          {renderInputs()}
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={loading || !accessible}
          className="tc-btn-primary w-full gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Generating…' : 'Generate'}
        </button>

        {/* Error state */}
        {error && (
          <div className={cn(
            'flex items-start gap-2 rounded-xl border px-4 py-3 text-sm',
            upgrade
              ? 'border-primary/30 bg-primary/5 text-primary'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300',
          )}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>{error}</p>
              {upgrade && (
                <a href="/settings/billing" className="mt-1 block text-xs underline">
                  Upgrade your plan →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="h-px bg-border" />
            <div className="space-y-3">
              {renderResult()}
            </div>

            {/* Apply button */}
            {canApply && !applied && (
              <button
                onClick={applyResult}
                disabled={applying || selectedItems.size === 0}
                className="tc-btn-secondary w-full gap-2 disabled:opacity-40"
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {applying
                  ? 'Adding…'
                  : selectedItems.size === 0
                    ? 'Select items to add'
                    : `Add ${selectedItems.size} selected to workspace`}
              </button>
            )}

            {applied && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                <CheckCircle className="h-4 w-4" />
                Changes applied successfully.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
