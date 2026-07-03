import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { CalendarClient } from './_components/CalendarClient';
import type { CalendarTask } from './_components/CalendarClient';
import type { TaskStatus, TaskPriority } from '@/lib/types';

export const metadata: Metadata = { title: 'Calendar' };

export default async function CalendarPage() {
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

  // Fetch tasks with a due_date
  const { data: tasksData } = wid
    ? await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, project_id, projects(name, color)')
        .eq('workspace_id', wid)
        .not('due_date', 'is', null)
        .is('parent_task_id', null)
        .order('due_date', { ascending: true })
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: CalendarTask[] = (tasksData ?? []).map((t: any) => {
    const project = Array.isArray(t.projects) ? t.projects[0] : t.projects;
    return {
      id:            t.id,
      title:         t.title,
      status:        t.status as TaskStatus,
      priority:      t.priority as TaskPriority,
      due_date:      t.due_date as string,
      project_name:  project?.name ?? null,
      project_color: project?.color ?? null,
    };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Calendar"
        subtitle="Tasks by due date"
      />
      <CalendarClient tasks={tasks} />
    </div>
  );
}
