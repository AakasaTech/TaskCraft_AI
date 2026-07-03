import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ProjectStatusBadge } from '@/components/shared/StatusBadge';
import { ProjectDetailClient } from './_components/ProjectDetailClient';
import type { DetailTask, DetailTimeEntry, DetailMember } from './_components/ProjectDetailClient';
import type { TaskStatus, TaskPriority, ProjectMemberRole, ProjectStatus } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('projects').select('name').eq('id', id).maybeSingle();
  return { title: data?.name ?? 'Project' };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Workspace + plan check
  const [memberRes, profileRes] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single(),
  ]);

  const wid = memberRes.data?.workspace_id;
  const isTeamPlan = profileRes.data?.plan === 'team';

  // Core project
  const { data: project } = await supabase
    .from('projects')
    .select('*, clients(id, name, company)')
    .eq('id', id)
    .eq('workspace_id', wid ?? '')
    .maybeSingle();

  if (!project) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRec = Array.isArray((project as any).clients)
    ? (project as any).clients[0]
    : (project as any).clients;

  // Fetch tasks, time entries, members in parallel
  const [tasksRes, timeRes, membersRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, assignee_id, profiles!tasks_assignee_id_fkey(full_name)')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('time_entries')
      .select('id, description, start_time, duration_minutes, billable, user_id, profiles(full_name)')
      .eq('project_id', id)
      .not('duration_minutes', 'is', null)
      .order('start_time', { ascending: false }),

    isTeamPlan
      ? supabase
          .from('project_members')
          .select('user_id, role, profiles(full_name, email, avatar_url)')
          .eq('project_id', id)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const now = new Date();

  // Shape tasks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: DetailTask[] = (tasksRes.data ?? []).map((t: any) => {
    const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
    return {
      id:            t.id,
      title:         t.title,
      status:        t.status as TaskStatus,
      priority:      t.priority as TaskPriority,
      due_date:      t.due_date ?? null,
      assignee_name: profile?.full_name ?? null,
    };
  });

  // Shape time entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeEntries: DetailTimeEntry[] = (timeRes.data ?? []).map((e: any) => {
    const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    return {
      id:               e.id,
      description:      e.description ?? null,
      start_time:       e.start_time,
      duration_minutes: e.duration_minutes,
      billable:         e.billable,
      user_name:        profile?.full_name ?? null,
    };
  });

  // Shape members
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: DetailMember[] = (membersRes.data ?? []).map((m: any) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      user_id:    m.user_id,
      role:       m.role as ProjectMemberRole,
      full_name:  profile?.full_name ?? null,
      email:      profile?.email ?? '',
      avatar_url: profile?.avatar_url ?? null,
    };
  });

  // Computed stats
  const doneCount     = tasks.filter((t) => t.status === 'done').length;
  const openCount     = tasks.filter((t) => t.status !== 'done').length;
  const overdueCount  = tasks.filter(
    (t) => t.status !== 'done' && t.due_date && new Date(t.due_date) < now,
  ).length;

  const totalMins    = timeEntries.reduce((s, e) => s + e.duration_minutes, 0);
  const billableMins = timeEntries.filter((e) => e.billable).reduce((s, e) => s + e.duration_minutes, 0);
  const hoursLogged  = Math.round((totalMins / 60) * 10) / 10;
  const billableHrs  = Math.round((billableMins / 60) * 10) / 10;
  const budgetUsed   = billableHrs * (project.hourly_rate ?? 0);

  // Clients list for edit modal
  const { data: clientsData } = await supabase
    .from('clients')
    .select('id, name, company')
    .eq('workspace_id', wid ?? '')
    .order('name');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clients = (clientsData ?? []).map((c: any) => ({
    id: c.id as string, name: c.name as string, company: c.company as string | null,
  }));

  const projectForClient = {
    id:             project.id,
    name:           project.name,
    description:    project.description ?? undefined,
    color:          project.color,
    status:         project.status as ProjectStatus,
    client_id:      project.client_id ?? undefined,
    client_name:    clientRec?.name ?? null,
    start_date:     project.start_date ?? undefined,
    due_date:       project.due_date ?? undefined,
    budget:         project.budget ?? null,
    hourly_rate:    project.hourly_rate ?? null,
    billable:       project.billable,
    hours_logged:   hoursLogged,
    billable_hours: billableHrs,
    budget_used:    budgetUsed,
    task_count:     tasks.length,
    done_count:     doneCount,
    open_count:     openCount,
    overdue_count:  overdueCount,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="h-4 w-4 shrink-0 rounded-full"
            style={{ background: project.color }}
          />
          <h1 className="page-title truncate">{project.name}</h1>
          <ProjectStatusBadge status={project.status as ProjectStatus} />
        </div>
      </div>

      <ProjectDetailClient
        project={projectForClient}
        tasks={tasks}
        timeEntries={timeEntries}
        members={members}
        clients={clients}
        isTeamPlan={isTeamPlan}
        currentUserId={user.id}
      />
    </div>
  );
}
