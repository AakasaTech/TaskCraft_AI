'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  LayoutGrid, List, Plus, MoreHorizontal, Pencil,
  Archive, Trash2, RotateCcw, Calendar, CheckSquare,
  Clock, DollarSign,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProjectStatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { PROJECT_STATUS_LABELS } from '@/lib/constants';
import { deleteProject, archiveProject, restoreProject } from '../actions';
import { ProjectFormModal } from './ProjectFormModal';
import type { ProjectFormData } from './ProjectFormModal';
import type { ProjectStatus } from '@/lib/types';

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  client_id: string | null;
  client_name: string | null;
  start_date: string | null;
  due_date: string | null;
  budget: number | null;
  hourly_rate: number | null;
  billable: boolean;
  task_count: number;
  done_count: number;
  hours_logged: number;
}

interface Client { id: string; name: string; company: string | null; }

interface ProjectsClientProps {
  projects: ProjectRow[];
  clients: Client[];
}

type View = 'grid' | 'list';
type Filter = 'all' | ProjectStatus;

const FILTER_TABS: { value: Filter; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'active',      label: 'In Progress' },
  { value: 'on_hold',     label: 'On Hold' },
  { value: 'completed',   label: 'Completed' },
  { value: 'archived',    label: 'Archived' },
];

export function ProjectsClient({ projects, clients }: ProjectsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [view,         setView]         = useState<View>('grid');
  const [filter,       setFilter]       = useState<Filter>('all');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editData,     setEditData]     = useState<ProjectFormData | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);

  const filtered = filter === 'all' ? projects : projects.filter((p) => p.status === filter);

  function openCreate() { setEditData(undefined); setModalOpen(true); }
  function openEdit(p: ProjectRow) {
    setEditData({
      id: p.id, name: p.name, description: p.description ?? '',
      color: p.color, status: p.status, client_id: p.client_id ?? '',
      start_date: p.start_date ?? '', due_date: p.due_date ?? '',
      budget: p.budget, hourly_rate: p.hourly_rate, billable: p.billable,
    });
    setModalOpen(true);
  }

  function handleSuccess() {
    setModalOpen(false);
    router.refresh();
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      const r = await archiveProject(id);
      if (r.error) toast.error(r.error);
      else { toast.success('Project archived.'); router.refresh(); }
    });
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      const r = await restoreProject(id);
      if (r.error) toast.error(r.error);
      else { toast.success('Project restored.'); router.refresh(); }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteProject(id);
      if (r.error) toast.error(r.error);
      else { toast.success('Project deleted.'); setDeleteTarget(null); router.refresh(); }
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {FILTER_TABS.map(({ value, label }) => {
            const count = value === 'all' ? projects.length : projects.filter((p) => p.status === value).length;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === value
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    filter === value ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right side: view toggle + new */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-xl border border-border bg-muted/50 p-0.5">
            <button
              onClick={() => setView('grid')}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                view === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <button onClick={openCreate} className="tc-btn-primary">
            <Plus className="h-3.5 w-3.5" />
            New Project
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="tc-card">
          <EmptyState
            icon={LayoutGrid}
            title={filter === 'all' ? 'No projects yet' : `No ${PROJECT_STATUS_LABELS[filter as ProjectStatus] ?? filter} projects`}
            description={filter === 'all'
              ? 'Create your first project to organise tasks, track time, and collaborate with your team.'
              : 'No projects match this filter right now.'}
            action={filter === 'all' ? (
              <button onClick={openCreate} className="tc-btn-primary">
                <Plus className="h-3.5 w-3.5" />
                Create project
              </button>
            ) : undefined}
          />
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProjectGridCard
              key={p.id} project={p}
              onEdit={() => openEdit(p)}
              onArchive={() => handleArchive(p.id)}
              onRestore={() => handleRestore(p.id)}
              onDelete={() => setDeleteTarget(p)}
              disabled={isPending}
            />
          ))}
        </div>
      ) : (
        <ProjectListView
          projects={filtered}
          onEdit={openEdit}
          onArchive={(id) => handleArchive(id)}
          onRestore={(id) => handleRestore(id)}
          onDelete={(p) => setDeleteTarget(p)}
          disabled={isPending}
        />
      )}

      {/* Create / Edit Modal */}
      <ProjectFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
        initial={editData}
        clients={clients}
      />

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-semibold">Delete project?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>{deleteTarget.name}</strong> and all its tasks and time entries will be permanently deleted. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="tc-btn-secondary flex-1"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id)}
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

