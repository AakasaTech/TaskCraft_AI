'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, MoreHorizontal, Pencil, Trash2, Check, Calendar } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { cn } from '@/lib/utils';
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '@/lib/constants';
import { moveTaskStatus, deleteTask } from '../actions';
import type { TaskRich } from '../_types';
import type { TaskStatus } from '@/lib/types';

const COLUMN_COLORS: Record<TaskStatus, string> = {
  backlog:     'bg-purple-400',
  todo:        'bg-slate-400',
  in_progress: 'bg-blue-500',
  in_review:   'bg-amber-400',
  done:        'bg-green-500',
};

// ── Droppable column ─────────────────────────────────────────────────────────

function KanbanColumn({
  status, tasks, onOpen, onEdit, onDeleted, onAdd, isPending,
}: {
  status: TaskStatus;
  tasks: TaskRich[];
  onOpen: (t: TaskRich) => void;
  onEdit: (t: TaskRich) => void;
  onDeleted: (id: string) => void;
  onAdd: (status: TaskStatus) => void;
  isPending: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-muted/30">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', COLUMN_COLORS[status])} />
          <span className="text-xs font-semibold">{TASK_STATUS_LABELS[status]}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAdd(status)}
          className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={`Add task to ${TASK_STATUS_LABELS[status]}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-1 flex-col gap-2 overflow-y-auto p-3 pt-0 min-h-[120px] transition-colors',
          isOver && 'bg-primary/5',
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableCard
              key={task.id}
              task={task}
              onOpen={onOpen}
              onEdit={onEdit}
              onDeleted={onDeleted}
              isPending={isPending}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            onClick={() => onAdd(status)}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
          >
            <Plus className="mb-1 h-4 w-4" />
            Add task
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sortable card wrapper ─────────────────────────────────────────────────────

function SortableCard({
  task, onOpen, onEdit, onDeleted, isPending,
}: {
  task: TaskRich;
  onOpen: (t: TaskRich) => void;
  onEdit: (t: TaskRich) => void;
  onDeleted: (id: string) => void;
  isPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onOpen={onOpen} onEdit={onEdit} onDeleted={onDeleted} isPending={isPending} />
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function TaskCard({
  task, onOpen, onEdit, onDeleted, isPending,
}: {
  task: TaskRich;
  onOpen: (t: TaskRich) => void;
  onEdit: (t: TaskRich) => void;
  onDeleted: (id: string) => void;
  isPending: boolean;
}) {
  const [localPending, startTransition] = useTransition();
  const now = new Date();
  const isOverdue = task.due_date && new Date(task.due_date) < now && task.status !== 'done';

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const r = await deleteTask(task.id);
      if (r.error) toast.error(r.error);
      else { toast.success('Task deleted.'); onDeleted(task.id); }
    });
  }

  return (
    <div
      className={cn(
        'kanban-card group',
        `priority-${task.priority}`,
        task.status === 'done' && 'opacity-60',
      )}
      onClick={() => onOpen(task)}
    >
      {/* Top row */}
      <div className="mb-2 flex items-start justify-between gap-1 pl-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={task.priority} iconOnly />
          {task.project_name && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: task.project_color ?? '#6366f1' }} />
              {task.project_name}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="hidden rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors group-hover:flex">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen(task); }} className="cursor-pointer text-xs">
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="cursor-pointer text-xs">
              <Pencil className="mr-1.5 h-3 w-3" />Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-xs text-destructive focus:text-destructive">
              <Trash2 className="mr-1.5 h-3 w-3" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title */}
      <p className={cn('mb-2.5 pl-3 text-sm font-medium leading-snug line-clamp-2',
        task.status === 'done' && 'line-through text-muted-foreground')}>
        {task.title}
      </p>

      {/* Labels */}
      {task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1 pl-3">
          {task.labels.slice(0, 3).map((l) => (
            <span key={l.id} className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white" style={{ background: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pl-3">
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className={cn('flex items-center gap-1 text-[10px]', isOverdue ? 'font-semibold text-red-500' : 'text-muted-foreground')}>
              <Calendar className="h-3 w-3" />
              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.subtask_count > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {task.done_subtask_count}/{task.subtask_count}
            </span>
          )}
        </div>
        {task.assignee_name && (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary" title={task.assignee_name}>
            {task.assignee_name[0].toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main kanban board ─────────────────────────────────────────────────────────

interface Props {
  tasks: TaskRich[];
  onOpen: (task: TaskRich) => void;
  onEdit: (task: TaskRich) => void;
  onDeleted: (id: string) => void;
  onAdd: (status: TaskStatus) => void;
  onTaskUpdated: () => void;
}

export function TaskKanbanView({ tasks, onOpen, onEdit, onDeleted, onAdd, onTaskUpdated }: Props) {
  const [localTasks, setLocalTasks] = useState<TaskRich[]>(tasks);
  const [activeId,   setActiveId]   = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();

  // Sync external tasks changes
  if (tasks !== localTasks && !isPending) {
    setLocalTasks(tasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeTask = localTasks.find((t) => t.id === activeId) ?? null;

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeTask = localTasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Determine target status: over a column id or over another task
    const overIsColumn = TASK_STATUS_ORDER.includes(over.id as TaskStatus);
    const targetStatus: TaskStatus = overIsColumn
      ? (over.id as TaskStatus)
      : (localTasks.find((t) => t.id === over.id)?.status ?? activeTask.status);

    if (targetStatus === activeTask.status) return; // same column, skip reorder for now

    // Optimistic update
    setLocalTasks((prev) =>
      prev.map((t) => t.id === activeTask.id ? { ...t, status: targetStatus } : t),
    );

    startTransition(async () => {
      const r = await moveTaskStatus(activeTask.id, targetStatus);
      if (r.error) {
        toast.error(r.error);
        setLocalTasks(tasks); // revert
      } else {
        onTaskUpdated();
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TASK_STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={localTasks.filter((t) => t.status === status)}
            onOpen={onOpen}
            onEdit={onEdit}
            onDeleted={onDeleted}
            onAdd={onAdd}
            isPending={isPending}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rotate-2 scale-105 opacity-90 shadow-xl">
            <TaskCard
              task={activeTask}
              onOpen={() => {}}
              onEdit={() => {}}
              onDeleted={() => {}}
              isPending={false}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
