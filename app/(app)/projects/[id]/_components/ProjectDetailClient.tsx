'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Pencil, Archive, Trash2, RotateCcw, MoreHorizontal,
  CheckSquare, Clock, Calendar, DollarSign, Users,
  ExternalLink, UserMinus, Shield, Eye,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TaskStatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { cn } from '@/lib/utils';
import { archiveProject, deleteProject, restoreProject, removeProjectMember, updateProjectMemberRole } from '../../actions';
import { ProjectFormModal } from '../../_components/ProjectFormModal';
import type { ProjectFormData } from '../../_components/ProjectFormModal';
import type { TaskStatus, TaskPriority, ProjectMemberRole } from '@/lib/types';

type Tab = 'overview' | 'tasks' | 'time' | 'members';

export interface DetailTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_name: string | null;
}

export interface DetailTimeEntry {
  id: string;
  description: string | null;
  start_time: string;
  duration_minutes: number;
  billable: boolean;
  user_name: string | null;
}

export interface DetailMember {
  user_id: string;
  role: ProjectMemberRole;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface ProjectDetailClientProps {
  project: ProjectFormData & {
    name: string;
    color: string;
    client_name: string | null;
    hours_logged: number;
    billable_hours: number;
    budget_used: number;
    task_count: number;
    done_count: number;
    open_count: number;
    overdue_count: number;
  };
  tasks: DetailTask[];
  timeEntries: DetailTimeEntry[];
  members: DetailMember[];
  clients: { id: string; name: string; company: string | null }[];
  isTeamPlan: boolean;
  currentUserId: string;
}

const ROLE_LABELS: Record<ProjectMemberRole, string> = {
  manager: 'Manager',
  member:  'Member',
  viewer:  'Viewer',
};

const ROLE_ICON: Record<ProjectMemberRole, React.ElementType> = {
  manager: Shield,
  member:  CheckSquare,
  viewer:  Eye,
};

function minutesToHours(m: number) {
  const h = m / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) return <img src={url} alt={name ?? ''} className="h-7 w-7 rounded-full object-cover" />;
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
      {(name ?? '?')[0].toUpperCase()}
    </div>
  );
}

