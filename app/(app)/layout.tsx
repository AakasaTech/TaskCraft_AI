import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/shared/AppShell';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { RunningTimer } from '@/app/(app)/time/_types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [profileRes, memberRes] = await Promise.all([
    supabase.from('profiles').select('full_name, avatar_url, plan, plan_expires_at').eq('id', user.id).single(),
    supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).single(),
  ]);

  // Fetch running timer for header badge
  let runningTimer: RunningTimer | null = null;
  if (memberRes.data) {
    const { data: r } = await supabase
      .from('time_entries')
      .select('id, description, start_time, task_id, project_id, billable, hourly_rate, tasks(title), projects(name, color)')
      .eq('user_id', user.id)
      .eq('workspace_id', memberRes.data.workspace_id)
      .is('end_time', null)
      .maybeSingle();

    if (r) {
      const rTask = Array.isArray(r.tasks)    ? r.tasks[0]    : r.tasks;
      const rProj = Array.isArray(r.projects) ? r.projects[0] : r.projects;
      runningTimer = {
        id:            r.id,
        description:   r.description,
        start_time:    r.start_time,
        task_id:       r.task_id,
        task_title:    rTask?.title ?? null,
        project_id:    r.project_id,
        project_name:  rProj?.name ?? null,
        project_color: rProj?.color ?? null,
        billable:      r.billable,
        hourly_rate:   r.hourly_rate,
      };
    }
  }

  return (
    <AppShell
      user={{
        ...profileRes.data,
        email: user.email,
        plan:  getEffectivePlan(
          (profileRes.data?.plan ?? 'free') as import('@/lib/types').Plan,
          profileRes.data?.plan_expires_at ?? null,
        ),
      }}
      userId={user.id}
      runningTimer={runningTimer}
    >
      {children}
    </AppShell>
  );
}
