import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { AIHub } from './_components/AIHub';
import type { Plan } from '@/lib/types';
import { getEffectivePlan } from '@/lib/plan-gates';

export const metadata: Metadata = { title: 'AI Assistant' };

export default async function AIPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, memberRes] = await Promise.all([
    supabase.from('profiles').select('plan, plan_expires_at, full_name').eq('id', user.id).single(),
    supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).single(),
  ]);

  const plan = getEffectivePlan((profileRes.data?.plan ?? 'free') as Plan, profileRes.data?.plan_expires_at ?? null);
  const wid  = memberRes.data?.workspace_id;
  if (!wid) redirect('/login');

  // Monthly usage for Free plan display
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const { count: usageCount } = await supabase
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('used_at', since.toISOString());

  // Projects for tool selectors
  const { data: projectsRaw } = await supabase
    .from('projects')
    .select('id, name, color')
    .eq('workspace_id', wid)
    .neq('status', 'archived')
    .order('name');

  // All open top-level tasks in the workspace (no assignee filter — subtask
  // generator needs to see any task, not just ones assigned to the viewer)
  const { data: tasksRaw } = await supabase
    .from('tasks')
    .select('id, title, priority, status, due_date, project_id, projects(name)')
    .eq('workspace_id', wid)
    .not('status', 'in', '("done","backlog")')
    .is('parent_task_id', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(200);

  // Team members (for Team plan tools)
  const { data: membersRaw } = plan === 'team'
    ? await supabase
        .from('workspace_members')
        .select('user_id, profiles(full_name, email, avatar_url)')
        .eq('workspace_id', wid)
    : { data: [] };

  const projects = (projectsRaw ?? []).map((p) => ({
    id: p.id, name: p.name, color: p.color,
  }));

  const tasks = (tasksRaw ?? []).map((t) => {
    const proj = Array.isArray((t as any).projects) ? (t as any).projects[0] : (t as any).projects;
    return {
      id:           t.id,
      title:        t.title,
      priority:     t.priority,
      status:       t.status,
      due_date:     t.due_date,
      project_id:   t.project_id,
      project_name: proj?.name ?? null,
    };
  });

  const members = (membersRaw ?? []).map((m) => {
    const prof = Array.isArray((m as any).profiles) ? (m as any).profiles[0] : (m as any).profiles;
    return {
      id:        m.user_id,
      full_name: prof?.full_name ?? null,
      email:     prof?.email ?? '',
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        subtitle="AI-powered tools to boost your productivity"
      />
      <AIHub
        plan={plan}
        usageThisMonth={usageCount ?? 0}
        projects={projects}
        tasks={tasks}
        members={members}
      />
    </div>
  );
}