export function ProjectDetailClient({
  project, tasks, timeEntries, members, clients, isTeamPlan, currentUserId,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks',    label: 'Tasks',   count: project.task_count },
    { id: 'time',     label: 'Time',    count: timeEntries.length },
    ...(isTeamPlan ? [{ id: 'members' as Tab, label: 'Members', count: members.length }] : []),
  ];

  function handleArchive() {
    startTransition(async () => {
      const r = project.status === 'archived' ? await restoreProject(project.id!) : await archiveProject(project.id!);
      if (r.error) toast.error(r.error);
      else { toast.success(project.status === 'archived' ? 'Project restored.' : 'Project archived.'); router.refresh(); }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const r = await deleteProject(project.id!);
      if (r.error) toast.error(r.error);
      else { toast.success('Project deleted.'); router.push('/projects'); }
    });
  }

  function handleRemoveMember(userId: string) {
    startTransition(async () => {
      const r = await removeProjectMember(project.id!, userId);
      if (r.error) toast.error(r.error);
      else { toast.success('Member removed.'); router.refresh(); }
    });
  }

  function handleRoleChange(userId: string, role: ProjectMemberRole) {
    startTransition(async () => {
      const r = await updateProjectMemberRole(project.id!, userId, role);
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  }

  const progress = project.task_count > 0
    ? Math.round((project.done_count / project.task_count) * 100)
    : 0;

  const budgetUsedPct = project.budget && project.budget > 0
    ? Math.min(Math.round((project.budget_used / project.budget) * 100), 100)
    : null;

  return (
    <>
      {/* Project header */}
      <div className="tc-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="mt-1 h-10 w-10 shrink-0 rounded-xl"
              style={{ background: project.color }}
            />
            <div>
              <h1 className="text-xl font-bold">{project.name}</h1>
              {project.client_name && (
                <p className="mt-0.5 text-sm text-muted-foreground">{project.client_name}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => setEditOpen(true)} className="tc-btn-secondary gap-1.5 py-1.5 px-3 text-xs">
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" disabled={isPending}>
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={handleArchive} className="cursor-pointer">
                  {project.status === 'archived'
                    ? <><RotateCcw className="mr-2 h-3.5 w-3.5" />Restore</>
                    : <><Archive className="mr-2 h-3.5 w-3.5" />Archive</>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteConfirm(true)}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progress bar */}
        {project.task_count > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{project.done_count}/{project.task_count} tasks complete</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: project.color }}
              />
            </div>
          </div>
        )}

        {/* KPI strip */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/50 pt-4 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Open Tasks</p>
            <p className="mt-0.5 text-lg font-bold">{project.open_count}</p>
            {project.overdue_count > 0 && (
              <p className="text-[10px] text-red-500">{project.overdue_count} overdue</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Hours Logged</p>
            <p className="mt-0.5 text-lg font-bold">{project.hours_logged.toFixed(1)}h</p>
            <p className="text-[10px] text-muted-foreground">{minutesToHours(project.billable_hours * 60)} billable</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Budget</p>
            <p className="mt-0.5 text-lg font-bold">
              {project.budget ? `$${project.budget.toLocaleString()}` : '—'}
            </p>
            {budgetUsedPct !== null && (
              <p className={cn('text-[10px]', budgetUsedPct > 90 ? 'text-red-500' : 'text-muted-foreground')}>
                {budgetUsedPct}% used
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Hourly Rate</p>
            <p className="mt-0.5 text-lg font-bold">
              {project.hourly_rate ? `$${project.hourly_rate}/h` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">{project.billable ? 'Billable' : 'Non-billable'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'relative px-4 pb-3 pt-2 text-sm font-medium transition-colors',
              tab === id
                ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'tasks'    && <TasksTab tasks={tasks} projectId={project.id!} />}
      {tab === 'time'     && <TimeTab entries={timeEntries} />}
      {tab === 'members'  && isTeamPlan && (
        <MembersTab
          members={members}
          currentUserId={currentUserId}
          onRemove={handleRemoveMember}
          onRoleChange={handleRoleChange}
          disabled={isPending}
        />
      )}

      {/* Edit modal */}
      <ProjectFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => { setEditOpen(false); router.refresh(); }}
        initial={project}
        clients={clients}
      />

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-semibold">Delete project?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>{project.name}</strong> and all its tasks and time entries will be permanently deleted. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setDeleteConfirm(false)} className="tc-btn-secondary flex-1" disabled={isPending}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
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

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ project }: { project: ProjectDetailClientProps['project'] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        {/* Description */}
        <div className="tc-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Description</h3>
          {project.description ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground/60 italic">No description added.</p>
          )}
        </div>

        {/* Budget progress */}
        {project.budget && project.budget > 0 && (
          <div className="tc-card p-5">
            <h3 className="mb-4 text-sm font-semibold">Budget</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-semibold">${project.budget_used.toLocaleString()} / ${project.budget.toLocaleString()}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                {(() => {
                  const pct = Math.min(Math.round((project.budget_used / project.budget!) * 100), 100);
                  return (
                    <div
                      className={cn('h-full rounded-full transition-all', pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-400' : 'bg-primary')}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })()}
              </div>
              {project.hourly_rate && (
                <p className="text-xs text-muted-foreground">
                  At ${project.hourly_rate}/h — {(project.budget / project.hourly_rate).toFixed(1)}h budgeted
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Details sidebar */}
      <div className="tc-card p-5 space-y-4 h-fit">
        <h3 className="text-sm font-semibold">Details</h3>
        {[
          { label: 'Client',       value: project.client_name ?? '—', icon: Users },
          { label: 'Start date',   value: project.start_date ? formatDate(project.start_date) : '—', icon: Calendar },
          { label: 'Due date',     value: project.due_date ? formatDate(project.due_date) : '—',   icon: Calendar },
          { label: 'Hourly rate',  value: project.hourly_rate ? `$${project.hourly_rate}/h` : '—', icon: DollarSign },
          { label: 'Billable',     value: project.billable ? 'Yes' : 'No',                          icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <span className="text-xs font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
}

// ── Tab: Tasks ────────────────────────────────────────────────────────────────

function TasksTab({ tasks, projectId }: { tasks: DetailTask[]; projectId: string }) {
  if (tasks.length === 0) {
    return (
      <div className="tc-card">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <CheckSquare className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No tasks yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add tasks to this project to start tracking work.</p>
          <Link href="/tasks" className="tc-btn-primary mt-4 text-xs">
            Create task
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="tc-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</h3>
        <Link href={`/tasks?project=${projectId}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ExternalLink className="h-3 w-3" />
          Open in Tasks
        </Link>
      </div>
      <div className="divide-y divide-border/50">
        {tasks.map((t) => {
          const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';
          return (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3">
              <PriorityBadge priority={t.priority} iconOnly />
              <span className={cn('min-w-0 flex-1 truncate text-sm', t.status === 'done' && 'text-muted-foreground line-through')}>
                {t.title}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {t.assignee_name && (
                  <span className="hidden text-xs text-muted-foreground sm:block">{t.assignee_name}</span>
                )}
                {t.due_date && (
                  <span className={cn('text-xs', overdue ? 'text-red-500' : 'text-muted-foreground')}>
                    {new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                <TaskStatusBadge status={t.status} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Time ─────────────────────────────────────────────────────────────────

function TimeTab({ entries }: { entries: DetailTimeEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="tc-card">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No time entries</p>
          <p className="mt-1 text-xs text-muted-foreground">Time tracked against tasks in this project will appear here.</p>
        </div>
      </div>
    );
  }

  const totalMins    = entries.reduce((s, e) => s + e.duration_minutes, 0);
  const billableMins = entries.filter((e) => e.billable).reduce((s, e) => s + e.duration_minutes, 0);

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total time',    value: minutesToHours(totalMins)    },
          { label: 'Billable',      value: minutesToHours(billableMins) },
          { label: 'Entries',       value: entries.length.toString()    },
        ].map(({ label, value }) => (
          <div key={label} className="tc-card p-4 text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Entries list */}
      <div className="tc-card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border bg-muted/30 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Description</span>
          <span className="w-20 text-center">Duration</span>
          <span className="w-20 text-center">Date</span>
          <span className="w-16 text-center">Type</span>
        </div>
        <div className="divide-y divide-border/50">
          {entries.map((e) => (
            <div key={e.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{e.description ?? '—'}</p>
                {e.user_name && <p className="text-xs text-muted-foreground">{e.user_name}</p>}
              </div>
              <span className="w-20 text-center text-sm font-medium">{minutesToHours(e.duration_minutes)}</span>
              <span className="w-20 text-center text-xs text-muted-foreground">
                {new Date(e.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className={cn(
                'w-16 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold',
                e.billable
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400',
              )}>
                {e.billable ? 'Billable' : 'Free'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Members ──────────────────────────────────────────────────────────────

function MembersTab({
  members, currentUserId, onRemove, onRoleChange, disabled,
}: {
  members: DetailMember[];
  currentUserId: string;
  onRemove: (userId: string) => void;
  onRoleChange: (userId: string, role: ProjectMemberRole) => void;
  disabled: boolean;
}) {
  if (members.length === 0) {
    return (
      <div className="tc-card">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No members assigned</p>
          <p className="mt-1 text-xs text-muted-foreground">Add team members to collaborate on this project.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tc-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold">{members.length} member{members.length !== 1 ? 's' : ''}</h3>
      </div>
      <div className="divide-y divide-border/50">
        {members.map((m) => {
          const RoleIcon = ROLE_ICON[m.role];
          const isSelf = m.user_id === currentUserId;
          return (
            <div key={m.user_id} className="flex items-center gap-3 px-5 py-4">
              <Avatar name={m.full_name} url={m.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.full_name ?? m.email}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <Select
                value={m.role}
                onValueChange={(v) => onRoleChange(m.user_id, v as ProjectMemberRole)}
                disabled={disabled || isSelf}
              >
                <SelectTrigger className="w-32">
                  <div className="flex items-center gap-1.5">
                    <RoleIcon className="h-3 w-3" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as ProjectMemberRole[]).map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isSelf && (
                <button
                  onClick={() => onRemove(m.user_id)}
                  disabled={disabled}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Remove member"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
