'use client';

import { useEffect, useState, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import {
  X, Pencil, Trash2, Check, Circle, ChevronDown, Tag, Plus,
  MessageSquare, ListChecks, Clock, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskStatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, TASK_PRIORITY_LABELS, TASK_PRIORITY_ORDER } from '@/lib/constants';
import {
  updateTask, deleteTask, addComment, deleteComment,
  createSubtask, updateSubtaskStatus, assignLabel, removeLabel,
} from '../actions';
import type { TaskRich, LabelChip, TaskMember, TaskProject } from '../_types';
import type { TaskStatus, TaskPriority } from '@/lib/types';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profiles: any;
}

interface Props {
  task: TaskRich | null;
  allTasks: TaskRich[];
  labels: LabelChip[];
  members: TaskMember[];
  projects: TaskProject[];
  currentUserId: string;
  onClose: () => void;
  onEdit: (task: TaskRich) => void;
  onDeleted: (id: string) => void;
  onTaskUpdated: () => void;
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) return <img src={url} alt={name ?? ''} className="h-6 w-6 rounded-full object-cover" />;
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
      {(name ?? '?')[0].toUpperCase()}
    </div>
  );
}

export function TaskDetailDrawer({
  task, allTasks, labels, members, projects,
  currentUserId, onClose, onEdit, onDeleted, onTaskUpdated,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const subtasks = allTasks.filter((t) => t.parent_task_id === task?.id);

  // Load comments when task changes
  useEffect(() => {
    if (!task) { setComments([]); return; }
    setCommentsLoading(true);
    fetch(`/api/tasks/${task.id}/comments`)
      .then((r) => r.json())
      .then((j) => setComments(j.data ?? []))
      .finally(() => setCommentsLoading(false));
  }, [task?.id]);

  function handleStatusChange(status: TaskStatus) {
    if (!task) return;
    startTransition(async () => {
      const r = await updateTask(task.id, { status });
      if (r.error) toast.error(r.error);
      else onTaskUpdated();
    });
  }

  function handlePriorityChange(priority: TaskPriority) {
    if (!task) return;
    startTransition(async () => {
      const r = await updateTask(task.id, { priority });
      if (r.error) toast.error(r.error);
      else onTaskUpdated();
    });
  }

  function handleDelete() {
    if (!task) return;
    startTransition(async () => {
      const r = await deleteTask(task.id);
      if (r.error) toast.error(r.error);
      else { toast.success('Task deleted.'); onDeleted(task.id); }
    });
  }

  function handleSendComment() {
    if (!task || !newComment.trim()) return;
    startTransition(async () => {
      const r = await addComment(task.id, newComment.trim());
      if (r.error) { toast.error(r.error); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setComments((prev) => [...prev, r.data as any]);
      setNewComment('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
  }

  function handleDeleteComment(commentId: string) {
    startTransition(async () => {
      const r = await deleteComment(commentId);
      if (r.error) toast.error(r.error);
      else setComments((prev) => prev.filter((c) => c.id !== commentId));
    });
  }

  function handleAddSubtask() {
    if (!task || !newSubtask.trim()) return;
    startTransition(async () => {
      const r = await createSubtask(task.id, newSubtask.trim());
      if (r.error) { toast.error(r.error); return; }
      setNewSubtask('');
      onTaskUpdated();
    });
  }

  function handleToggleSubtask(subtaskId: string, currentStatus: TaskStatus) {
    const next: TaskStatus = currentStatus === 'done' ? 'todo' : 'done';
    startTransition(async () => {
      const r = await updateSubtaskStatus(subtaskId, next);
      if (r.error) toast.error(r.error);
      else onTaskUpdated();
    });
  }

  function handleToggleLabel(labelId: string) {
    if (!task) return;
    const has = task.labels.some((l) => l.id === labelId);
    startTransition(async () => {
      const r = has ? await removeLabel(task.id, labelId) : await assignLabel(task.id, labelId);
      if (r.error) toast.error(r.error);
      else onTaskUpdated();
    });
  }

  if (!task) return null;

  const now = new Date();
  const isOverdue = task.due_date && new Date(task.due_date) < now && task.status !== 'done';
  const project = projects.find((p) => p.id === task.project_id);
  const assigneeMember = members.find((m) => m.id === task.assignee_id);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl animate-slide-up sm:animate-none">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <PriorityBadge priority={task.priority} iconOnly />
              {project && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: project.color }} />
                  {project.name}
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold leading-snug">{task.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => onEdit(task)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors" title="Edit">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => setDeleteConfirm(true)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-0 lg:grid-cols-[1fr_220px]">

            {/* Main */}
            <div className="space-y-6 border-b border-border p-6 lg:border-b-0 lg:border-r">

              {/* Description */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</h3>
                {task.description ? (
                  <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{task.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">No description.</p>
                )}
              </div>

              {/* Subtasks */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ListChecks className="h-3.5 w-3.5" />
                    Subtasks
                    {subtasks.length > 0 && (
                      <span className="ml-1 text-[10px]">
                        ({subtasks.filter((s) => s.status === 'done').length}/{subtasks.length})
                      </span>
                    )}
                  </h3>
                </div>

                <div className="space-y-1.5">
                  {subtasks.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
                      <button
                        onClick={() => handleToggleSubtask(s.id, s.status)}
                        disabled={isPending}
                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {s.status === 'done'
                          ? <Check className="h-4 w-4 text-green-500" />
                          : <Circle className="h-4 w-4" />}
                      </button>
                      <span className={cn('flex-1 text-sm', s.status === 'done' && 'text-muted-foreground line-through')}>
                        {s.title}
                      </span>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add subtask…"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                      disabled={isPending}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      onClick={handleAddSubtask}
                      disabled={isPending || !newSubtask.trim()}
                      className="rounded-lg bg-primary/10 p-1.5 text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Comments */}
              <div>
                <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comments
                  {comments.length > 0 && <span className="text-[10px]">({comments.length})</span>}
                </h3>

                {commentsLoading ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => {
                      const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
                      return (
                        <div key={c.id} className="flex items-start gap-2.5">
                          <Avatar name={profile?.full_name ?? null} url={profile?.avatar_url ?? null} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold">{profile?.full_name ?? 'User'}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              {c.user_id === currentUserId && (
                                <button onClick={() => handleDeleteComment(c.id)} disabled={isPending}
                                  className="ml-auto rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Comment input */}
                <div className="mt-3 flex items-end gap-2">
                  <textarea
                    placeholder="Write a comment…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendComment(); }}
                    rows={2}
                    disabled={isPending}
                    className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={handleSendComment}
                    disabled={isPending || !newComment.trim()}
                    className="rounded-xl bg-primary p-2.5 text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Sidebar meta */}
            <div className="space-y-5 p-5">

              {/* Status */}
              <MetaField label="Status">
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TASK_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </MetaField>

              {/* Priority */}
              <MetaField label="Priority">
                <select
                  value={task.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TASK_PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </MetaField>

              {/* Due date */}
              <MetaField label="Due date">
                <p className={cn('text-xs', isOverdue ? 'font-semibold text-red-500' : 'text-foreground/70')}>
                  {task.due_date
                    ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : '—'}
                </p>
              </MetaField>

              {/* Assignee */}
              <MetaField label="Assignee">
                {assigneeMember ? (
                  <div className="flex items-center gap-1.5">
                    <Avatar name={assigneeMember.full_name} url={assigneeMember.avatar_url} />
                    <span className="text-xs">{assigneeMember.full_name ?? assigneeMember.email}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60">Unassigned</p>
                )}
              </MetaField>

              {/* Project */}
              <MetaField label="Project">
                {project ? (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: project.color }} />
                    <span className="text-xs">{project.name}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60">No project</p>
                )}
              </MetaField>

              {/* Time */}
              {(task.estimated_hours || task.actual_hours > 0) && (
                <MetaField label="Time">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{task.actual_hours.toFixed(1)}h logged</span>
                    {task.estimated_hours && (
                      <span className="text-muted-foreground">/ {task.estimated_hours}h est.</span>
                    )}
                  </div>
                </MetaField>
              )}

              {/* Labels */}
              <MetaField label="Labels">
                <div className="space-y-1.5">
                  {task.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {task.labels.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => handleToggleLabel(l.id)}
                          disabled={isPending}
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white transition-opacity hover:opacity-80"
                          style={{ background: l.color }}
                        >
                          {l.name}
                          <X className="h-2.5 w-2.5" />
                        </button>
                      ))}
                    </div>
                  )}
                  {labels.filter((l) => !task.labels.some((tl) => tl.id === l.id)).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {labels
                        .filter((l) => !task.labels.some((tl) => tl.id === l.id))
                        .map((l) => (
                          <button
                            key={l.id}
                            onClick={() => handleToggleLabel(l.id)}
                            disabled={isPending}
                            className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-foreground/60 hover:border-transparent hover:text-white transition-all"
                            style={{ ['--hover-bg' as string]: l.color }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = l.color)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                          >
                            <Tag className="h-2.5 w-2.5" />
                            {l.name}
                          </button>
                        ))}
                    </div>
                  )}
                  {labels.length === 0 && task.labels.length === 0 && (
                    <p className="text-[11px] text-muted-foreground/60">No labels</p>
                  )}
                </div>
              </MetaField>

            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-semibold">Delete task?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>{task.title}</strong> will be permanently deleted.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setDeleteConfirm(false)} disabled={isPending}
                className="tc-btn-secondary flex-1 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
