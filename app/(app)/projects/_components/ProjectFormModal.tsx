'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Check, DollarSign, Loader2, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { PROJECT_COLOR_OPTIONS, PROJECT_STATUS_LABELS } from '@/lib/constants';
import { createProject, updateProject } from '../actions';
import type { ProjectStatus } from '@/lib/types';

interface Client { id: string; name: string; company: string | null; }

export interface ProjectFormData {
  id?: string;
  name?: string;
  description?: string;
  color?: string;
  status?: ProjectStatus;
  client_id?: string;
  start_date?: string;
  due_date?: string;
  budget?: number | null;
  hourly_rate?: number | null;
  billable?: boolean;
}

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: ProjectFormData;
  clients: Client[];
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'not_started', label: PROJECT_STATUS_LABELS.not_started },
  { value: 'active',      label: PROJECT_STATUS_LABELS.active      },
  { value: 'on_hold',     label: PROJECT_STATUS_LABELS.on_hold     },
  { value: 'completed',   label: PROJECT_STATUS_LABELS.completed   },
  { value: 'archived',    label: PROJECT_STATUS_LABELS.archived    },
];

export function ProjectFormModal({
  open, onClose, onSuccess, initial, clients,
}: ProjectFormModalProps) {
  const isEditing = !!initial?.id;
  const [isPending, startTransition] = useTransition();

  const [name,        setName]        = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color,       setColor]       = useState(initial?.color ?? PROJECT_COLOR_OPTIONS[0].hex);
  const [status,      setStatus]      = useState<ProjectStatus>(initial?.status ?? 'not_started');
  const [clientId,    setClientId]    = useState(initial?.client_id ?? '');
  const [startDate,   setStartDate]   = useState(initial?.start_date?.slice(0, 10) ?? '');
  const [dueDate,     setDueDate]     = useState(initial?.due_date?.slice(0, 10) ?? '');
  const [budget,      setBudget]      = useState(initial?.budget?.toString() ?? '');
  const [hourlyRate,  setHourlyRate]  = useState(initial?.hourly_rate?.toString() ?? '');
  const [billable,    setBillable]    = useState(initial?.billable ?? true);

  // Reset on open
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setDescription(initial?.description ?? '');
      setColor(initial?.color ?? PROJECT_COLOR_OPTIONS[0].hex);
      setStatus(initial?.status ?? 'not_started');
      setClientId(initial?.client_id ?? '');
      setStartDate(initial?.start_date?.slice(0, 10) ?? '');
      setDueDate(initial?.due_date?.slice(0, 10) ?? '');
      setBudget(initial?.budget?.toString() ?? '');
      setHourlyRate(initial?.hourly_rate?.toString() ?? '');
      setBillable(initial?.billable ?? true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Project name is required.'); return; }

    const payload = {
      name,
      description,
      color,
      status,
      client_id:   clientId || undefined,
      start_date:  startDate || undefined,
      due_date:    dueDate || undefined,
      budget:      budget     ? parseFloat(budget)     : null,
      hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
      billable,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateProject(initial!.id!, payload)
        : await createProject(payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? 'Project updated.' : 'Project created.');
      onSuccess();
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">
            {isEditing ? 'Edit project' : 'New project'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 p-6">

          {/* Colour picker */}
          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex gap-2.5">
              {PROJECT_COLOR_OPTIONS.map(({ hex, label }) => (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  onClick={() => setColor(hex)}
                  className={cn(
                    'relative h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    color === hex && 'ring-2 ring-ring ring-offset-2',
                  )}
                  style={{ background: hex }}
                >
                  {color === hex && (
                    <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              placeholder="e.g. Website Redesign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              placeholder="What is this project about?"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Status + Client */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger disabled={isPending}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger disabled={isPending}>
                  <SelectValue placeholder="No client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company ? `${c.name} · ${c.company}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start">Start date</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due">Due date</Label>
              <Input
                id="due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Budget + Hourly rate */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="budget">Budget ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-8"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rate">Hourly rate ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="rate"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-8"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {/* Billable toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Billable project</p>
              <p className="text-xs text-muted-foreground">Track billable hours and generate invoices</p>
            </div>
            <Switch
              checked={billable}
              onCheckedChange={setBillable}
              disabled={isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <button type="submit" disabled={isPending} className="tc-btn-primary">
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEditing ? 'Save changes' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
