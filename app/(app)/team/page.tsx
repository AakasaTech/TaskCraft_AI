import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TeamClient } from './_components/TeamClient';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Team Management' };

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single();

  const effectivePlan = getEffectivePlan((profile?.plan ?? 'free') as Plan, profile?.plan_expires_at ?? null);
  if (effectivePlan !== 'team') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="rounded-2xl border border-border bg-card p-8 max-w-md w-full">
          <div className="text-4xl mb-3">👥</div>
          <h1 className="text-xl font-bold mb-1">Team Management</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Invite your team, assign roles, view workloads and timesheets. Requires the Team plan.
          </p>
          <div className="space-y-2 text-sm text-left mb-6">
            {[
              'Unlimited team members',
              'Role-based access control',
              'Team workload & timesheet views',
              'Project-level permissions',
              'Team activity feed',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
          <Link
            href="/settings/billing"
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Upgrade to Team — $19/mo
          </Link>
        </div>
      </div>
    );
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const wid = membership?.workspace_id;
  if (!wid) redirect('/dashboard');

  const admin = createAdminClient();

  const [membersRes, invitesRes, projectsRes] = await Promise.all([
    admin
      .from('workspace_members')
      .select('id, user_id, role, joined_at, profiles(full_name, avatar_url, email)')
      .eq('workspace_id', wid)
      .order('created_at', { ascending: true }),

    admin
      .from('workspace_invitations')
      .select('*')
      .eq('workspace_id', wid)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),

    supabase
      .from('projects')
      .select('id, name, color, status')
      .eq('workspace_id', wid)
      .neq('status', 'archived')
      .order('position', { ascending: true }),
  ]);

  const members = (membersRes.data ?? []).map((m) => ({
    ...m,
    profiles: Array.isArray(m.profiles)
      ? (m.profiles[0] as { full_name: string | null; avatar_url: string | null; email: string } | undefined) ?? null
      : m.profiles as { full_name: string | null; avatar_url: string | null; email: string } | null,
  }));

  return (
    <TeamClient
      currentUserId={user.id}
      currentUserRole={membership.role}
      workspaceId={wid}
      members={members}
      pendingInvites={invitesRes.data ?? []}
      projects={projectsRes.data ?? []}
    />
  );
}
