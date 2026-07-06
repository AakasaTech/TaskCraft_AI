'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { X, Loader2, Plus, Tag } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, TASK_PRIORITY_LABELS, TASK_PRIORITY_ORDER } from '@/lib/constants';
import { createTask, updateTask, syncTaskLabels, createLabel } from '../actions';
import type { TaskRich, LabelChip, TaskProject, TaskMember } from '../_types';
import type { TaskStatus, TaskPriority } from '@/lib/types';

const LABEL_COLORS = [
  '#6366f1','#8b5cf6','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: TaskRich;
  projects: TaskProject[];
  members: TaskMember[];
  labels: LabelChip[];
  defaultStatus?: TaskStatus;
  defaultProjectId?: string;
}

export function TaskFormModal({
  open, onClose, onSuccess, initial, projects, members, labels,
  defaultStatus = 'todo', defaultProjectId,
}: Props) {
  const isEditing = !!initial?.id;
  const [isPending, startTransition] = useTransition();

  const [title,    setTitle]    = useState(initial?.title ?? '');
  const [desc,     setDesc]     = useState(initial?.description ?? '');
  const [status,   setStatus]   = useState<TaskStatus>(initial?.status ?? defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [project,  setProject]  = useState(initial?.project_id ?? defaultProjectId ?? '');
  const [assignee, setAssignee] = useState(initial?.assignee_id ?? '');
  const [dueDate,  setDueDate]  = useState(initial?.due_date?.slice(0, 10) ?? '');
  const [startDate,setStart]    = useState(initial?.start_date?.slice(0, 10) ?? '');
  const [estHours, setEstHours] = useState(initial?.estimated_hours?.toString() ?? '');
  const [billable, setBillable] = useState(initial?.billable ?? false);
  const [rate,     setRate]     = useState(initial?.hourly_rate?.toString() ?? '');
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    initial?.labels.map((l) => l.id) ?? []
  );

  // Label creation
  const [newLabelName,  setNewLabelName]  = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [showNewLabel,  setShowNewLabel]  = useState(false);
  const [allLabels, setAllLabels] = useState<LabelChip[]>(labels);

  function toggleLabel(id: string) {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleCreateLabel() {
    if (!newLabelName.trim()) return;
    startTransition(async () => {
      const r = await createLabel(newLabelName.trim(), newLabelColor);
      if (r.error) { toast.error(r.error); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = r.data as any;
      const chip: LabelChip = { id: created.id, name: created.name, color: created.color };
      setAllLabels((prev) => [...prev, chip]);
      setSelectedLabels((prev) => [...prev, chip.id]);
      setNewLabelName('');
      setShowNewLabel(false);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required.'); return; }

    const payload = {
      title,
      description:     desc,
      status,
      priority,
      project_id:      project || undefined,
      assignee_id:     assignee || undefined,
      due_date:        dueDate || undefined,
      start_date:      startDate || undefined,
      estimated_hours: estHours ? parseFloat(estHours) : null,
      billable,
      hourly_rate:     rate ? parseFloat(rate) : null,
    };

    startTransition(async () => {
      if (isEditing) {
        const r = await updateTask(initial!.id, payload);
        if (r.error) { toast.error(r.error); return; }
        await syncTaskLabels(initial!.id, selectedLabels);
      } else {
        const r = await createTask({ ...payload, label_ids: selectedLabels });
        if (r.error) { toast.error(r.error); return; }
      }
      toast.success(isEditing ? 'Task updated.' : 'Task created.');
      onSuccess();
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">{isEditing ? 'Edit task' : 'New task'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Title <span className="text-destructive">*</span></Label>
            <Input id="t-title" placeholder="What needs to be done?" value={title}
              onChange={(e) => setTitle(e.target.value)} disabled={isPending} required />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" rows={3} placeholder="Add details…" value={desc}
              onChange={(e) => setDesc(e.target.value)} disabled={isPending} />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger disabled={isPending}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger disabled={isPending}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITY_ORDER.map((p) => (
                    <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Project + Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={project} onValueChange={setProject}>
                <SelectTrigger disabled={isPending}><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger disabled={isPending}><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-start">Start date</Label>
              <Input id="t-start" type="date" value={startDate}
                onChange={(e) => setStart(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-due">Due date</Label>
              <Input id="t-due" type="date" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)} disabled={isPending} />
            </div>
          </div>

          {/* Estimated hours */}
          <div className="space-y-1.5">
            <Label htmlFor="t-est">Estimated hours</Label>
            <Input id="t-est" type="number" min="0" step="0.25" placeholder="e.g. 2.5"
              value={estHours} onChange={(e) => setEstHours(e.target.value)} disabled={isPending} />
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Labels</Label>
              <button type="button" onClick={() => setShowNewLabel((x) => !x)}
                className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="h-3 w-3" />
                New label
              </button>
            </div>

            {showNewLabel && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
                <Input
                  placeholder="Label name"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="h-7 text-xs"
                  disabled={isPending}
                />
                <div className="flex gap-1">
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c} type="button"
                      onClick={() => setNewLabelColor(c)}
                      className={cn('h-4 w-4 rounded-full transition-transform hover:scale-110',
                        newLabelColor === c && 'ring-2 ring-ring ring-offset-1')}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <button type="button" onClick={handleCreateLabel}
                  disabled={isPending || !newLabelName.trim()}
                  className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
                  Add
                </button>
              </div>
            )}

            {allLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allLabels.map((l) => (
                  <button
                    key={l.id} type="button"
                    onClick={() => toggleLabel(l.id)}
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all',
                      selectedLabels.includes(l.id)
                        ? 'border-transparent text-white'
                        : 'border-border bg-card text-foreground/70',
                    )}
                    style={selectedLabels.includes(l.id) ? { background: l.color } : undefined}
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Billable */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium">Billable task</p>
            <Switch checked={billable} onCheckedChange={setBillable} disabled={isPending} />
          </div>

          {billable && (
            <div className="space-y-1.5">
              <Label htmlFor="t-rate">Hourly rate ($)</Label>
              <Input id="t-rate" type="number" min="0" step="0.01" placeholder="0.00"
                value={rate} onChange={(e) => setRate(e.target.value)} disabled={isPending} />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button type="button" onClick={onClose} disabled={isPending}
              className="tc-btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="tc-btn-primary">
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEditing ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
