'use client';

import { useState, useMemo, useCallback } from 'react';
import { Printer, SlidersHorizontal, ChevronDown } from 'lucide-react';
import {
  FolderKanban, CheckSquare, Clock, DollarSign,
  Building2, AlertTriangle, Users, TrendingUp, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportType, FilterState, ReportTimeEntry, ReportProject, ReportTask, ReportMember } from '../_types';
import { applyEntryFilters, applyTaskFilters, applyProjectFilters, getDefaultFilters, presetRange } from '../_utils';
import { ProjectProgressReport }     from './ProjectProgressReport';
import { TaskCompletionReport }       from './TaskCompletionReport';
import { TimeTrackingReport }         from './TimeTrackingReport';
import { BillableHoursReport }        from './BillableHoursReport';
import { ClientProfitabilityReport }  from './ClientProfitabilityReport';
import { OverdueTaskReport }          from './OverdueTaskReport';
import { TeamWorkloadReport, TeamProductivityReport } from './TeamReports';
import { InvoiceReadyReport }         from './InvoiceReadyReport';

interface Props {
  entries:       ReportTimeEntry[];
  projects:      ReportProject[];
  tasks:         ReportTask[];
  members:       ReportMember[];
  clients:       { id: string; name: string }[];
  isTeamPlan:    boolean;
  currentUserId: string;
}

const REPORT_TYPES: {
  id: ReportType; label: string; icon: React.ElementType; teamOnly?: boolean
}[] = [
  { id: 'project-progress',     label: 'Project Progress',     icon: FolderKanban  },
  { id: 'task-completion',      label: 'Task Completion',      icon: CheckSquare   },
  { id: 'time-tracking',        label: 'Time Tracking',        icon: Clock         },
  { id: 'billable-hours',       label: 'Billable Hours',       icon: DollarSign    },
  { id: 'client-profitability', label: 'Client Profitability', icon: Building2     },
  { id: 'overdue-tasks',        label: 'Overdue Tasks',        icon: AlertTriangle },
  { id: 'team-workload',        label: 'Team Workload',        icon: Users,         teamOnly: true },
  { id: 'team-productivity',    label: 'Team Productivity',    icon: TrendingUp,    teamOnly: true },
  { id: 'invoice-ready',        label: 'Invoice-Ready Time',   icon: Receipt       },
];

const DATE_PRESETS: { id: string; label: string }[] = [
  { id: 'week',  label: 'This week'   },
  { id: 'month', label: 'This month'  },
  { id: '30d',   label: 'Last 30d'    },
  { id: '90d',   label: 'Last 90d'    },
  { id: 'year',  label: 'This year'   },
  { id: 'all',   label: 'All data'    },
];

