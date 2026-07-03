import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { TimeClient } from './_components/TimeClient';
import type { TimeEntryRich, RunningTimer, TimeProject, TimeTask } from './_types';

export const metadata: Metadata = { title: 'Time Tracking' };

export default async function TimePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single();

  if (!member) redirect('/login');
  const wid = member.workspace_id;
  const uid = user.id;

  // Last 30 days for the weekly navigation to have enough data
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [entriesRes, runningRes, projectsRes, tasksRes] = await Promise.all([
    supabase
      .from('time_entries')
      .select(`
        id, workspace_id, task_id, project_id, user_id,
        description, start_time, end_time, duration_minutes,
        billable, hourly_rate, invoice_status, source, created_at,
        tasks(title),
        projects(name, color, clients(name))
      `)
      .eq('user_id', uid)
      .eq('workspace_id', wid)
      .not('end_time', 'is', null)
      .gte('start_time', since.toISOString())
      .order('start_time', { ascending: false }),

    supabase
      .from('time_entries')
      .select('id, description, start_time, task_id, project_id, billable, hourly_rate, tasks(title), projects(name, color)')
      .eq('user_id', uid)
      .eq('workspace_id', wid)
      .is('end_time', null)
      .maybeSingle(),

    supabase
      .from('projects')
      .select('id, name, color, hourly_rate, clients(name)')
      .eq('workspace_id', wid)
      .neq('status', 'archived')
      .order('name'),

    supabase
      .from('tasks')
      .select('id, title, project_id')
      .eq('workspace_id', wid)
      .is('parent_task_id', null)
      .neq('status', 'done')
      .order('title'),
  ]);

  // Shape time entries
  const entries: TimeEntryRich[] = (entriesRes.data ?? []).map((e) => {
    const task    = Array.isArray(e.tasks)    ? e.tasks[0]    : e.tasks;
    const proj    = Array.isArray(e.projects) ? e.projects[0] : e.projects;
    const client  = proj ? (Array.isArray((proj as any).clients) ? (proj as any).clients[0] : (proj as any).clients) : null;
    return {
      id:               e.id,
      workspace_id:     e.workspace_id,
      task_id:          e.task_id,
      project_id:       e.project_id,
      user_id:          e.user_id,
      description:      e.description,
      start_time:       e.start_time,
      end_time:         e.end_time,
      duration_minutes: e.duration_minutes,
      billable:         e.billable,
      hourly_rate:      e.hourly_rate,
      invoice_status:   e.invoice_status as TimeEntryRich['invoice_status'],
      source:           e.source as TimeEntryRich['source'],
      created_at:       e.created_at,
      task_title:       task?.title ?? null,
      project_name:     proj?.name ?? null,
      project_color:    proj?.color ?? null,
      client_name:      client?.name ?? null,
    };
  });

  // Shape running timer
  let running: RunningTimer | null = null;
  const r = runningRes.data;
  if (r) {
    const rTask = Array.isArray(r.tasks)    ? r.tasks[0]    : r.tasks;
    const rProj = Array.isArray(r.projects) ? r.projects[0] : r.projects;
    running = {
      id:           r.id,
      description:  r.description,
      start_time:   r.start_time,
      task_id:      r.task_id,
      task_title:   rTask?.title ?? null,
      project_id:   r.project_id,
      project_name: rProj?.name ?? null,
      project_color: rProj?.color ?? null,
      billable:     r.billable,
      hourly_rate:  r.hourly_rate,
    };
  }

  // Shape projects
  const projects: TimeProject[] = (projectsRes.data ?? []).map((p) => {
    const c = Array.isArray((p as any).clients) ? (p as any).clients[0] : (p as any).clients;
    return {
      id:          p.id,
      name:        p.name,
      color:       p.color,
      hourly_rate: p.hourly_rate,
      client_name: c?.name ?? null,
    };
  });

  // Shape tasks
  const tasks: TimeTask[] = (tasksRes.data ?? []).map((t) => ({
    id:         t.id,
    title:      t.title,
    project_id: t.project_id,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Tracking"
        subtitle="Log and manage your billable hours"
      />
      <TimeClient
        entries={entries}
        running={running}
        projects={projects}
        tasks={tasks}
      />
    </div>
  );
}
