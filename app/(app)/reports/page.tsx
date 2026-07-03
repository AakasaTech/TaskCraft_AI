import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { TimeReportsClient } from './_components/TimeReportsClient';
import type { TimeEntryRich } from '@/app/(app)/time/_types';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
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

  // Last 90 days — client handles further range filtering
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data: raw } = await supabase
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
    .order('start_time', { ascending: false });

  const entries: TimeEntryRich[] = (raw ?? []).map((e) => {
    const task   = Array.isArray(e.tasks)    ? e.tasks[0]    : e.tasks;
    const proj   = Array.isArray(e.projects) ? e.projects[0] : e.projects;
    const client = proj ? (Array.isArray((proj as any).clients) ? (proj as any).clients[0] : (proj as any).clients) : null;
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Analyse your productivity and billable hours"
      />
      <TimeReportsClient entries={entries} />
    </div>
  );
}
