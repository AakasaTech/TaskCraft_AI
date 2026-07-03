'use client';
import { Clock, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { TimerWidget } from '@/components/shared/TimerWidget';

export default function TimePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Time Tracking"
        subtitle="Log and manage your billable hours"
        actions={
          <button className="tc-btn-secondary">
            <Plus className="h-3.5 w-3.5" />
            Log time
          </button>
        }
      />

      {/* Active timer card */}
      <div className="tc-card overflow-hidden">
        <div className="flex flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:justify-between sm:py-7">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Timer</p>
              <p className="text-xs text-muted-foreground">Select a task and hit start to track time</p>
            </div>
          </div>
          <TimerWidget />
        </div>
      </div>

      {/* Time entries */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Time Entries</h2>
        <button className="tc-btn-secondary">
          <Plus className="h-3.5 w-3.5" />
          Manual entry
        </button>
      </div>

      <div className="tc-card">
        <EmptyState
          icon={Clock}
          title="No time entries yet"
          description="Start a timer above or add a manual entry to start logging your billable hours."
        />
      </div>
    </div>
  );
}
