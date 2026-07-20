import type { Metadata } from 'next';
import { FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProjectsClient } from './_components/ProjectsClient';
import type { ProjectRow } from './_components/ProjectsClient';
import type { ProjectStatus } from '@/lib/types';
import { PLANS } from '@/lib/constants';
import type { Plan } from '@/lib/types';
import { getEffectivePlan } from '@/lib/plan-gates';

export const metadata: Metadata = { title: 'Projects' };

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const wid = membership?.workspace_id;

  if (!wid) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <FolderKanban className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Workspace not found.</p>
      </div>
    );
  }

  // Fetch profile plan in parallel with project data
  const [profileRes, projectsRes, taskStatsRes, timeRes, clientsRes] = await Promise.all([
    supabase.from('profiles').select('plan, plan_expires_at').eq('id', user.id).single(),
    supabase
      .from('projects')
      .select('id, name, description, color, status, client_id, start_date, due_date, budget, hourly_rate, billable, clients(name, company)')
      .eq('workspace_id', wid)
      .order('created_at', { ascending: false }),

    supabase
      .from('tasks')
      .select('project_id, status')
      .eq('workspace_id', wid)
      .not('project_id', 'is', null),

    supabase
      .from('time_entries')
      .select('project_id, duration_minutes')
      .eq('workspace_id', wid)
      .not('project_id', 'is', null)
      .not('duration_minutes', 'is', null),

    supabase
      .from('clients')
      .select('id, name, company')
      .eq('workspace_id', wid)
      .order('name'),
  ]);

  // Build task stats per project
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskMap: Record<string, { total: number; done: number }> = {};
  for (const t of (taskStatsRes.data ?? []) as any[]) {
    if (!taskMap[t.project_id]) taskMap[t.project_id] = { total: 0, done: 0 };
    taskMap[t.project_id].total++;
    if (t.status === 'done') taskMap[t.project_id].done++;
  }

  // Build hours per project (duration_minutes / 60)
  const hoursMap: Record<string, number> = {};
  for (const e of (timeRes.data ?? []) as any[]) {
    hoursMap[e.project_id] = (hoursMap[e.project_id] ?? 0) + (e.duration_minutes / 60);
  }

  // Shape projects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects: ProjectRow[] = (projectsRes.data ?? []).map((p: any) => {
    const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
    return {
      id:           p.id,
      name:         p.name,
      description:  p.description,
      color:        p.color,
      status:       p.status as ProjectStatus,
      client_id:    p.client_id,
      client_name:  client?.name ?? null,
      start_date:   p.start_date,
      due_date:     p.due_date,
      budget:       p.budget,
      hourly_rate:  p.hourly_rate,
      billable:     p.billable,
      task_count:   taskMap[p.id]?.total ?? 0,
      done_count:   taskMap[p.id]?.done ?? 0,
      hours_logged: Math.round((hoursMap[p.id] ?? 0) * 10) / 10,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clients = (clientsRes.data ?? []).map((c: any) => ({
    id: c.id as string, name: c.name as string, company: c.company as string | null,
  }));

  const plan          = getEffectivePlan((profileRes.data?.plan ?? 'free') as Plan, profileRes.data?.plan_expires_at ?? null);
  const projectLimit: number = PLANS[plan].max_projects;
  const activeCount   = projects.filter((p) => p.status !== 'archived').length;
  const atLimit       = projectLimit !== -1 && activeCount >= projectLimit;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Projects"
        subtitle="Manage and track all your projects"
      />

      {/* Plan usage banner — only shown for free plan */}
      {projectLimit !== -1 && (
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
          atLimit
            ? 'border-destructive/30 bg-destructive/5 text-destructive'
            : 'border-border bg-muted/50 text-muted-foreground'
        }`}>
          <span>
            {activeCount} / {projectLimit} active project{projectLimit !== 1 ? 's' : ''} used
            {atLimit ? ' — limit reached' : ''}
          </span>
          <Link
            href="/settings/billing"
            className="text-xs font-semibold text-primary hover:underline shrink-0"
          >
            Upgrade for unlimited →
          </Link>
        </div>
      )}

      <ProjectsClient projects={projects} clients={clients} />
    </div>
  );
}
