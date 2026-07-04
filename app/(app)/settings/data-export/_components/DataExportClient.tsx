'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, Lock } from 'lucide-react';

type ExportType = 'time-entries' | 'projects' | 'tasks' | 'clients';

interface ExportItem {
  type:       ExportType;
  label:      string;
  description: string;
  minPlan:    'free' | 'solo';
}

const EXPORTS: ExportItem[] = [
  {
    type:        'time-entries',
    label:       'Time Entries',
    description: 'All your tracked time with duration, billable status, and invoice state.',
    minPlan:     'free',
  },
  {
    type:        'projects',
    label:       'Projects',
    description: 'All workspace projects with status, dates, and budget.',
    minPlan:     'free',
  },
  {
    type:        'tasks',
    label:       'Tasks',
    description: 'All tasks across all projects with status, priority, and due dates.',
    minPlan:     'free',
  },
  {
    type:        'clients',
    label:       'Clients',
    description: 'All client records including contact details and currency settings.',
    minPlan:     'solo',
  },
];

interface Props {
  plan: string;
}

export function DataExportClient({ plan }: Props) {
  const [loading, setLoading] = useState<ExportType | null>(null);

  async function handleExport(type: ExportType) {
    setLoading(type);
    try {
      const res = await fetch(`/api/export?type=${type}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Export failed.' }));
        toast.error(body.error ?? 'Export failed.');
        return;
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${type.replace('-', ' ')} exported.`);
    } catch {
      toast.error('Download failed. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  const planRank: Record<string, number> = { free: 0, solo: 1, team: 2 };

  return (
    <div className="divide-y divide-border">
      {EXPORTS.map((item) => {
        const locked   = (planRank[plan] ?? 0) < (planRank[item.minPlan] ?? 0);
        const isActive = loading === item.type;

        return (
          <div key={item.type} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{item.label}</p>
                {locked && (
                  <span className="flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" />Solo
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
            </div>

            <button
              onClick={() => !locked && handleExport(item.type)}
              disabled={isActive || locked}
              className="tc-btn-secondary shrink-0 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              title={locked ? 'Upgrade to Solo to export clients' : undefined}
            >
              {isActive
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Download className="h-3 w-3" />
              }
              {isActive ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