export function ReportsClient({ entries, projects, tasks, members, clients, isTeamPlan, currentUserId }: Props) {
  const [report,      setReport]      = useState<ReportType>('time-tracking');
  const [filters,     setFilters]     = useState<FilterState>(getDefaultFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('30d');

  const setFilter = useCallback(<K extends keyof FilterState>(k: K, v: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [k]: v }));
  }, []);

  function applyPreset(id: string) {
    setActivePreset(id);
    const { dateFrom, dateTo } = presetRange(id);
    setFilters(prev => ({ ...prev, dateFrom, dateTo }));
  }

  const filteredEntries  = useMemo(() => applyEntryFilters(entries, filters),   [entries, filters]);
  const filteredTasks    = useMemo(() => applyTaskFilters(tasks, filters),       [tasks, filters]);
  const filteredProjects = useMemo(() => applyProjectFilters(projects, filters), [projects, filters]);

  const reportProps = {
    entries:  filteredEntries,
    projects: filteredProjects,
    tasks:    filteredTasks,
    members,
    filters,
    isTeamPlan,
    currentUserId,
  };

  const current = REPORT_TYPES.find(r => r.id === report)!;

  return (
    <>
      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">TaskCraft AI — {current.label}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filters.dateFrom || filters.dateTo
            ? `${filters.dateFrom || '—'} → ${filters.dateTo || '—'}`
            : 'All data'}
        </p>
      </div>

      <div className="flex gap-6">
        {/* ── Report type sidebar ─────────────────────────────────── */}
        <aside className="hidden lg:block w-52 shrink-0 print:hidden">
          <nav className="space-y-0.5">
            {REPORT_TYPES.map(({ id, label, icon: Icon, teamOnly }) => {
              const locked = teamOnly && !isTeamPlan;
              return (
                <button
                  key={id}
                  onClick={() => !locked && setReport(id)}
                  disabled={locked}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors text-left',
                    report === id
                      ? 'bg-primary/10 text-primary font-medium'
                      : locked
                        ? 'text-muted-foreground/40 cursor-not-allowed'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                  {locked && <span className="ml-auto text-[9px] font-semibold uppercase text-muted-foreground/50">Team</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Main panel ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* Mobile report selector */}
            <div className="relative lg:hidden">
              <select
                value={report}
                onChange={(e) => setReport(e.target.value as ReportType)}
                className="appearance-none rounded-xl border border-border bg-card pl-3 pr-8 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
              >
                {REPORT_TYPES.map(({ id, label, teamOnly }) => (
                  <option key={id} value={id} disabled={teamOnly && !isTeamPlan}>
                    {label}{teamOnly && !isTeamPlan ? ' (Team)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            </div>

            {/* Date presets */}
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                    activePreset === p.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={cn('tc-btn-secondary gap-1.5 text-xs px-3 py-2', showFilters && 'border-primary/40 text-primary')}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </button>

            {/* Print */}
            <button onClick={() => window.print()} className="tc-btn-secondary gap-1.5 text-xs px-3 py-2 ml-auto">
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
          </div>

          {/* ── Filter panel ──────────────────────────────────────── */}
          {showFilters && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 print:hidden">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Date from */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => { setActivePreset('custom'); setFilter('dateFrom', e.target.value); }}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Date to */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => { setActivePreset('custom'); setFilter('dateTo', e.target.value); }}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Client */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Client</label>
                  <select
                    value={filters.clientId}
                    onChange={(e) => setFilter('clientId', e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">All clients</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Project */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Project</label>
                  <select
                    value={filters.projectId}
                    onChange={(e) => setFilter('projectId', e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">All projects</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                {/* User (team only) */}
                {isTeamPlan && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Member</label>
                    <select
                      value={filters.userId}
                      onChange={(e) => setFilter('userId', e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">All members</option>
                      {members.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilter('status', e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">All statuses</option>
                    <optgroup label="Task status">
                      <option value="backlog">Backlog</option>
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="in_review">In Review</option>
                      <option value="done">Done</option>
                    </optgroup>
                    <optgroup label="Project status">
                      <option value="not_started">Not Started</option>
                      <option value="active">Active</option>
                      <option value="on_hold">On Hold</option>
                      <option value="completed">Completed</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Billable toggle */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground mr-1">Time entries:</span>
                {(['all', 'billable', 'non-billable'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFilter('billable', v)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                      filters.billable === v
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {v === 'non-billable' ? 'Non-billable' : v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}

                <button
                  onClick={() => {
                    setFilters(getDefaultFilters());
                    setActivePreset('30d');
                  }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset filters
                </button>
              </div>
            </div>
          )}

          {/* ── Active report ──────────────────────────────────────── */}
          {report === 'project-progress'     && <ProjectProgressReport     {...reportProps} />}
          {report === 'task-completion'      && <TaskCompletionReport       {...reportProps} />}
          {report === 'time-tracking'        && <TimeTrackingReport         {...reportProps} />}
          {report === 'billable-hours'       && <BillableHoursReport        {...reportProps} />}
          {report === 'client-profitability' && <ClientProfitabilityReport  {...reportProps} />}
          {report === 'overdue-tasks'        && <OverdueTaskReport          {...reportProps} allTasks={tasks} />}
          {report === 'team-workload'        && <TeamWorkloadReport         {...reportProps} allEntries={entries} allTasks={tasks} />}
          {report === 'team-productivity'    && <TeamProductivityReport     {...reportProps} allTasks={tasks} />}
          {report === 'invoice-ready'        && <InvoiceReadyReport         {...reportProps} />}
        </div>
      </div>

      {/* Global print styles */}
      <style>{`
        @media print {
          nav, header, aside, footer { display: none !important; }
          body { background: white !important; }
          .tc-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          tr, .report-row { page-break-inside: avoid; }
        }
      `}</style>
    </>
  );
}
