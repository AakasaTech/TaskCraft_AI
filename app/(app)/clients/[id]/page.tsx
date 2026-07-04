import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ClientDetailClient } from './_components/ClientDetailClient';

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('clients').select('name').eq('id', id).single();
  return { title: data?.name ?? 'Client' };
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const wid = membership?.workspace_id;
  if (!wid) notFound();

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', wid)
    .single();

  if (error || !client) notFound();

  const [projectsRes, invoicesRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, color, status, billable, due_date, hourly_rate')
      .eq('workspace_id', wid)
      .eq('client_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('invoices_sync')
      .select('*')
      .eq('workspace_id', wid)
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
  ]);

  const projectIds = (projectsRes.data ?? []).map((p: { id: string }) => p.id);

  const [tasksRes, timeRes] = await Promise.all([
    projectIds.length > 0
      ? supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, project_id, projects(name, color)')
          .eq('workspace_id', wid)
          .in('project_id', projectIds)
          .neq('status', 'done')
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),

    projectIds.length > 0
      ? supabase
          .from('time_entries')
          .select('id, description, start_time, end_time, duration_minutes, billable, hourly_rate, project_id, projects(name, color)')
          .eq('workspace_id', wid)
          .in('project_id', projectIds)
          .order('start_time', { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <ClientDetailClient
      client={client}
      projects={projectsRes.data ?? []}
      tasks={tasksRes.data ?? []}
      timeEntries={timeRes.data ?? []}
      invoices={invoicesRes.data ?? []}
    />
  );
}