// ── Grid card ─────────────────────────────────────────────────────────────────

function ProjectGridCard({
  project, onEdit, onArchive, onRestore, onDelete, disabled,
}: {
  project: ProjectRow;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const total    = project.task_count;
  const done     = project.done_count;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const dueDateFmt = project.due_date
    ? new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="tc-card flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
          style={{ background: project.color }}
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/projects/${project.id}`}
            className="line-clamp-1 text-sm font-semibold leading-tight hover:text-primary transition-colors"
          >
            {project.name}
          </Link>
          {project.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
          )}
          {project.client_name && (
            <p className="mt-0.5 text-xs text-muted-foreground">{project.client_name}</p>
          )}
        </div>
        <ProjectMenu
          project={project}
          onEdit={onEdit} onArchive={onArchive} onRestore={onRestore} onDelete={onDelete}
          disabled={disabled}
        />
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{done}/{total} tasks</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: project.color }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {total > 0 && (
            <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" />{total}</span>
          )}
          {project.hours_logged > 0 && (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{project.hours_logged.toFixed(1)}h</span>
          )}
          {dueDateFmt && (
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{dueDateFmt}</span>
          )}
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

function ProjectListView({
  projects, onEdit, onArchive, onRestore, onDelete, disabled,
}: {
  projects: ProjectRow[];
  onEdit: (p: ProjectRow) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (p: ProjectRow) => void;
  disabled: boolean;
}) {
  return (
    <div className="tc-card overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 border-b border-border bg-muted/30 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Project</span>
        <span className="w-24 text-center">Status</span>
        <span className="w-20 text-center">Tasks</span>
        <span className="w-16 text-center">Hours</span>
        <span className="w-24 text-center">Due</span>
        <span className="w-8" />
      </div>
      {projects.map((p) => {
        const total    = p.task_count;
        const done     = p.done_count;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        const dueFmt   = p.due_date
          ? new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '—';

        return (
          <div
            key={p.id}
            className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 border-b border-border/50 px-5 py-3.5 last:border-0 hover:bg-muted/30 transition-colors"
          >
            {/* Name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <div className="min-w-0">
                <Link
                  href={`/projects/${p.id}`}
                  className="truncate text-sm font-medium hover:text-primary transition-colors"
                >
                  {p.name}
                </Link>
                {p.client_name && (
                  <p className="text-xs text-muted-foreground">{p.client_name}</p>
                )}
              </div>
            </div>
            {/* Status */}
            <div className="w-24 flex justify-center">
              <ProjectStatusBadge status={p.status} />
            </div>
            {/* Tasks progress */}
            <div className="w-20 text-center">
              {total > 0 ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">{done}/{total}</span>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: p.color }} />
                  </div>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            {/* Hours */}
            <div className="w-16 text-center text-xs text-muted-foreground">
              {p.hours_logged > 0 ? `${p.hours_logged.toFixed(1)}h` : '—'}
            </div>
            {/* Due date */}
            <div className="w-24 text-center text-xs text-muted-foreground">{dueFmt}</div>
            {/* Menu */}
            <div className="w-8 flex justify-center">
              <ProjectMenu
                project={p}
                onEdit={() => onEdit(p)}
                onArchive={() => onArchive(p.id)}
                onRestore={() => onRestore(p.id)}
                onDelete={() => onDelete(p)}
                disabled={disabled}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Shared dropdown menu ──────────────────────────────────────────────────────

function ProjectMenu({
  project, onEdit, onArchive, onRestore, onDelete, disabled,
}: {
  project: ProjectRow;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          disabled={disabled}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href={`/projects/${project.id}`} className="cursor-pointer">
            <LayoutGrid className="mr-2 h-3.5 w-3.5" />
            Open project
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {project.status === 'archived' ? (
          <DropdownMenuItem onClick={onRestore} className="cursor-pointer">
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onArchive} className="cursor-pointer">
            <Archive className="mr-2 h-3.5 w-3.5" />
            Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
