import type { Metadata } from 'next';
import { CheckSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { TasksClient } from './_components/TasksClient';
import type { TaskRich, LabelChip, TaskMember, TaskProject } from './_types';
import type { TaskStatus, TaskPriority } from '@/lib/types';

export const metadata: Metadata = { title: 'Tasks' };

export default async function TasksPage() {
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
        <CheckSquare className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Workspace not found.</p>
      </div>
    );
  }

  // Fetch everything in parallel
  const [tasksRes, projectsRes, membersRes, labelsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select(`
        id, workspace_id, title, description, status, priority,
        due_date, start_date, estimated_hours, actual_hours,
        billable, hourly_rate, position, project_id, assignee_id,
        parent_task_id, created_at, completed_at,
        projects(id, name, color),
        profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
        task_label_assignments(task_labels(id, name, color))
      `)
      .eq('workspace_id', wid)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false }),

    supabase
      .from('projects')
      .select('id, name, color')
      .eq('workspace_id', wid)
      .neq('status', 'archived')
      .order('name'),

    supabase
      .from('workspace_members')
      .select('user_id, profiles(id, full_name, avatar_url, email)')
      .eq('workspace_id', wid),

    supabase
      .from('task_labels')
      .select('id, name, color')
      .eq('workspace_id', wid)
      .order('name'),
  ]);

  // Compute subtask counts
  const subtaskCounts: Record<string, { total: number; done: number }> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (tasksRes.data ?? []) as any[]) {
    if (t.parent_task_id) {
      if (!subtaskCounts[t.parent_task_id]) subtaskCounts[t.parent_task_id] = { total: 0, done: 0 };
      subtaskCounts[t.parent_task_id].total++;
      if (t.status === 'done') subtaskCounts[t.parent_task_id].done++;
    }
  }

  // Shape tasks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: TaskRich[] = (tasksRes.data ?? []).map((t: any) => {
    const project  = Array.isArray(t.projects) ? t.projects[0] : t.projects;
    const assignee = Array.isArray(t.profiles)  ? t.profiles[0]  : t.profiles;
    const labelRows = (t.task_label_assignments ?? []) as any[];
    const taskLabels: LabelChip[] = labelRows
      .map((la) => {
        const lb = Array.isArray(la.task_labels) ? la.task_labels[0] : la.task_labels;
        return lb ? { id: lb.id, name: lb.name, color: lb.color } : null;
      })
      .filter(Boolean) as LabelChip[];

    return {
      id:                t.id,
      workspace_id:      t.workspace_id,
      title:             t.title,
      description:       t.description ?? null,
      status:            t.status as TaskStatus,
      priority:          t.priority as TaskPriority,
      due_date:          t.due_date ?? null,
      start_date:        t.start_date ?? null,
      estimated_hours:   t.estimated_hours ?? null,
      actual_hours:      t.actual_hours ?? 0,
      billable:          t.billable,
      hourly_rate:       t.hourly_rate ?? null,
      position:          t.position,
      project_id:        t.project_id ?? null,
      project_name:      project?.name ?? null,
      project_color:     project?.color ?? null,
      assignee_id:       t.assignee_id ?? null,
      assignee_name:     assignee?.full_name ?? null,
      assignee_avatar:   assignee?.avatar_url ?? null,
      parent_task_id:    t.parent_task_id ?? null,
      labels:            taskLabels,
      subtask_count:     subtaskCounts[t.id]?.total ?? 0,
      done_subtask_count:subtaskCounts[t.id]?.done ?? 0,
      created_at:        t.created_at,
      completed_at:      t.completed_at ?? null,
    };
  });

  // Shape projects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects: TaskProject[] = (projectsRes.data ?? []).map((p: any) => ({
    id: p.id, name: p.name, color: p.color,
  }));

  // Shape members
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: TaskMember[] = (membersRes.data ?? [])
    .map((m: any) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return profile ? {
        id:         profile.id,
        full_name:  profile.full_name ?? null,
        avatar_url: profile.avatar_url ?? null,
        email:      profile.email ?? '',
      } : null;
    })
    .filter(Boolean) as TaskMember[];

  // Shape labels
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskLabels: LabelChip[] = (labelsRes.data ?? []).map((l: any) => ({
    id: l.id, name: l.name, color: l.color,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tasks"
        subtitle={`${tasks.filter((t) => !t.parent_task_id && t.status !== 'done').length} open tasks`}
      />
      <TasksClient
        tasks={tasks}
        projects={projects}
        members={members}
        labels={taskLabels}
        currentUserId={user.id}
      />
    </div>
  );
}
