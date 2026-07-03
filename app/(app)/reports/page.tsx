import type { Metadata } from 'next';
import { BarChart3, Download, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Analyse your productivity and billable hours"
        actions={
          <button className="tc-btn-secondary">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        }
      />

      <Tabs defaultValue="time">
        <TabsList className="h-9 rounded-xl bg-muted/50 p-1">
          <TabsTrigger value="time"     className="rounded-lg text-xs">Time Summary</TabsTrigger>
          <TabsTrigger value="projects" className="rounded-lg text-xs">By Project</TabsTrigger>
          <TabsTrigger value="tasks"    className="rounded-lg text-xs">By Task</TabsTrigger>
        </TabsList>

        <TabsContent value="time" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Total Hours"    value="0h" subtitle="all time" icon={Clock}       iconBg="bg-sky-100 dark:bg-sky-900/30"     iconColor="text-sky-600 dark:text-sky-400" />
            <StatCard title="Billable Hours" value="0h" subtitle="all time" icon={TrendingUp}  iconBg="bg-primary/10"                      iconColor="text-primary" />
            <StatCard title="Billable Value" value="$0" subtitle="all time" icon={DollarSign}  iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="tc-card">
            <EmptyState
              icon={BarChart3}
              title="No data yet"
              description="Start tracking time to see your productivity reports and billable hour summaries."
            />
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <div className="tc-card">
            <div className="py-16 text-center text-sm text-muted-foreground">No project data yet.</div>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <div className="tc-card">
            <div className="py-16 text-center text-sm text-muted-foreground">No task data yet.</div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
