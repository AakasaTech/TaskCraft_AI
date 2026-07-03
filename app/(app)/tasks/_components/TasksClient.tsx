'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutList, Columns, Search, SlidersHorizontal, Plus, X, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, TASK_PRIORITY_LABELS, TASK_PRIORITY_ORDER } from '@/lib/constants';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TaskListView } from './TaskListView';
import { TaskKanbanView } from './TaskKanbanView';
import { TaskFormModal } from './TaskFormModal';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import type { TaskRich, LabelChip, TaskMember, TaskProject, TaskFiltersState, TaskView } from '../_types';
import type { TaskStatus } from '@/lib/types';

interface Props {
  tasks: TaskRich[];
  projects: TaskProject[];
  members: TaskMember[];
  labels: LabelChip[];
  currentUserId: string;
  defaultView?: TaskView;
}

const EMPTY_FILTERS: TaskFiltersState = {
  search: '', project_id: '', assignee_id: '', status: '',
  priority: '', due: '', label_id: '',
};

export function TasksClient({
  tasks: initialTasks, projects, members, labels, currentUserId, defaultView = 'list',
}: Props) {
  const router = useRouter();

  const [view,           setView]           = useState<TaskView>(defaultView);
  const [filters,        setFilters]        = useState<TaskFiltersState>(EMPTY_FILTERS);
  const [showFilters,    setShowFilters]    = useState(false);
  const [tasks,          setTasks]          = useState<TaskRich[]>(initialTasks);
  const [selectedTask,   setSelectedTask]   = useState<TaskRich | null>(null);
  const [editTask,       setEditTask]       = useState<TaskRich | undefined>(undefined);
  const [formOpen,       setFormOpen]       = useState(false);
  const [defaultStatus,  setDefaultStatus]  = useState<TaskStatus>('todo');

  // Sync external task list (from router.refresh)
  if (initialTasks !== tasks) setTasks(initialTasks);

  const filtered = useMemo(() => {
    const now = new Date();
    return tasks.filter((t) => {
      // Skip subtasks in main views
      if (t.parent_task_id) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!t.title.toLowerCase().includes(q)) return false;
      }
      if (filters.project_id   && t.project_id   !== filters.project_id)   return false;
      if (filters.assignee_id  && t.assignee_id  !== filters.assignee_id)  return false;
      if (filters.status       && t.status        !== filters.status)       return false;
      if (filters.priority     && t.priority      !== filters.priority)     return false;
      if (filters.label_id     && !t.labels.some((l) => l.id === filters.label_id)) return false;
      if (filters.due === 'today') {
        const td = new Date(); td.setHours(23, 59, 59);
        if (!t.due_date || new Date(t.due_date) > td) return false;
      }
      if (filters.due === 'week') {
        const week = new Date(); week.setDate(week.getDate() + 7);
        if (!t.due_date || new Date(t.due_date) > week) return false;
      }
      if (filters.due === 'overdue') {
        if (!t.due_date || new Date(t.due_date) >= now || t.status === 'done') return false;
      }
      return true;
    });
  }, [tasks, filters]);

  // View-specific filter overrides
  const viewTasks = useMemo(() => {
    if (view === 'my-tasks')   return filtered.filter((t) => t.assignee_id === currentUserId && t.status !== 'done');
    if (view === 'overdue')    return filtered.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done');
    if (view === 'completed')  return filtered.filter((t) => t.status === 'done');
    return filtered;
  }, [filtered, view, currentUserId]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function openForm(status?: TaskStatus) {
    setEditTask(undefined);
    setDefaultStatus(status ?? 'todo');
    setFormOpen(true);
  }

  function openEditForm(task: TaskRich) {
    setEditTask(task);
    setFormOpen(true);
  }

  function handleFormSuccess() {
    setFormOpen(false);
    setEditTask(undefined);
    router.refresh();
  }

  function handleDeleted(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (selectedTask?.id === id) setSelectedTask(null);
  }

  function handleTaskUpdated() {
    router.refresh();
  }

  const VIEWS: { id: TaskView; label: string }[] = [
    { id: 'list',      label: 'All Tasks' },
    { id: 'my-tasks',  label: 'My Tasks' },
    { id: 'overdue',   label: 'Overdue' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* View tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
          {VIEWS.map((v) => {
            const count = v.id === 'list'      ? filtered.length
                        : v.id === 'my-tasks'  ? tasks.filter((t) => t.assignee_id === currentUserId && t.status !== 'done').length
                        : v.id === 'overdue'   ? tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length
                        : tasks.filter((t) => t.status === 'done').length;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  view === v.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v.label}
                {count > 0 && (
                  <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                    view === v.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((x) => !x)}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors',
              showFilters || activeFilterCount > 0
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">{activeFilterCount}</span>
            )}
          </button>

          {/* View mode (list/kanban) */}
          <div className="hidden items-center rounded-lg border border-border sm:flex">
            <button
              onClick={() => setView('list')}
              className={cn('rounded-l-lg p-1.5 transition-colors', view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted')}
              title="List view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={cn('rounded-r-lg p-1.5 transition-colors', view === 'kanban' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted')}
              title="Kanban view"
            >
              <Columns className="h-4 w-4" />
            </button>
          </div>

          <button onClick={() => openForm()} className="tc-btn-primary gap-1.5 py-2 px-3 text-xs">
            <Plus className="h-3.5 w-3.5" />
            New task
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <Select value={filters.project_id} onValueChange={(v) => setFilters((f) => ({ ...f, project_id: v }))}>
            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.assignee_id} onValueChange={(v) => setFilters((f) => ({ ...f, assignee_id: v }))}>
            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All assignees</SelectItem>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as TaskStatus | '' }))}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              {TASK_STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.priority} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v as TaskFiltersState['priority'] }))}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All priorities</SelectItem>
              {TASK_PRIORITY_ORDER.map((p) => <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.due} onValueChange={(v) => setFilters((f) => ({ ...f, due: v as TaskFiltersState['due'] }))}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Due date" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any date</SelectItem>
              <SelectItem value="today">Due today</SelectItem>
              <SelectItem value="week">Due this week</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          {labels.length > 0 && (
            <Select value={filters.label_id} onValueChange={(v) => setFilters((f) => ({ ...f, label_id: v }))}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="Label" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All labels</SelectItem>
                {labels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />Clear
            </button>
          )}
        </div>
      )}

      {/* View content */}
      {view === 'kanban' ? (
        <TaskKanbanView
          tasks={tasks.filter((t) => !t.parent_task_id)}
          onOpen={setSelectedTask}
          onEdit={openEditForm}
          onDeleted={handleDeleted}
          onAdd={(status) => openForm(status)}
          onTaskUpdated={handleTaskUpdated}
        />
      ) : (
        <TaskListView
          tasks={viewTasks}
          onOpen={setSelectedTask}
          onEdit={openEditForm}
          onDeleted={handleDeleted}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {/* Task detail drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        allTasks={tasks}
        labels={labels}
        members={members}
        projects={projects}
        currentUserId={currentUserId}
        onClose={() => setSelectedTask(null)}
        onEdit={(t) => { setSelectedTask(null); openEditForm(t); }}
        onDeleted={handleDeleted}
        onTaskUpdated={handleTaskUpdated}
      />

      {/* Create/edit modal */}
      <TaskFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTask(undefined); }}
        onSuccess={handleFormSuccess}
        initial={editTask}
        projects={projects}
        members={members}
        labels={labels}
        defaultStatus={defaultStatus}
      />
    </div>
  );
}
