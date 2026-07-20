import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { ClientList } from './_components/ClientList';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import type { ClientWithStats } from './_components/ClientList';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Clients' };

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [membershipRes, profileRes] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('plan, plan_expires_at')
      .eq('id', user.id)
      .single(),
  ]);

  // Gate: Clients require Solo or Team plan
  const userPlan = getEffectivePlan((profileRes.data?.plan ?? 'free') as Plan, profileRes.data?.plan_expires_at ?? null);
  if (userPlan === 'free') {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Clients" subtitle="Manage clients and link them to projects for billing" />
        <UpgradePrompt feature="clients" requiredPlan="solo" />
      </div>
    );
  }

  const wid = membershipRes.data?.workspace_id;

  if (!wid) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Building2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Workspace not found.</p>
      </div>
    );
  }

  const [clientsRes, projectsRes, timeRes] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', wid)
      .order('name'),

    supabase
      .from('projects')
      .select('id, client_id')
      .eq('workspace_id', wid)
      .not('client_id', 'is', null),

    supabase
      .from('time_entries')
      .select('project_id, duration_minutes, billable')
      .eq('workspace_id', wid)
      .eq('billable', true)
      .not('duration_minutes', 'is', null),
  ]);

  // Build project counts per client
  const projectCountMap: Record<string, number> = {};
  for (const p of (projectsRes.data ?? []) as { id: string; client_id: string }[]) {
    projectCountMap[p.client_id] = (projectCountMap[p.client_id] ?? 0) + 1;
  }

  // Build project → client map for time lookup
  const projectClientMap: Record<string, string> = {};
  for (const p of (projectsRes.data ?? []) as { id: string; client_id: string }[]) {
    projectClientMap[p.id] = p.client_id;
  }

  // Billable hours per client (via projects)
  const billableMap: Record<string, number> = {};
  for (const e of (timeRes.data ?? []) as { project_id: string | null; duration_minutes: number }[]) {
    if (!e.project_id) continue;
    const cid = projectClientMap[e.project_id];
    if (!cid) continue;
    billableMap[cid] = (billableMap[cid] ?? 0) + e.duration_minutes / 60;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clients: ClientWithStats[] = (clientsRes.data ?? []).map((c: any) => ({
    ...c,
    project_count:   projectCountMap[c.id] ?? 0,
    open_task_count: 0,
    billable_hours:  Math.round((billableMap[c.id] ?? 0) * 10) / 10,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Clients"
        subtitle="Manage clients and link them to projects for billing"
      />
      <ClientList clients={clients} />
    </div>
  );
}
